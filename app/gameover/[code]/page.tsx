'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { usePusher } from '@/app/hooks/usePusher';
import { Trophy, RotateCcw, Home, Users, ArrowLeft } from 'lucide-react';

interface GamePlayer {
  id: string; name: string; cardCount: number;
  passed: boolean; finished: boolean; finishOrder: number;
}
interface GameState {
  phase: string;
  players: GamePlayer[];
}

export default function GameOverPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;
  const [gameState, setGameState] = useState<GameState | null>(null);

  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') || '' : '';

  const onPusherMessage = useCallback((msg: any) => {
    if (msg.type === 'room_state' && msg.room.gameState) setGameState(msg.room.gameState);
    if (msg.type === 'game_over') setGameState(msg.gameState);
    if (msg.type === 'game_state') setGameState(msg.gameState);
  }, []);

  const { sendAction } = usePusher(code, onPusherMessage);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const fetchState = async () => {
      const resp = await sendAction('get_state');
      if (resp.room?.gameState) setGameState(resp.room.gameState);
    };
    fetchState();
    const stored = sessionStorage.getItem('finalGameState');
    if (stored) { try { setGameState(JSON.parse(stored)); } catch {} }
  }, [sendAction]);

  function playAgain() {
    sessionStorage.removeItem('isHost');
    router.push('/');
  }

  function backToLobby() {
    sessionStorage.removeItem('isHost');
    router.push('/');
  }

  if (!mounted || !gameState) {
    return (
      <div className="gameover-bg">
        <div className="loading-spinner" />
        <p style={{ color: '#fff', marginTop: '1rem' }}>Loading results…</p>
      </div>
    );
  }

  const sorted = [...gameState.players].sort((a, b) => {
    if (a.finishOrder === 0 && b.finishOrder === 0) return b.cardCount - a.cardCount;
    if (a.finishOrder === 0) return 1;
    if (b.finishOrder === 0) return -1;
    return a.finishOrder - b.finishOrder;
  });

  const winner = sorted[0];
  const rankLabels = ['1st', '2nd', '3rd', '4th'];
  const rankColors = ['#fdbf2d', '#C0C0C0', '#CD7F32', '#FF6B6B'];

  return (
    <div className="gameover-bg">
      <div className="gameover-trophy">
        <Trophy size={64} color="var(--accent)" fill="var(--accent)" opacity={0.2} style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', zIndex: 0 }} />
        <Trophy size={48} color="var(--accent)" fill="var(--accent)" />
      </div>
      <h1 className="gameover-title">Game Over!</h1>
      <p className="gameover-subtitle">
        The game has ended. <span className="winner-name" style={{ color: 'var(--accent)', fontWeight: '700' }}>{winner?.name}</span> finished first!
      </p>

      <div className="gameover-card">
        <div className="gameover-card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Users size={18} color="var(--accent)" />
          <span className="gameover-final-label">Final Standings</span>
        </div>

        <div className="gameover-table">
          <div className="gameover-table-head">
            <span>RANK</span>
            <span>USERNAME</span>
            <span>CARDS LEFT</span>
          </div>
          {sorted.map((player, i) => (
            <div key={player.id} className={`gameover-row ${i === 0 ? 'winner-row' : ''} ${player.id === playerId ? 'you-row' : ''}`}>
              <span className="rank-badge" style={{ background: rankColors[i], color: i === 0 ? '#000' : 'white' }}>
                {i + 1}
              </span>
              <span className="player-name-col">
                {i === 0 && <Trophy size={14} color="var(--accent)" fill="currentColor" style={{ marginRight: '6px' }} />}
                {player.name}
                {i === 0 && <span className="winner-tag">Winner</span>}
                {player.finishOrder > 0 && i > 0 && (
                  <span className="finish-tag">Finished {rankLabels[i]}</span>
                )}
                {player.id === playerId && <span className="you-tag">You</span>}
              </span>
              <span className={`cards-left ${player.cardCount === 0 ? 'zero' : 'nonzero'}`}>
                {player.cardCount}
              </span>
            </div>
          ))}
        </div>

        <div className="gameover-actions">
          <button className="gameover-lobby-btn" onClick={backToLobby} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
            <Home size={18} />
            <span>Back to Lobby</span>
          </button>
          <button className="gameover-again-btn" onClick={playAgain} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
            <RotateCcw size={18} />
            <span>Play Again</span>
          </button>
        </div>
      </div>

      <div className="gameover-footer">
        Room Code: #{code}
      </div>
    </div>
  );
}
