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
  ArrowRight, CreditCard, User, LogOut
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
  const [isDissolved, setIsDissolved] = useState(false);

  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') || '' : '';
  const playerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') || '' : '';

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const onPusherMessage = useCallback((msg: any) => {
    if (msg.type === 'game_state' || msg.type === 'game_over') {
      setGameState(prev => {
        if (!prev) return msg.gameState;
        const newPlayers = msg.gameState.players.map((p: any) => {
          if (p.id === playerId) {
            const incomingHand = p.hand;
            const existingHand = prev.players.find(oldP => oldP.id === playerId)?.hand;
            return { ...p, hand: incomingHand !== undefined ? incomingHand : existingHand };
          }
          return p;
        });
        return { ...msg.gameState, players: newPlayers };
      });
      if (msg.type === 'game_over') {
        setTimeout(() => router.push(`/gameover/${code}`), 2000);
      }
      setError('');
    } else if (msg.type === 'room_state') {
      if (msg.room.gameState) {
        setGameState(prev => {
          if (!prev) return msg.room.gameState;
          const newPlayers = msg.room.gameState.players.map((p: any) => {
            if (p.id === playerId) {
              const incomingHand = p.hand;
              const existingHand = prev.players.find(oldP => oldP.id === playerId)?.hand;
              return { ...p, hand: incomingHand !== undefined ? incomingHand : existingHand };
            }
            return p;
          });
          return { ...msg.room.gameState, players: newPlayers };
        });
      } else {
        router.push(`/room/${code}`);
      }
    } else if (msg.type === 'error') {
      setError(msg.message);
      setTimeout(() => setError(''), 3000);
    } else if (msg.type === 'player_left') {
      showNotif('A player disconnected');
    } else if (msg.type === 'room_dissolved') {
      setIsDissolved(true);
    }
  }, [code, router, playerId, showNotif]);

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
    
    // Optimistic local update
    const playedIds = Array.from(selectedCards);
    setGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map(p => {
          if (p.id === playerId) {
            return {
              ...p,
              hand: p.hand?.filter(c => !selectedCards.has(c.id)),
              cardCount: p.cardCount - selectedCards.size
            };
          }
          return p;
        })
      };
    });
    setSelectedCards(new Set());

    const resp = await sendAction('play', { cardIds: playedIds });
    if (resp.error) {
      setError(resp.error);
      setTimeout(() => setError(''), 3000);
      // Re-fetch state on error to sync back
      const syncResp = await sendAction('get_state');
      if (syncResp.room?.gameState) setGameState(syncResp.room.gameState);
    } else if (resp.gameState) {
      setGameState(resp.gameState);
    }
  }

  async function pass() {
    const resp = await sendAction('pass');
    if (resp.error) {
      setError(resp.error);
      setTimeout(() => setError(''), 3000);
    } else if (resp.gameState) {
      setGameState(resp.gameState);
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
  // In a new round (lastPlay is null), nobody should be in a passed state.
  // This is a client-side safety net in case the server state hasn't fully propagated.
  const iAmPassed = gameState.lastPlay === null ? false : (me?.passed || false);

  // Arrange opponents by position: top, left, right
  // Arrange opponents by position relative to 'me'
  const getOpponentLayout = () => {
    const totalPlayers = gameState.players.length;
    
    // Sort all players by position
    const allPlayersSorted = [...gameState.players].sort((a, b) => a.position - b.position);
    
    // Find my index in the sorted list
    const myIndex = allPlayersSorted.findIndex(p => p.id === playerId);
    
    // Get others in order starting after me (wrap around)
    const othersOrdered = [];
    for (let i = 1; i < totalPlayers; i++) {
        othersOrdered.push(allPlayersSorted[(myIndex + i) % totalPlayers]);
    }

    if (totalPlayers === 4) {
      // 4 players: Left, Top, Right
      return [
        { player: othersOrdered[0], layout: 'left' as const },
        { player: othersOrdered[1], layout: 'top' as const },
        { player: othersOrdered[2], layout: 'right' as const },
      ];
    } else if (totalPlayers === 3) {
      // 3 players: Left, Right (skip Top)
      return [
        { player: othersOrdered[0], layout: 'left' as const },
        { player: othersOrdered[1], layout: 'right' as const },
      ];
    } else {
      // 2 players: Top
      return [
        { player: othersOrdered[0], layout: 'top' as const },
      ];
    }
  };

  const activePlayers = gameState.players.filter(p => !p.finished);
  const minCards = activePlayers.length > 0 ? Math.min(...activePlayers.map(p => p.cardCount)) : 99;
  
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
    <div className="game-root">
      <div className="floating-game-info">
        <div className="floating-logo">Pusoy Dos</div>
        <div className="floating-turn-info">
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
      </div>
      {/* Mobile Landscape Orientation Lock */}
      <div className="landscape-overlay">
        <div className="landscape-content">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-icon">
            <rect x="2" y="6" width="20" height="12" rx="2" transform="rotate(90 12 12)" />
            <path d="M12 2A10 10 0 0 1 22 12" />
            <polygon points="22 12 18 10 18 14 22 12" />
          </svg>
          <h2 style={{ fontFamily: 'var(--font-fredoka)', fontSize: '2rem', marginTop: '1rem', color: 'white' }}>Rotate Device</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem' }}>Please rotate your phone to landscape mode for the best playing experience.</p>
        </div>
      </div>



      {/* Game Table Wrapper */}
      <div className="game-table-container">
        <div className="game-table">
          <div className="table-felt">
            {/* Center: Last Play */}
            <div className="game-center">
              <LastPlayArea lastPlay={gameState.lastPlay} isFirstPlay={gameState.isFirstPlay} />
            </div>
          </div>
        </div>

        {/* Opponents (Placed as direct children of grid-container) */}
        {opponentLayouts.map(({ player, layout }) => (
          <PlayerSeat
            key={player.id}
            player={player}
            layout={layout}
            isCurrentTurn={gameState.players[gameState.currentPlayerIndex]?.id === player.id}
            isWinning={player.cardCount === minCards && player.cardCount > 0}
            isNewRound={gameState.lastPlay === null}
          />
        ))}
      </div>

      {/* Notifications */}
      {notification && <div className="game-notification">{notification}</div>}
      {error && <div className="game-error-toast">{error}</div>}

      {/* Player Hand */}
      <div className="player-area">
 
        {/* Action bar (Now with Sort buttons) */}
        <div className="action-bar">
          <div className="player-info-bar">
            <div className="player-avatar-sm" style={{ position: 'relative' }}>
              {playerName[0]?.toUpperCase()}
              {me?.cardCount === minCards && me?.cardCount > 0 && (
                <div className="winning-crown self-winning">
                  <Trophy size={14} fill="#FFD700" color="#FFD700" />
                </div>
              )}
            </div>
            <div className="player-text-info">
              <span className="player-name-label">{playerName}</span>
              <span className="player-card-count">+{myHand.length} Cards</span>
            </div>
          </div>

          <div className="sort-group">
            <button className={`sort-btn ${sortMode === 'rank' ? 'active' : ''}`} onClick={() => setSortMode('rank')}>Rank</button>
            <button className={`sort-btn ${sortMode === 'suit' ? 'active' : ''}`} onClick={() => setSortMode('suit')}>Suit</button>
          </div>

          <div className="button-divider"></div>

          <button
            className="pass-btn"
            onClick={pass}
            disabled={!isMyTurn || iAmFinished || iAmPassed || gameState.lastPlay === null}
          >
            <SkipForward size={16} />
            <span>Pass</span>
          </button>
          <button
            className="play-btn"
            style={{ 
               background: !isMyTurn || iAmFinished || selectedCards.size === 0 ? '#02241a' : 'var(--accent)',
               color: !isMyTurn || iAmFinished || selectedCards.size === 0 ? '#1a3a2e' : '#000',
               boxShadow: !isMyTurn || iAmFinished || selectedCards.size === 0 ? 'none' : '0 8px 20px var(--accent-glow)',
               opacity: 1
            }}
            onClick={playCards}
            disabled={!isMyTurn || iAmFinished || selectedCards.size === 0}
          >
            <Play size={16} fill="currentColor" />
            <span>Play ({selectedCards.size})</span>
          </button>
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

      </div>

      {isDissolved && (
        <div className="modal-overlay">
          <div className="custom-modal">
            <div className="modal-icon-container">
              <LogOut size={32} />
            </div>
            <h2 className="modal-title">Room Closed</h2>
            <p className="modal-description">
              The host has left and the room is now closed.
            </p>
            <button className="primary-btn" onClick={() => router.push('/')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <ArrowRight size={18} />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
