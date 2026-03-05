'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { usePusher } from '@/app/hooks/usePusher';
import { Trophy, RotateCcw, Home, Users, ArrowLeft, Spade } from 'lucide-react';
import AdBanner from '@/components/AdBanner';

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

  async function playAgain() {
    // Reset the room on the server (clears players + gameState)
    await sendAction('reset');
    // Clear local session so the join form appears with fresh username input
    sessionStorage.removeItem('isHost');
    sessionStorage.removeItem('playerName');
    // Generate a new playerId for the new game
    const newId = crypto.randomUUID();
    sessionStorage.setItem('playerId', newId);
    sessionStorage.removeItem('finalGameState');
    router.push(`/room/${code}`);
  }

  function backToLobby() {
    sessionStorage.clear();
    router.push('/');
  }

  if (!mounted || !gameState) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-900/30 border-t-amber-400 rounded-full animate-spin" />
        <p className="text-emerald-500/60 font-medium animate-pulse uppercase tracking-widest text-xs">Loading Results...</p>
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
    <main className="landing-bg">
      <div className="landing-header">
        <div className="landing-header">
          <h1 className="landing-logo-text">
            <Spade className="logo-icon" size={36} fill="none" strokeWidth={2} />
            <span>Game Over</span>
            <Spade className="logo-icon" size={36} fill="none" strokeWidth={2} />
          </h1>
          {winner && (
              <h2 className="winner-announce">
                {winner.name} Wins!
              </h2>
            )}
        </div>
       <div className="landing-card">
         <div className="standings-list">
          {sorted.map((p, i) => {
            const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
            return (
              <div key={p.id} className={`standings-item ${rankClass}`}>
                <div className="standings-rank">#{i + 1}</div>
                <div className="standings-name">
                  {p.name} {p.id === playerId && '(You)'}
                </div>
                <div className="standings-detail">
                  <span className="detail-main">
                    {p.cardCount === 0 ? 'CLEARED' : p.cardCount}
                  </span>
                  <span className="detail-sub">
                    {p.cardCount === 0 ? 'Winner' : 'Cards Left'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
       </div>

        <div className="game-over-actions">
          <button
            onClick={() => { sessionStorage.clear(); router.push('/'); }}
            className="action-btn-secondary"
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </button>
          <button
            onClick={playAgain}
            className="action-btn-primary"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Play Again</span>
          </button>
        </div>

        <div className="landing-footer">
          Room Code: {code}
        </div>
      </div>

      <div className="fixed bottom-4 right-4 z-50 opacity-20 hover:opacity-100 transition-opacity">
        <AdBanner 
          dataAdSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_GAMEOVER || ""}
          className="w-[300px] h-[50px]"
        />
      </div>
    </main>
  );
}
