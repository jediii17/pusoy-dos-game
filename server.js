// Custom Node.js server: hosts Next.js + WebSocket on the same port
// Run with: node server.js

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ── In-process room store & game engine ─────────────────
// We import compiled JS (TS compiled by Next.js). Because this runs as CommonJS
// we use a dynamic require wrapper. However, since Next.js doesn't compile lib/
// separately, we need to use ts-node or compile first. Instead, we'll duplicate
// the store logic here in plain JS for the server process.

// ────────────────── CARD / GAME ENGINE (JS) ──────────────
const RANK_ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUIT_ORDER = ['clubs', 'spades', 'hearts', 'diamonds'];

function rankValue(r) { return RANK_ORDER.indexOf(r); }
function suitValue(s) { return SUIT_ORDER.indexOf(s); }
function cardValue(c) { return rankValue(c.rank) * 4 + suitValue(c.suit); }
function compareCards(a, b) { return cardValue(a) - cardValue(b); }

function createDeck() {
    const deck = [];
    for (const rank of RANK_ORDER)
        for (const suit of SUIT_ORDER)
            deck.push({ rank, suit, id: `${rank}_${suit}` });
    return deck;
}

function shuffleDeck(deck) {
    const d = [...deck];
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
}

function dealCards(playerCount) {
    const deck = shuffleDeck(createDeck());
    const hands = [];
    if (playerCount === 4) {
        for (let i = 0; i < 4; i++) hands.push(deck.slice(i * 13, (i + 1) * 13));
        return { hands, aside: null };
    } else {
        for (let i = 0; i < 3; i++) hands.push(deck.slice(i * 17, (i + 1) * 17));
        return { hands, aside: deck[51] };
    }
}

function findStartingPlayer(hands) {
    for (let i = 0; i < hands.length; i++)
        if (hands[i].some(c => c.rank === '3' && c.suit === 'clubs')) return i;
    return 0;
}

function rankGroups(cards) {
    const g = new Map();
    for (const c of cards) {
        if (!g.has(c.rank)) g.set(c.rank, []);
        g.get(c.rank).push(c);
    }
    return g;
}

function sorted(cards) { return [...cards].sort(compareCards); }

function isStraight(cards) {
    if (cards.length !== 5) return false;
    const s = sorted(cards);
    for (let i = 1; i < 5; i++) {
        const prev = RANK_ORDER.indexOf(s[i - 1].rank);
        const curr = RANK_ORDER.indexOf(s[i].rank);
        if (curr - prev !== 1) return false;
    }
    return true;
}

function isFlush(cards) { return cards.length === 5 && cards.every(c => c.suit === cards[0].suit); }

function isFullHouse(cards) {
    if (cards.length !== 5) return false;
    const g = rankGroups(cards);
    const sizes = [...g.values()].map(v => v.length).sort();
    return sizes[0] === 2 && sizes[1] === 3;
}

function isFourOfAKind(cards) {
    if (cards.length !== 5) return false;
    const g = rankGroups(cards);
    return [...g.values()].some(v => v.length === 4);
}

function getComboType(cards) {
    const n = cards.length;
    if (n === 1) return 'single';
    if (n === 2) return rankGroups(cards).size === 1 ? 'pair' : null;
    if (n === 3) return rankGroups(cards).size === 1 ? 'triple' : null;
    if (n === 5) {
        if (isStraight(cards) && isFlush(cards)) return 'straightflush';
        if (isFourOfAKind(cards)) return 'fourofakind';
        if (isFullHouse(cards)) return 'fullhouse';
        if (isFlush(cards)) return 'flush';
        if (isStraight(cards)) return 'straight';
        return null;
    }
    return null;
}

const FIVE_CARD_RANK = ['straight', 'flush', 'fullhouse', 'fourofakind', 'straightflush'];

function compareByHighestCard(a, b) {
    const sa = sorted(a); const sb = sorted(b);
    for (let i = 4; i >= 0; i--) {
        const diff = compareCards(sa[i], sb[i]);
        if (diff !== 0) return diff;
    }
    return 0;
}

function fullHouseKey(cards) {
    const g = rankGroups(cards);
    for (const [, v] of g) if (v.length === 3) return v[0];
}

function fourOfAKindKey(cards) {
    const g = rankGroups(cards);
    for (const [, v] of g) if (v.length === 4) return v[0];
}

function compareFiveCard(a, b) {
    const ta = FIVE_CARD_RANK.indexOf(a.type);
    const tb = FIVE_CARD_RANK.indexOf(b.type);
    if (ta !== tb) return ta - tb;
    switch (a.type) {
        case 'straight': case 'flush': case 'straightflush':
            return compareByHighestCard(a.cards, b.cards);
        case 'fullhouse':
            return compareCards(fullHouseKey(a.cards), fullHouseKey(b.cards));
        case 'fourofakind':
            return compareCards(fourOfAKindKey(a.cards), fourOfAKindKey(b.cards));
        default: return 0;
    }
}

