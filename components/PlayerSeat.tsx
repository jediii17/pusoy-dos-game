'use client';

import CardComponent from './Card';

interface GamePlayer {
  id: string; name: string; connected: boolean; position: number;
  cardCount: number; passed: boolean; finished: boolean; finishOrder: number;
}

interface PlayerSeatProps {
  player: GamePlayer;
  layout: 'top' | 'left' | 'right';
  isCurrentTurn: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  waiting: 'waiting…',
  passed: 'passed',
  finished: 'finished',
};

export default function PlayerSeat({ player, layout, isCurrentTurn }: PlayerSeatProps) {
  const statusText = player.finished
    ? `#${player.finishOrder} finished!`
    : player.passed
    ? 'passed'
    : isCurrentTurn
    ? 'playing…'
    : 'waiting…';

  const faceDownCount = Math.min(player.cardCount, 5);
  const extraCount = player.cardCount - faceDownCount;

  const initials = player.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`player-seat seat-${layout} ${isCurrentTurn ? 'active-seat' : ''} ${player.finished ? 'finished-seat' : ''}`}>
      <div className="seat-avatar">{initials}</div>
      <div className="seat-info">
        <span className={`seat-name ${isCurrentTurn ? 'active-name' : ''}`}>{player.name}</span>
        <span className={`seat-status ${player.passed ? 'passed-status' : isCurrentTurn ? 'playing-status' : ''}`}>
          {statusText}
        </span>
        {!player.connected && <span className="seat-disconnected">⚠ disconnected</span>}
      </div>
      <div className="seat-cards">
        {Array.from({ length: faceDownCount }).map((_, i) => (
          <div
            key={i}
            className="seat-facedown-card"
            style={{ transform: `rotate(${(i - 2) * 5}deg) translateX(${i * 4}px)` }}
          />
        ))}
        {player.cardCount > 0 && (
          <span className="seat-card-count">+{player.cardCount}</span>
        )}
      </div>
    </div>
  );
}
