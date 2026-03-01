'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

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
  const wsRef = useRef<WebSocket | null>(null);

  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') || '' : '';
  const playerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') || '' : '';

  const connect = useCallback(() => {
    if (!playerId || !playerName || !code) return;
    const wsUrl = `ws://${window.location.host}/ws?room=${code}&player=${playerId}&name=${encodeURIComponent(playerName)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'room_state' && msg.room.gameState) setGameState(msg.room.gameState);
        if (msg.type === 'game_over') setGameState(msg.gameState);
        if (msg.type === 'game_state') setGameState(msg.gameState);
      } catch {}
    };
  }, [playerId, playerName, code]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    connect();
    // Also try to load from sessionStorage (set by game page before redirect)
    const stored = sessionStorage.getItem('finalGameState');
    if (stored) { try { setGameState(JSON.parse(stored)); } catch {} }
    return () => wsRef.current?.close();
  }, [connect]);

  function playAgain() {
    wsRef.current?.close();
    sessionStorage.removeItem('isHost');
    router.push('/');
  }

  function backToLobby() {
    wsRef.current?.close();
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
  const totalRounds = 1; // could track this in the future

  const rankLabels = ['1st', '2nd', '3rd', '4th'];
  const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32', '#FF6B6B'];

  return (
    <div className="gameover-bg">
      <div className="gameover-trophy">🏆</div>
      <h1 className="gameover-title">Game Over!</h1>
      <p className="gameover-subtitle">
        The game has ended. <span className="winner-name">{winner?.name}</span> finished first!
      </p>

      <div className="gameover-card">
        <div className="gameover-card-header">
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
              <span className="rank-badge" style={{ background: rankColors[i] }}>
                {i + 1}
              </span>
              <span className="player-name-col">
                {i === 0 && <span className="trophy-icon">🏆</span>}
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
          <button className="gameover-lobby-btn" onClick={backToLobby}>
            ↩ Back to Lobby
          </button>
          <button className="gameover-again-btn" onClick={playAgain}>
            🔄 Play Again
          </button>
        </div>
      </div>

      <div className="gameover-footer">
        Room Code: #{code}
      </div>
    </div>
  );
}