function compareHands(a, b) {
    if (a.type !== b.type) return NaN;
    switch (a.type) {
        case 'single': return compareCards(a.cards[0], b.cards[0]);
        case 'pair': case 'triple': {
            const rd = rankValue(a.cards[0].rank) - rankValue(b.cards[0].rank);
            if (rd !== 0) return rd;
            return suitValue(sorted(a.cards).at(-1).suit) - suitValue(sorted(b.cards).at(-1).suit);
        }
        default: return compareFiveCard(a, b);
    }
}

function canBeat(current, attempt) {
    if (current.type !== attempt.type) return false;
    const cmp = compareHands(attempt, current);
    return !isNaN(cmp) && cmp > 0;
}

function isValidFirstPlay(cards) {
    return cards.some(c => c.rank === '3' && c.suit === 'clubs');
}

// ────────────────── ROOM STORE (JS) ______________________
const rooms = new Map();

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function getPublicGameState(gs, requestingPlayerId) {
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

function advanceTurn(gs) {
    const total = gs.players.length;
    let next = (gs.currentPlayerIndex + 1) % total;
    for (let attempts = 0; attempts < total; attempts++) {
        const p = gs.players[next];
        if (!p.finished && !p.passed) { gs.currentPlayerIndex = next; return; }
        next = (next + 1) % total;
    }
}

// Returns { ok: true, gameState } or { ok: false, error }
function doPlayCards(roomCode, playerId, cardIds) {
    const room = rooms.get(roomCode);
    if (!room || !room.gameState) return { ok: false, error: 'Game not found' };
    const gs = room.gameState;
    const playerIdx = gs.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1) return { ok: false, error: 'Player not in game' };
    if (playerIdx !== gs.currentPlayerIndex) return { ok: false, error: 'Not your turn' };

    const player = gs.players[playerIdx];
    const playedCards = cardIds.map(id => player.hand.find(c => c.id === id)).filter(Boolean);
    if (playedCards.length !== cardIds.length) return { ok: false, error: 'Invalid card selection' };

    const comboType = getComboType(playedCards);
    if (!comboType) return { ok: false, error: 'Invalid combination' };

    if (gs.isFirstPlay && !isValidFirstPlay(playedCards))
        return { ok: false, error: 'First play must include the 3 of Clubs' };

    if (gs.lastPlay !== null) {
        const currentCombo = { type: gs.lastPlay.comboType, cards: gs.lastPlay.cards };
        const attemptCombo = { type: comboType, cards: playedCards };
        if (!canBeat(currentCombo, attemptCombo))
            return { ok: false, error: 'Must play a higher combination of the same type' };
    }

    player.hand = player.hand.filter(c => !cardIds.includes(c.id));
    gs.lastPlay = { playerId, playerName: player.name, cards: playedCards, comboType };
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
            return { ok: true, gameState: gs };
        }
    }

    advanceTurn(gs);
    return { ok: true, gameState: gs };
}

function doPassTurn(roomCode, playerId) {
    const room = rooms.get(roomCode);
    if (!room || !room.gameState) return { ok: false, error: 'Game not found' };
    const gs = room.gameState;
    const playerIdx = gs.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1) return { ok: false, error: 'Player not in game' };
    if (playerIdx !== gs.currentPlayerIndex) return { ok: false, error: 'Not your turn' };
    if (gs.lastPlay === null) return { ok: false, error: 'Cannot pass when you are the round starter' };

    gs.players[playerIdx].passed = true;
    const activePlayers = gs.players.filter(p => !p.finished && !p.passed);
    if (activePlayers.length === 0) {
        const lastPlayerId = gs.lastPlay.playerId;
        const roundStarterIdx = gs.players.findIndex(p => p.id === lastPlayerId);
        gs.players.forEach(p => { if (!p.finished) p.passed = false; });
        gs.lastPlay = null;
        gs.roundStarter = roundStarterIdx;
        gs.currentPlayerIndex = roundStarterIdx;
        return { ok: true, gameState: gs };
    }
    advanceTurn(gs);
    return { ok: true, gameState: gs };
}

// ────────────────── WS CLIENT MAP ───────────────────────
// rooms_ws: roomCode → Map<playerId, WebSocket>
const roomWsMap = new Map();

function broadcast(roomCode, message, excludePlayerId = null) {
    const clients = roomWsMap.get(roomCode);
    if (!clients) return;
    const room = rooms.get(roomCode);
    for (const [pid, ws] of clients) {
        if (pid === excludePlayerId) continue;
        if (ws.readyState === 1) { // OPEN
            // Send game state tailored to each player
            if (message.type === 'game_state' || message.type === 'game_over') {
                const personalised = {
                    ...message,
                    gameState: room?.gameState ? getPublicGameState(room.gameState, pid) : null,
                };
                ws.send(JSON.stringify(personalised));
            } else {
                ws.send(JSON.stringify(message));
            }
        }
    }
}

function sendToPlayer(roomCode, playerId, message) {
    const clients = roomWsMap.get(roomCode);
    if (!clients) return;
    const ws = clients.get(playerId);
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(message));
}

