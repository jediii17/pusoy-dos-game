// In-memory room store — data is lost on server restart (accepted requirement)
import { Card, DealResult, dealCards, findStartingPlayer } from './game-engine';

export type GamePhase = 'waiting' | 'playing' | 'finished';

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  position: number; // 0-based seat index
}

export interface GamePlayer extends Player {
  hand: Card[];
  passed: boolean;       // passed this round
  finished: boolean;     // already played all cards
  finishOrder: number;   // 1=first, 2=second, etc.
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
  currentPlayerIndex: number;  // whose turn it is
  lastPlay: LastPlay | null;
  roundStarter: number;         // who started the current round
  isFirstPlay: boolean;         // very first play of the game (must include 3♣)
  finishedCount: number;
  aside: Card | null;           // set-aside card for 3-player games
  maxPlayers: 3 | 4;
}

export interface Room {
  code: string;
  maxPlayers: 3 | 4;
  hostId: string;
  players: Player[];            // lobby players before game starts
  gameState: GameState | null;
  createdAt: number;
}

const rooms = new Map<string, Room>();

export function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createRoom(maxPlayers: 3 | 4, hostId: string, hostName: string): Room {
  let code: string;
  do { code = generateCode(); } while (rooms.has(code));

  const host: Player = { id: hostId, name: hostName, connected: true, position: 0 };
  const room: Room = {
    code,
    maxPlayers,
    hostId,
    players: [host],
    gameState: null,
    createdAt: Date.now(),
  };
  rooms.set(code, room);

  // Clean up old rooms after 2 hours
  setTimeout(() => rooms.delete(code), 2 * 60 * 60 * 1000);

  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function joinRoom(code: string, playerId: string, playerName: string): { room: Room; error?: string } {
  const room = rooms.get(code);
  if (!room) return { room: undefined as unknown as Room, error: 'Room not found' };
  if (room.gameState && room.gameState.phase === 'playing') {
    return { room, error: 'Game already in progress' };
  }
  if (room.players.length >= room.maxPlayers) {
    return { room, error: 'Room is full' };
  }
  // Check if player already exists (reconnect)
  const existing = room.players.find(p => p.id === playerId);
  if (existing) {
    existing.connected = true;
    return { room };
  }
  const position = room.players.length;
  room.players.push({ id: playerId, name: playerName, connected: true, position });
  return { room };
}

export function startGame(code: string): { gameState: GameState; error?: string } {
  const room = rooms.get(code);
  if (!room) return { gameState: undefined as unknown as GameState, error: 'Room not found' };
  if (room.players.length < 3) return { gameState: undefined as unknown as GameState, error: 'Need at least 3 players' };

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
  return { gameState };
}

export function playCards(
  code: string,
  playerId: string,
  cardIds: string[],
): { gameState: GameState; error?: string } {
  const room = rooms.get(code);
  if (!room || !room.gameState) return { gameState: undefined as unknown as GameState, error: 'Game not found' };
  const gs = room.gameState;
  const playerIdx = gs.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) return { gameState: gs, error: 'Player not in game' };
  if (playerIdx !== gs.currentPlayerIndex) return { gameState: gs, error: 'Not your turn' };

  const player = gs.players[playerIdx];
  // Find cards in player's hand
  const playedCards = cardIds.map(id => player.hand.find(c => c.id === id)).filter(Boolean) as Card[];
  if (playedCards.length !== cardIds.length) return { gameState: gs, error: 'Invalid card selection' };

  // Dynamic import to avoid circular — use require pattern
  const { getComboType, canBeat, isValidFirstPlay } = require('./game-engine') as typeof import('./game-engine');

  const comboType = getComboType(playedCards);
  if (!comboType) return { gameState: gs, error: 'Invalid combination' };

  // First play of the game must include 3♣
  if (gs.isFirstPlay && !isValidFirstPlay(playedCards)) {
    return { gameState: gs, error: 'First play must include the 3 of Clubs' };
  }

  // Must beat current play (unless starting a new round)
  if (gs.lastPlay !== null) {
    const currentCombo = { type: gs.lastPlay.comboType as import('./game-engine').ComboType, cards: gs.lastPlay.cards };
    const attemptCombo = { type: comboType, cards: playedCards };
    if (!canBeat(currentCombo, attemptCombo)) {
      return { gameState: gs, error: 'Must play a higher combination of the same type' };
    }
  }

  // Remove played cards from hand
  player.hand = player.hand.filter(c => !cardIds.includes(c.id));

  gs.lastPlay = {
    playerId,
    playerName: player.name,
    cards: playedCards,
    comboType,
  };
  gs.isFirstPlay = false;

  // Check if player finished
  if (player.hand.length === 0) {
    player.finished = true;
    gs.finishedCount += 1;
    player.finishOrder = gs.finishedCount;

    // Game over when all but one player has finished (or all finished)
    const activePlayers = gs.players.filter(p => !p.finished);
    if (activePlayers.length <= 1) {
      // Mark remaining players with finish order
      if (activePlayers.length === 1) {
        gs.finishedCount += 1;
        activePlayers[0].finishOrder = gs.finishedCount;
        activePlayers[0].finished = true;
      }
      gs.phase = 'finished';
      return { gameState: gs };
    }
  }

  // Advance turn (skip finished/passed players)
  _advanceTurn(gs);
  return { gameState: gs };
}

export function passTurn(
  code: string,
  playerId: string,
): { gameState: GameState; error?: string } {
  const room = rooms.get(code);
  if (!room || !room.gameState) return { gameState: undefined as unknown as GameState, error: 'Game not found' };
  const gs = room.gameState;
  const playerIdx = gs.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) return { gameState: gs, error: 'Player not in game' };
  if (playerIdx !== gs.currentPlayerIndex) return { gameState: gs, error: 'Not your turn' };
  if (gs.lastPlay === null) return { gameState: gs, error: 'Cannot pass when you are the round starter' };

  gs.players[playerIdx].passed = true;

  // Check if all remaining active players have passed → the last player who played starts a new round
  const activePlayers = gs.players.filter(p => !p.finished && !p.passed);
  if (activePlayers.length === 0) {
    // New round: reset passes, last player who played gets the lead
    const lastPlayerId = gs.lastPlay!.playerId;
    const roundStarterIdx = gs.players.findIndex(p => p.id === lastPlayerId);

    gs.players.forEach(p => { if (!p.finished) p.passed = false; });
    gs.lastPlay = null;
    gs.roundStarter = roundStarterIdx;
    gs.currentPlayerIndex = roundStarterIdx;
    return { gameState: gs };
  }

  _advanceTurn(gs);
  return { gameState: gs };
}

function _advanceTurn(gs: GameState): void {
  const total = gs.players.length;
  let next = (gs.currentPlayerIndex + 1) % total;
  let attempts = 0;
  while (attempts < total) {
    const p = gs.players[next];
    if (!p.finished && !p.passed) {
      gs.currentPlayerIndex = next;
      return;
    }
    next = (next + 1) % total;
    attempts++;
  }
}

export function playerDisconnect(code: string, playerId: string): Room | undefined {
  const room = rooms.get(code);
  if (!room) return undefined;
  const p = room.players.find(x => x.id === playerId);
  if (p) p.connected = false;
  if (room.gameState) {
    const gp = room.gameState.players.find(x => x.id === playerId);
    if (gp) gp.connected = false;
  }
  return room;
}
