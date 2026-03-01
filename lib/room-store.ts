import { redis } from './redis';
import { pusher } from './pusher';
import { Card, DealResult, dealCards, findStartingPlayer, getComboType, canBeat, isValidFirstPlay } from './game-engine';

export type GamePhase = 'waiting' | 'playing' | 'finished';

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  position: number;
}

export interface GamePlayer extends Player {
  hand: Card[];
  passed: boolean;
  finished: boolean;
  finishOrder: number;
}

export interface LastPlay {
  playerId: string;
  playerName: string;
  cards: Card[];
  comboType: string;
}

export interface GameState {
  phase: GamePhase;
  players: GamePlayer[];
  currentPlayerIndex: number;
  lastPlay: LastPlay | null;
  roundStarter: number;
  isFirstPlay: boolean;
  finishedCount: number;
  aside: Card | null;
  maxPlayers: 3 | 4;
}

export interface Room {
  code: string;
  maxPlayers: 3 | 4;
  hostId: string;
  players: Player[];
  gameState: GameState | null;
  createdAt: number;
}

const ROOM_KEY_PREFIX = 'room:';

export function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getRoom(code: string): Promise<Room | null> {
  return await redis.get<Room>(`${ROOM_KEY_PREFIX}${code.toUpperCase()}`);
}

export async function saveRoom(room: Room): Promise<void> {
  await redis.set(`${ROOM_KEY_PREFIX}${room.code.toUpperCase()}`, room, { ex: 3600 * 24 }); // Expire in 24h
}

export async function createRoom(maxPlayers: 3 | 4, hostId: string, hostName: string): Promise<Room> {
  let code: string;
  let exists = true;
  do {
    code = generateCode();
    const existing = await getRoom(code);
    exists = !!existing;
  } while (exists);

  const host: Player = { id: hostId, name: hostName, connected: true, position: 0 };
  const room: Room = {
    code,
    maxPlayers,
    hostId,
    players: [host],
    gameState: null,
    createdAt: Date.now(),
  };
  await saveRoom(room);
  return room;
}

export async function joinRoom(code: string, playerId: string, playerName: string): Promise<{ room?: Room; error?: string }> {
  const room = await getRoom(code);
  if (!room) return { error: 'Room not found' };
  
  if (room.gameState && room.gameState.phase === 'playing') {
    return { room, error: 'Game already in progress' };
  }
  
  if (room.players.length >= room.maxPlayers) {
    const existingP = room.players.find(p => p.id === playerId);
    if (!existingP) return { room, error: 'Room is full' };
  }

  const existing = room.players.find(p => p.id === playerId);
  if (existing) {
    existing.connected = true;
    await saveRoom(room);
    return { room };
  }

  const position = room.players.length;
  room.players.push({ id: playerId, name: playerName, connected: true, position });
  await saveRoom(room);
  return { room };
}

export async function startGame(code: string): Promise<{ gameState?: GameState; error?: string }> {
  const room = await getRoom(code);
  if (!room) return { error: 'Room not found' };
  if (room.players.length < 3) return { error: 'Need at least 3 players' };

  const deal: DealResult = dealCards(room.players.length as 3 | 4);
  const startIdx = findStartingPlayer(deal.hands);

  const gamePlayers: GamePlayer[] = room.players.map((p, i) => ({
    ...p,
    hand: deal.hands[i],
    passed: false,
    finished: false,
    finishOrder: 0,
  }));

  const gameState: GameState = {
    phase: 'playing',
    players: gamePlayers,
    currentPlayerIndex: startIdx,
    lastPlay: null,
    roundStarter: startIdx,
    isFirstPlay: true,
    finishedCount: 0,
    aside: deal.aside,
    maxPlayers: room.players.length as 3 | 4,
  };

  room.gameState = gameState;
  await saveRoom(room);
  
  // Broadcast game start via Pusher
  await broadcast(code, 'game_state', { gameState: getPublicGameState(gameState, '') });
  
  return { gameState };
}

export function getPublicGameState(gs: GameState, requestingPlayerId: string) {
  return {
    phase: gs.phase,
    currentPlayerIndex: gs.currentPlayerIndex,
    lastPlay: gs.lastPlay,
    roundStarter: gs.roundStarter,
    isFirstPlay: gs.isFirstPlay,
    finishedCount: gs.finishedCount,
    aside: gs.aside,
    maxPlayers: gs.maxPlayers,
    players: gs.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      position: p.position,
      cardCount: p.hand.length,
      passed: p.passed,
      finished: p.finished,
      finishOrder: p.finishOrder,
      // Only send the hand to the requesting player
      hand: p.id === requestingPlayerId ? p.hand : undefined,
    })),
  };
}

