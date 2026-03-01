'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CardComponent from '@/components/Card';
import PlayerSeat from '@/components/PlayerSeat';
import LastPlayArea from '@/components/LastPlayArea';

interface Card { rank: string; suit: string; id: string; }
interface GamePlayer {
  id: string; name: string; connected: boolean; position: number;
  cardCount: number; passed: boolean; finished: boolean; finishOrder: number;
  hand?: Card[];
}
interface LastPlay { playerId: string; playerName: string; cards: Card[]; comboType: string; }
interface GameState {
  phase: string;
  players: GamePlayer[];
  currentPlayerIndex: number;
  lastPlay: LastPlay | null;
  roundStarter: number;
  isFirstPlay: boolean;
  finishedCount: number;
  aside: Card | null;
  maxPlayers: number;
}

const COMBO_LABELS: Record<string, string> = {
  single: 'Single', pair: 'Pair', triple: 'Three of a Kind',
  straight: 'Straight', flush: 'Flush', fullhouse: 'Full House',
  fourofakind: 'Four of a Kind', straightflush: 'Straight Flush',
};

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<'rank' | 'suit'>('rank');
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') || '' : '';
  const playerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') || '' : '';

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const connect = useCallback(() => {
    if (!playerId || !playerName || !code) return;
    const wsUrl = `ws://${window.location.host}/ws?room=${code}&player=${playerId}&name=${encodeURIComponent(playerName)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'game_state') {
          setGameState(msg.gameState);
          setError('');
        } else if (msg.type === 'game_over') {
          setGameState(msg.gameState);
          setTimeout(() => router.push(`/gameover/${code}`), 2000);
        } else if (msg.type === 'room_state') {
          if (msg.room.gameState) setGameState(msg.room.gameState);
          else router.push(`/room/${code}`);
        } else if (msg.type === 'error') {
          setError(msg.message);
          setTimeout(() => setError(''), 3000);
        } else if (msg.type === 'player_left') {
          showNotif('A player disconnected');
        }
      } catch {}
    };

    ws.onerror = () => setError('Connection lost. Reconnecting…');
    ws.onclose = () => {
      setTimeout(connect, 2000);
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 25000);
    return () => clearInterval(ping);
  }, [playerId, playerName, code, router]);

  useEffect(() => {
    const cleanup = connect();
    return () => { cleanup?.(); wsRef.current?.close(); };
  }, [connect]);

  function toggleCard(cardId: string) {
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
      return next;
    });
  }

  function playCards() {
    if (selectedCards.size === 0) { setError('Select cards to play'); return; }
    wsRef.current?.send(JSON.stringify({ type: 'play_cards', cardIds: Array.from(selectedCards) }));
    setSelectedCards(new Set());
  }

  function pass() {
    wsRef.current?.send(JSON.stringify({ type: 'pass' }));
    setSelectedCards(new Set());
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !gameState) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Connecting to game…</p>
      </div>
    );
  }

  const me = gameState.players.find(p => p.id === playerId);
  const myHand = me?.hand || [];
  const opponents = gameState.players.filter(p => p.id !== playerId);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const iAmFinished = me?.finished || false;
  const iAmPassed = me?.passed || false;

  // Arrange opponents by position: top, left, right
  const getOpponentLayout = () => {
    const others = gameState.players.filter(p => p.id !== playerId);
    const myPos = me?.position ?? 0;
    const sorted = [...others].sort((a, b) => a.position - b.position);
    const positions = ['top', 'left', 'right'] as const;
    return sorted.map((p, i) => ({ player: p, layout: positions[i] || 'top' }));
  };

  const opponentLayouts = getOpponentLayout();

  // Sort hand
  const sortedHand = [...myHand].sort((a, b) => {
    const RANK = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
    const SUIT = ['clubs','spades','hearts','diamonds'];
    if (sortMode === 'rank') {
      const rv = RANK.indexOf(a.rank) - RANK.indexOf(b.rank);
      if (rv !== 0) return rv;
      return SUIT.indexOf(a.suit) - SUIT.indexOf(b.suit);
    } else {
      const sv = SUIT.indexOf(a.suit) - SUIT.indexOf(b.suit);
      if (sv !== 0) return sv;
      return RANK.indexOf(a.rank) - RANK.indexOf(b.rank);
    }
  });

  return (
    <div className={`game-root ${darkMode ? 'dark' : ''}`}>
      {/* Header */}
      <header className="game-header">
        <div className="game-header-logo">
          <span>🃏</span>
          <span>Pusoy Dos</span>
        </div>
        <div className="game-header-info">
          {isMyTurn && !iAmFinished && !iAmPassed && (
            <span className="your-turn-badge">YOUR TURN</span>
          )}
          {currentPlayer && !isMyTurn && (
            <span className="other-turn-badge">{currentPlayer.name}'s Turn</span>
          )}
          {iAmPassed && <span className="passed-badge">You Passed</span>}
          {iAmFinished && <span className="finished-badge">You Finished #{me?.finishOrder}!</span>}
        </div>
        <button className="dark-toggle" onClick={() => setDarkMode(d => !d)}>
          {darkMode ? '☀️' : '🌙'}
        </button>
      </header>

      {/* Game Table */}
      <div className="game-table">
        {/* Opponents */}
        {opponentLayouts.map(({ player, layout }) => (
          <PlayerSeat
            key={player.id}
            player={player}
            layout={layout}
            isCurrentTurn={gameState.players[gameState.currentPlayerIndex]?.id === player.id}
          />
        ))}

        {/* Center: Last Play */}
        <div className="game-center">
          <LastPlayArea lastPlay={gameState.lastPlay} isFirstPlay={gameState.isFirstPlay} />
        </div>
      </div>

      {/* Notifications */}
      {notification && <div className="game-notification">{notification}</div>}
      {error && <div className="game-error-toast">{error}</div>}

      {/* Player Hand */}
      <div className="player-area">
        <div className="player-area-header">
          <div className="player-info-bar">
            <div className="player-avatar-sm">{playerName[0]?.toUpperCase()}</div>
            <div>
              <span className="player-name-label">You</span>
              <span className="player-card-count">{myHand.length} Cards</span>
            </div>
          </div>
          <div className="sort-toggle">
            <button className={`sort-btn ${sortMode === 'rank' ? 'active' : ''}`} onClick={() => setSortMode('rank')}>Sort by Rank</button>
            <button className={`sort-btn ${sortMode === 'suit' ? 'active' : ''}`} onClick={() => setSortMode('suit')}>Sort by Suit</button>
          </div>
        </div>

        <div className="hand-container">
          {sortedHand.map(card => (
            <CardComponent
              key={card.id}
              card={card}
              selected={selectedCards.has(card.id)}
              onClick={() => isMyTurn && !iAmFinished ? toggleCard(card.id) : undefined}
              small={myHand.length > 13}
            />
          ))}
          {myHand.length === 0 && !iAmFinished && (
            <p className="empty-hand-msg">You have no cards left!</p>
          )}
        </div>

        {/* Action bar */}
        <div className="action-bar">
          <button
            className="pass-btn"
            onClick={pass}
            disabled={!isMyTurn || iAmFinished || iAmPassed || gameState.lastPlay === null}
          >
            Pass
          </button>
          <button
            className="play-btn"
            onClick={playCards}
            disabled={!isMyTurn || iAmFinished || selectedCards.size === 0}
          >
            Play ({selectedCards.size})
          </button>
        </div>
      </div>
    </div>
  );
}