// ────────────────── SERVER START ────────────────────────
app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        const parsedUrl = parse(req.url, true);
        const { pathname } = parsedUrl;

        // Handle room creation directly to share the 'rooms' Map
        if (pathname === '/api/rooms' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const { maxPlayers, playerName } = JSON.parse(body);
                    const code = generateCode();
                    const playerId = uuidv4();

                    rooms.set(code, {
                        code,
                        maxPlayers,
                        hostId: playerId,
                        players: [{ id: playerId, name: playerName, connected: false, position: 0 }],
                        gameState: null,
                        createdAt: Date.now()
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ code, playerId, playerName, maxPlayers }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request' }));
                }
            });
            return;
        }

        await handle(req, res, parsedUrl);
    });

    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', (ws, req, { roomCode, playerId, playerName }) => {
        // Track client
        if (!roomWsMap.has(roomCode)) roomWsMap.set(roomCode, new Map());
        roomWsMap.get(roomCode).set(playerId, ws);

        console.log(`[WS] Player "${playerName}" (${playerId}) connected to room ${roomCode}`);

        // Join or create room
        const room = rooms.get(roomCode);
        if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
            ws.close();
            return;
        }

        // Mark player connected
        const existingPlayer = room.players.find(p => p.id === playerId);
        if (existingPlayer) {
            existingPlayer.connected = true;
            if (room.gameState) {
                const gp = room.gameState.players.find(p => p.id === playerId);
                if (gp) gp.connected = true;
            }
        }

        // Send current room state to joining player
        ws.send(JSON.stringify({
            type: 'room_state',
            room: {
                code: room.code,
                maxPlayers: room.maxPlayers,
                hostId: room.hostId,
                players: room.players,
                gameState: room.gameState ? getPublicGameState(room.gameState, playerId) : null,
            },
        }));

        // Notify others
        broadcast(roomCode, { type: 'player_joined', player: existingPlayer || { id: playerId, name: playerName }, players: room.players }, playerId);

        ws.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw.toString()); } catch { return; }

            if (msg.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }

            if (msg.type === 'start_game') {
                if (room.hostId !== playerId) { ws.send(JSON.stringify({ type: 'error', message: 'Only the host can start the game' })); return; }
                if (room.players.length < 3) { ws.send(JSON.stringify({ type: 'error', message: 'Need at least 3 players' })); return; }
                if (room.gameState?.phase === 'playing') { ws.send(JSON.stringify({ type: 'error', message: 'Game already started' })); return; }

                const deal = dealCards(room.players.length);
                const startIdx = findStartingPlayer(deal.hands);
                const gamePlayers = room.players.map((p, i) => ({
                    ...p, hand: deal.hands[i], passed: false, finished: false, finishOrder: 0,
                }));
                room.gameState = {
                    phase: 'playing',
                    players: gamePlayers,
                    currentPlayerIndex: startIdx,
                    lastPlay: null,
                    roundStarter: startIdx,
                    isFirstPlay: true,
                    finishedCount: 0,
                    aside: deal.aside,
                    maxPlayers: room.players.length,
                };
                broadcast(roomCode, { type: 'game_state', gameState: room.gameState });
                return;
            }

            if (msg.type === 'play_cards') {
                const result = doPlayCards(roomCode, playerId, msg.cardIds || []);
                if (!result.ok) { ws.send(JSON.stringify({ type: 'error', message: result.error })); return; }
                if (result.gameState.phase === 'finished') {
                    broadcast(roomCode, { type: 'game_over', gameState: result.gameState });
                } else {
                    broadcast(roomCode, { type: 'game_state', gameState: result.gameState });
                }
                return;
            }

            if (msg.type === 'pass') {
                const result = doPassTurn(roomCode, playerId);
                if (!result.ok) { ws.send(JSON.stringify({ type: 'error', message: result.error })); return; }
                broadcast(roomCode, { type: 'game_state', gameState: result.gameState });
                return;
            }
        });

        ws.on('close', () => {
            console.log(`[WS] Player "${playerName}" (${playerId}) disconnected from room ${roomCode}`);
            const r = rooms.get(roomCode);
            if (r) {
                const p = r.players.find(x => x.id === playerId);
                if (p) p.connected = false;
                if (r.gameState) {
                    const gp = r.gameState.players.find(x => x.id === playerId);
                    if (gp) gp.connected = false;
                }
                broadcast(roomCode, { type: 'player_left', playerId });
            }
        });
    });

    server.on('upgrade', (req, socket, head) => {
        const { pathname, query } = parse(req.url, true);
        if (pathname === '/ws') {
            const roomCode = query.room;
            const playerId = query.player;
            const playerName = query.name || 'Player';
            if (!roomCode || !playerId) { socket.destroy(); return; }
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit('connection', ws, req, { roomCode, playerId, playerName });
            });
        } else {
            socket.destroy();
        }
    });

    server.listen(port, () => {
        console.log(`> Pusoy Dos server ready on http://${hostname}:${port}`);
    });
});
