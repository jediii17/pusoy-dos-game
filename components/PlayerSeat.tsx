'use client';

import { Trophy } from 'lucide-react';
import CardComponent from './Card';

interface Card {
  rank: string;
  suit: string;
  id: string;
}

interface GamePlayer {
  id: string; name: string; connected: boolean; position: number;
  cardCount: number; passed: boolean; finished: boolean; finishOrder: number;
}

interface PlayerSeatProps {
  player: GamePlayer;
  layout: 'top' | 'left' | 'right';
  isCurrentTurn: boolean;
  isWinning?: boolean;
}

export default function PlayerSeat({ player, layout, isCurrentTurn, isWinning }: PlayerSeatProps) {
  const statusText = player.finished
    ? `#${player.finishOrder} finished!`
    : player.passed
    ? 'passed'
    : isCurrentTurn
    ? 'playing…'
    : 'waiting…';

  const faceDownCount = Math.min(player.cardCount, 5);

  const initials = player.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`player-seat seat-${layout} ${isCurrentTurn ? 'active-seat' : ''} ${player.finished ? 'finished-seat' : ''}`}>
      <div className="seat-avatar">
        {initials}
        {isWinning && !player.finished && (
          <div className="winning-crown">
            <Trophy size={14} fill="#FFD700" color="#FFD700" className="animate-bounce" />
          </div>
        )}
      </div>
      <div className="seat-info">
        <span className={`seat-name ${isCurrentTurn ? 'active-name' : ''}`}>{player.name}</span>
        <span className={`seat-status ${player.passed ? 'passed-status' : isCurrentTurn ? 'playing-status' : ''}`}>
          {statusText}
        </span>
        {!player.connected && <span className="seat-disconnected">⚠ disconnected</span>}
      </div>
      <div className="seat-cards">
        {Array.from({ length: Math.min(player.cardCount, 6) }).map((_, i) => (
          <div
            key={i}
            className="seat-facedown-card"
            style={{ 
              transform: `rotate(${(i - 2.5) * 8}deg) translateX(${i * 6}px)`,
              marginLeft: i === 0 ? 0 : '-38px',
              zIndex: i
            }}
          />
        ))}
        {player.cardCount > 0 && (
          <div className="seat-card-count">
            {player.cardCount}
          </div>
        )}
      </div>
    </div>
  );
}