export async function broadcast(roomCode: string, type: string, payload: any) {
  await pusher.trigger(`room-${roomCode}`, type, payload);
}

export function advanceTurn(gs: GameState) {
  const total = gs.players.length;
  let next = (gs.currentPlayerIndex + 1) % total;
  for (let attempts = 0; attempts < total; attempts++) {
    const p = gs.players[next];
    if (!p.finished && !p.passed) {
      gs.currentPlayerIndex = next;
      return;
    }
    next = (next + 1) % total;
  }
}

export async function playCards(code: string, playerId: string, cardIds: string[]): Promise<{ gameState?: GameState; error?: string }> {
  const room = await getRoom(code);
  if (!room || !room.gameState) return { error: 'Game not found' };
  const gs = room.gameState;
  const playerIdx = gs.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) return { error: 'Player not in game' };
  if (playerIdx !== gs.currentPlayerIndex) return { error: 'Not your turn' };

  const player = gs.players[playerIdx];
  const playedCards = cardIds.map(id => player.hand.find(c => c.id === id)).filter((c): c is Card => !!c);
  if (playedCards.length !== cardIds.length) return { error: 'Invalid card selection' };

  const comboType = getComboType(playedCards);
  if (!comboType) return { error: 'Invalid combination' };

  if (gs.isFirstPlay && !isValidFirstPlay(playedCards))
    return { error: 'First play must include the 3 of Clubs' };

  if (gs.lastPlay !== null) {
    const currentCombo = { type: gs.lastPlay.comboType as any, cards: gs.lastPlay.cards };
    const attemptCombo = { type: comboType, cards: playedCards };
    if (!canBeat(currentCombo, attemptCombo))
      return { error: 'Must play a higher combination of the same type' };
  }

  player.hand = player.hand.filter(c => !cardIds.includes(c.id));
  gs.lastPlay = { playerId, playerName: player.name, cards: playedCards, comboType: comboType! };
  gs.isFirstPlay = false;

  if (player.hand.length === 0) {
    player.finished = true;
    gs.finishedCount += 1;
    player.finishOrder = gs.finishedCount;
    const activePlayers = gs.players.filter(p => !p.finished);
    if (activePlayers.length <= 1) {
      if (activePlayers.length === 1) {
        gs.finishedCount += 1;
        activePlayers[0].finishOrder = gs.finishedCount;
        activePlayers[0].finished = true;
      }
      gs.phase = 'finished';
      await saveRoom(room);
      await broadcast(code, 'game_over', { gameState: gs });
      return { gameState: gs };
    }
  }

  advanceTurn(gs);
  await saveRoom(room);
  await broadcast(code, 'game_state', { gameState: gs });
  return { gameState: gs };
}

export async function passTurn(code: string, playerId: string): Promise<{ gameState?: GameState; error?: string }> {
  const room = await getRoom(code);
  if (!room || !room.gameState) return { error: 'Game not found' };
  const gs = room.gameState;
  const playerIdx = gs.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) return { error: 'Player not in game' };
  if (playerIdx !== gs.currentPlayerIndex) return { error: 'Not your turn' };
  if (gs.lastPlay === null) return { error: 'Cannot pass when you are the round starter' };

  gs.players[playerIdx].passed = true;
  const activePlayers = gs.players.filter(p => !p.finished && !p.passed);
  if (activePlayers.length === 0) {
    const lastPlayerId = gs.lastPlay.playerId;
    const roundStarterIdx = gs.players.findIndex(p => p.id === lastPlayerId);
    gs.players.forEach(p => { if (!p.finished) p.passed = false; });
    gs.lastPlay = null;
    gs.roundStarter = roundStarterIdx;
    gs.currentPlayerIndex = roundStarterIdx;
    await saveRoom(room);
    await broadcast(code, 'game_state', { gameState: gs });
    return { gameState: gs };
  }
  advanceTurn(gs);
  await saveRoom(room);
  await broadcast(code, 'game_state', { gameState: gs });
  return { gameState: gs };
}

export async function playerDisconnect(code: string, playerId: string): Promise<Room | undefined> {
  const room = await getRoom(code);
  if (!room) return undefined;
  const p = room.players.find(x => x.id === playerId);
  if (p) p.connected = false;
  if (room.gameState) {
    const gp = room.gameState.players.find(x => x.id === playerId);
    if (gp) gp.connected = false;
  }
  await saveRoom(room);
  await broadcast(code, 'player_left', { playerId });
  return room;
}
