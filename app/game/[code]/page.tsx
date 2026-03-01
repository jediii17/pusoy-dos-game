'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CardComponent from '@/components/Card';
import PlayerSeat from '@/components/PlayerSeat';
import LastPlayArea from '@/components/LastPlayArea';

import { usePusher } from '@/app/hooks/usePusher';
import { 
  Trophy, Sun, Moon, Play, SkipForward, 
  RotateCcw, Home, LayoutGrid, Users, 
  ArrowRight, CreditCard, User
} from 'lucide-react';

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
  const [darkMode, setDarkMode] = useState(false);

  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') || '' : '';
  const playerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') || '' : '';

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const onPusherMessage = useCallback((msg: any) => {
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
  }, [code, router]);

  const { sendAction } = usePusher(code, onPusherMessage);

  // Fetch initial game state
  useEffect(() => {
    if (!code || !playerId) return;
    const fetchState = async () => {
      const resp = await sendAction('get_state');
      if (resp.room?.gameState) {
        setGameState(resp.room.gameState);
      } else if (resp.error) {
        setError(resp.error);
      }
    };
    fetchState();
  }, [code, playerId, sendAction]);

  function toggleCard(cardId: string) {
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
      return next;
    });
  }

  async function playCards() {
    if (selectedCards.size === 0) { setError('Select cards to play'); return; }
    const resp = await sendAction('play', { cardIds: Array.from(selectedCards) });
    if (resp.error) {
      setError(resp.error);
      setTimeout(() => setError(''), 3000);
    } else {
      setSelectedCards(new Set());
    }
  }

  async function pass() {
    const resp = await sendAction('pass');
    if (resp.error) {
      setError(resp.error);
      setTimeout(() => setError(''), 3000);
    } else {
      setSelectedCards(new Set());
    }
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
          <span style={{ color: 'var(--accent)' }}>🃏</span>
          <span style={{ fontFamily: 'var(--font-fredoka)' }}>Pusoy Dos</span>
        </div>
        <div className="game-header-info">
          {isMyTurn && !iAmFinished && !iAmPassed && (
            <span className="your-turn-badge">
              <Play size={12} fill="currentColor" />
              <span>YOUR TURN</span>
            </span>
          )}
          {currentPlayer && !isMyTurn && (
            <span className="other-turn-badge">
              <User size={12} />
              <span>{currentPlayer.name}'s Turn</span>
            </span>
          )}
          {iAmPassed && <span className="passed-badge">You Passed</span>}
          {iAmFinished && (
            <span className="finished-badge">
              <Trophy size={12} />
              <span>Finished #{me?.finishOrder}!</span>
            </span>
          )}
        </div>
        <button className="dark-toggle" onClick={() => setDarkMode(d => !d)}>
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
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
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <SkipForward size={18} />
            <span>Pass</span>
          </button>
          <button
            className="play-btn"
            style={{ 
               background: !isMyTurn || iAmFinished || selectedCards.size === 0 ? '#02241a' : 'var(--accent)',
               color: !isMyTurn || iAmFinished || selectedCards.size === 0 ? '#1a3a2e' : '#000',
               boxShadow: !isMyTurn || iAmFinished || selectedCards.size === 0 ? 'none' : '0 10px 30px var(--accent-glow)',
               opacity: 1,
               display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
            onClick={playCards}
            disabled={!isMyTurn || iAmFinished || selectedCards.size === 0}
          >
            <Play size={18} fill="currentColor" />
            <span>Play ({selectedCards.size})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
