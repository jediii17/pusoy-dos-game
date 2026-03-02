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
  cardCount: number; // Added for explicit tracking in client
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

export async function deleteRoom(code: string): Promise<void> {
  await redis.del(`${ROOM_KEY_PREFIX}${code.toUpperCase()}`);
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
    await broadcast(code, 'room_state', { room: getPublicRoomState(room, '') });
    return { room: getPublicRoomState(room, playerId) };
  }

  const position = room.players.length;
  room.players.push({ id: playerId, name: playerName, connected: true, position });
  await saveRoom(room);
  await broadcast(code, 'room_state', { room: getPublicRoomState(room, '') });
  return { room: getPublicRoomState(room, playerId) };
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
    cardCount: deal.hands[i].length,
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
  
  // Broadcast game start via Pusher (strips hands for everyone in shared broadcast)
  await broadcast(code, 'game_state', { gameState: getPublicGameState(gameState, '') });
  
  return { gameState: getPublicGameState(gameState, room.hostId) };
}

export function getPublicRoomState(room: Room, requestingPlayerId: string): any {
  return {
    ...room,
    gameState: room.gameState ? getPublicGameState(room.gameState, requestingPlayerId) : null
  };
}

export function getPublicGameState(gs: GameState, requestingPlayerId: string): any {
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
      ...p,
      cardCount: p.hand.length,
      // Stripe hand for security unless it's the owner's request
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

  // If we get here, it means everyone else is either finished or passed.
  // We must reset the cycle so the round can continue (the leader gets to lead again).
  gs.players.forEach(p => { if (!p.finished) p.passed = false; });
  gs.lastPlay = null;

  // Find the next non-finished player to take the lead
  next = (gs.currentPlayerIndex + 1) % total;
  for (let attempts = 0; attempts < total; attempts++) {
    if (!gs.players[next].finished) {
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
  if (playedCards.length !== cardIds.length) {
    return { error: 'Invalid card selection: some cards are no longer in your hand. Please refresh.' };
  }

  const comboType = getComboType(playedCards);
  if (!comboType) return { error: 'Invalid combination' };

  // First play must include the 3 of Clubs
  if (gs.isFirstPlay && !isValidFirstPlay(playedCards)) {
    return { error: 'First play must include the 3 of Clubs (♣3)' };
  }

  const otherActivePlayers = gs.players.filter(p => !p.finished && !p.passed && p.id !== playerId);
  
  // Safety: If everyone else passed or finished, the round should have reset.
  // We clear lastPlay and reset passed status to allow the player to lead freely
  // and ensure others can play against this new lead.
  if (otherActivePlayers.length === 0) {
    gs.lastPlay = null;
    gs.players.forEach(p => { if (!p.finished) p.passed = false; });
  }

  if (gs.lastPlay !== null) {
    const currentCombo = { type: gs.lastPlay.comboType as any, cards: gs.lastPlay.cards };
    const attemptCombo = { type: comboType, cards: playedCards };

    if (!canBeat(currentCombo, attemptCombo)) {
      const leadType = gs.lastPlay.comboType;
      
      // Contextual Tips
      if (leadType === 'single') {
        return { error: 'The current play is a single card. Tip: You must play exactly one card (higher rank) to beat it.' };
      }
      if (leadType === 'pair') {
        return { error: 'The current play is a pair. Tip: You must play a pair (2 cards) of higher rank to beat it.' };
      }
      if (leadType === 'triple') {
        return { error: 'The current play is a three-of-a-kind. Tip: You must play three cards of the same higher rank to beat it.' };
      }
      
      // For 5-card hands
      const is5CardLead = ['straight', 'flush', 'fullhouse', 'fourofakind', 'straightflush'].includes(leadType!);
      if (is5CardLead) {
        if (playedCards.length !== 5) {
          return { error: 'The current play is a 5-card combination. Tip: You must play 5 cards to challenge this hand.' };
        }
        return { error: `Must play a higher 5-card hand (like a higher ${leadType}) to beat the current play.` };
      }

      return { error: `Your move cannot beat the current ${leadType}.` };
    }
  }

  player.hand = player.hand.filter(c => !cardIds.includes(c.id));
  player.cardCount = player.hand.length;
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
      await broadcast(code, 'game_over', { gameState: getPublicGameState(gs, '') });
      return { gameState: getPublicGameState(gs, playerId) };
    }
  }

  advanceTurn(gs);
  await saveRoom(room);
  // Broadcast update (strips hands for security)
  await broadcast(code, 'game_state', { gameState: getPublicGameState(gs, '') });
  return { gameState: getPublicGameState(gs, playerId) };
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
  
  // Who is left that can still play in this round?
  const stillInRound = gs.players.filter(p => !p.finished && !p.passed);

  // If everyone else passed (or finished), the round is over
  // The last attacker (the one who didn't pass) wins the round
  if (stillInRound.length <= 1) {
    const lastAttackerId = gs.lastPlay?.playerId;
    // The winner is the last attacker, OR if they finished, the person who would have been next
    let nextStarterIdx = lastAttackerId ? gs.players.findIndex(p => p.id === lastAttackerId) : -1;

    // If attacker is finished or missing, find next non-finished player
    if (nextStarterIdx === -1 || gs.players[nextStarterIdx].finished) {
      let searchIdx = playerIdx; // start from person who just passed
      for (let i = 0; i < gs.players.length; i++) {
        searchIdx = (searchIdx + 1) % gs.players.length;
        if (!gs.players[searchIdx].finished) {
          nextStarterIdx = searchIdx;
          break;
        }
      }
    }

    // Reset round state for new lead
    gs.players.forEach(p => { if (!p.finished) p.passed = false; });
    gs.lastPlay = null;
    gs.roundStarter = nextStarterIdx;
    gs.currentPlayerIndex = nextStarterIdx;
    
    await saveRoom(room);
    // Broadcast update (strips hands for security)
    await broadcast(code, 'game_state', { gameState: getPublicGameState(gs, '') });
    return { gameState: getPublicGameState(gs, playerId) };
  }

  advanceTurn(gs);
  await saveRoom(room);
  // Broadcast update (strips hands for security)
  await broadcast(code, 'game_state', { gameState: getPublicGameState(gs, '') });
  return { gameState: getPublicGameState(gs, playerId) };
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

export async function leaveRoom(code: string, playerId: string): Promise<{ success: boolean; error?: string }> {
  const room = await getRoom(code);
  if (!room) return { success: true }; // Already gone

  if (room.hostId === playerId) {
    // Admin is leaving: Dissolve the room
    await deleteRoom(code);
    await broadcast(code, 'room_dissolved', { message: 'The host has closed the room.' });
    return { success: true };
  }

  // Regular player is leaving: Remove them
  room.players = room.players.filter(p => p.id !== playerId);
  if (room.gameState) {
    room.gameState.players = room.gameState.players.map(p => 
      p.id === playerId ? { ...p, connected: false } : p
    );
  }
  
  await saveRoom(room);
  await broadcast(code, 'room_state', { room: getPublicRoomState(room, '') });
  return { success: true };
}
