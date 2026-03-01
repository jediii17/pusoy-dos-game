'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { usePusher } from '@/app/hooks/usePusher';
import { Trophy, RotateCcw, Home, Users, ArrowLeft } from 'lucide-react';
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
    <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center p-4">
      {/* Background patterns if any */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent_70%)] pointer-events-none" />

      <div className="bg-zinc-950 border border-emerald-900/50 rounded-2xl p-6 max-w-md w-full shadow-2xl relative z-10">
        <div className="text-center mb-6">
          <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h2 
            className="text-3xl font-bold text-white mb-1"
            style={{ fontFamily: 'var(--font-fredoka), sans-serif' }}
          >
            Game Over!
          </h2>
          {winner && (
            <p className="text-amber-400 font-bold text-lg">
              {winner.name} wins!
            </p>
          )}
        </div>

        {/* Standings */}
        <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto pr-1">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`
                flex items-center gap-3 p-3 rounded-lg
                ${i === 0 ? 'bg-amber-400/10 border border-amber-400/30' : 'bg-emerald-900/20 border border-emerald-800/20'}
              `}
            >
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${i === 0 ? 'bg-amber-400 text-black' : i === sorted.length - 1 ? 'bg-red-900 text-red-200' : 'bg-emerald-800 text-emerald-200'}
              `}>
                #{i + 1}
              </div>
              <div className="flex-1">
                <div className="text-white text-sm font-medium">{p.name} {p.id === playerId && '(You)'}</div>
                <div className="text-emerald-500/60 text-xs lowercase">
                  {p.cardCount === 0 ? 'No cards left' : `${p.cardCount} cards left`}
                </div>
              </div>
              {i === 0 && <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">Winner</span>}
              {i === sorted.length - 1 && sorted.length > 2 && <span className="text-red-400 text-xs uppercase">Last</span>}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => { sessionStorage.clear(); router.push('/'); }}
            className="flex-1 px-4 py-2 rounded-lg bg-transparent border border-emerald-800/50 text-emerald-400 font-medium hover:bg-emerald-800/20 flex items-center justify-center gap-2 transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </button>
          <button
            onClick={playAgain}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-black font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Play Again
          </button>
        </div>

        <div className="mt-4 border-t border-emerald-900/20 pt-4">
          <AdBanner 
            dataAdSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_GAMEOVER || ""}
            className="rounded-lg overflow-hidden border border-emerald-900/10"
          />
        </div>

        <div className="mt-6 text-center text-emerald-900/40 text-[10px] uppercase font-bold tracking-[0.2em]">
          Room Code: {code}
        </div>
      </div>
    </div>
  );
}
