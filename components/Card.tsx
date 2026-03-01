import { Shield, Crown, Trophy, Spade, Heart, Clover, Diamond, User } from 'lucide-react';

interface Card { rank: string; suit: string; id: string; }

interface CardProps {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  faceDown?: boolean;
  small?: boolean;
  tiny?: boolean;
}

const SUIT_ICONS: Record<string, any> = {
  spades: Spade,
  hearts: Heart,
  clubs: Clover,
  diamonds: Diamond,
};

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
  const SuitIcon = SUIT_ICONS[card.suit] || Spade;

  const renderPips = () => {
    const rank = card.rank;
    const n = parseInt(rank === '10' ? '10' : rank);

    if (['J', 'Q', 'K'].includes(rank)) {
      const isRed = RED_SUITS.has(card.suit);
      const accentColor = isRed ? '#e11d48' : '#111';
      
      const renderHead = (isBottom: boolean) => (
        <div className={`royalty-head ${isBottom ? 'bottom' : 'top'}`}>
          <svg viewBox="0 0 100 100" className="royalty-svg">
            <path 
              d={rank === 'Q' ? "M30,55 Q30,30 50,30 Q70,30 70,55" : "M25,55 Q25,25 50,25 Q75,25 75,55"} 
              fill="none" 
              stroke={accentColor} 
              strokeWidth="2" 
            />
            
            {rank === 'K' && <path d="M25,55 Q25,75 50,75 Q75,75 75,55 L75,45 L25,45 Z" fill="none" stroke={accentColor} strokeWidth="1.5" strokeDasharray="1,1" />}
            {rank === 'Q' && (
              <g fill="none" stroke={accentColor} strokeWidth="1.5">
                <path d="M30,40 Q20,50 25,70" />
                <path d="M70,40 Q80,50 75,70" />
              </g>
            )}
            {rank === 'J' && <path d="M25,55 L25,40 Q50,30 75,40 L75,55" fill="none" stroke={accentColor} strokeWidth="1.5" />}
            
            {rank === 'K' && (
              <g fill={accentColor}>
                <path d="M20,25 L30,10 L40,20 L50,8 L60,20 L70,10 L80,25 Z" />
                <circle cx="50" cy="18" r="3" fill="white" />
              </g>
            )}
            {rank === 'Q' && (
              <g fill={accentColor}>
                <path d="M25,30 Q50,5 75,30 L70,35 Q50,25 30,35 Z" />
                <circle cx="50" cy="15" r="3" fill="white" />
                <circle cx="35" cy="22" r="2" fill="white" />
                <circle cx="65" cy="22" r="2" fill="white" />
              </g>
            )}
            {rank === 'J' && (
              <g fill={accentColor}>
                <path d="M25,25 Q50,15 85,20 L75,30 Q50,25 25,30 Z" />
                <path d="M80,20 Q85,5 70,15" stroke={accentColor} strokeWidth="2" fill="none" />
              </g>
            )}

            <circle cx={rank === 'Q' ? 42 : 40} cy="45" r="1.5" fill={accentColor} />
            <circle cx={rank === 'Q' ? 58 : 60} cy="45" r="1.5" fill={accentColor} />
            <path d="M48,50 L52,50 L50,47 Z" fill={accentColor} />
            {rank === 'K' && <path d="M35,58 Q50,65 65,58" fill="none" stroke={accentColor} strokeWidth="1.5" />}
            {rank === 'Q' && <path d="M45,58 Q50,62 55,58" fill="none" stroke={accentColor} strokeWidth="1.5" />}
            {rank === 'J' && <path d="M45,60 L55,60" stroke={accentColor} strokeWidth="1.5" />}

            <path d="M10,90 L90,90 L85,60 L15,60 Z" fill="none" stroke={accentColor} strokeWidth="2" />
            
            {rank === 'K' && (
              <g stroke={accentColor} strokeWidth="2" fill="none">
                <path d="M85,90 L85,60" />
                <path d="M80,60 L90,60" />
                <path d="M85,60 L85,40 Q85,35 88,40" strokeWidth="1.5" />
              </g>
            )}
            
            {rank === 'Q' && <path d="M35,60 L50,85 L65,60" stroke={accentColor} strokeWidth="1" strokeDasharray="2,2" />}
            
            {rank === 'J' && (
              <g stroke={accentColor} strokeWidth="2.5" fill="none">
                <path d="M85,95 L85,50" />
                <circle cx="85" cy="50" r="3" fill={accentColor} />
              </g>
            )}
            
            <path d="M35,60 L35,90 M50,60 L50,90 M65,60 L65,90" stroke={accentColor} strokeWidth="1" strokeDasharray="3,3" opacity="0.3" />
          </svg>
        </div>
      );

      return (
        <div className="royalty-illustration traditional">
          {renderHead(false)}
          <div className="royalty-divider" style={{ backgroundColor: accentColor + '33' }} />
          {renderHead(true)}
        </div>
      );
    }

    if (rank === 'A') {
      return (
        <div className="pip-grid ace-grid">
          <div className="pip-slot center-pip">
            <SuitIcon size={small ? 32 : 56} fill="currentColor" />
          </div>
        </div>
      );
    }
    if (isNaN(n)) return <div className="pip-grid"><span className="pip-symbol">{symbol}</span></div>;

    const pipMaps: Record<number, number[]> = {
      2: [1, 10],
      3: [1, 4, 10],
      4: [0, 2, 9, 11],
      5: [0, 2, 4, 9, 11],
      6: [0, 2, 3, 5, 9, 11],
      7: [0, 2, 3, 5, 9, 11, 4],
      8: [0, 2, 3, 5, 6, 8, 9, 11],
      9: [0, 2, 3, 5, 6, 8, 9, 11, 4],
      10: [0, 2, 3, 5, 6, 8, 9, 11, 1, 10],
    };

    const activePips = pipMaps[n] || [];

    return (
      <div className="pip-grid-container">
        <div className="pip-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="pip-slot">
              {activePips.includes(i) && <span className="pip-symbol">{symbol}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`card face-up ${isRed ? 'red' : 'black'} ${selected ? 'selected' : ''} ${small ? 'small' : ''} ${tiny ? 'tiny' : ''} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      data-rank={card.rank}
    >
      <div className="card-corner top-left">
        <div className="card-rank">{card.rank}</div>
        <div className="card-suit-mini">{symbol}</div>
      </div>

      {renderPips()}

      <div className="card-corner bottom-right">
        <div className="card-rank">{card.rank}</div>
        <div className="card-suit-mini">{symbol}</div>
      </div>
    </div>
  );
}
