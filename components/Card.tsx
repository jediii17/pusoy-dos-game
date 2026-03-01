'use client';

interface Card { rank: string; suit: string; id: string; }

interface CardProps {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  faceDown?: boolean;
  small?: boolean;
  tiny?: boolean;
}

const SUIT_SYMBOLS: Record<string, string> = {
  clubs: '♣', spades: '♠', hearts: '♥', diamonds: '♦',
};
const RED_SUITS = new Set(['hearts', 'diamonds']);

export default function CardComponent({ card, selected, onClick, faceDown, small, tiny }: CardProps) {
  if (faceDown) {
    return (
      <div className={`card face-down ${small ? 'small' : ''} ${tiny ? 'tiny' : ''}`}>
        <div className="card-back-pattern" />
      </div>
    );
  }

  const isRed = RED_SUITS.has(card.suit);
  const symbol = SUIT_SYMBOLS[card.suit] || card.suit;

  return (
    <div
      className={`card face-up ${isRed ? 'red' : 'black'} ${selected ? 'selected' : ''} ${small ? 'small' : ''} ${tiny ? 'tiny' : ''} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="card-corner top-left">
        <div className="card-rank">{card.rank}</div>
        <div className="card-suit-corner">{symbol}</div>
      </div>
      <div className="card-center-suit">{symbol}</div>
      <div className="card-corner bottom-right">
        <div className="card-rank">{card.rank}</div>
        <div className="card-suit-corner">{symbol}</div>
      </div>
    </div>
  );
}
