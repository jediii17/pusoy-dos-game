'use client';

import CardComponent from './Card';

interface Card { rank: string; suit: string; id: string; }
interface LastPlay { playerId: string; playerName: string; cards: Card[]; comboType: string; }

const COMBO_LABELS: Record<string, string> = {
  single: 'Single', pair: 'Pair', triple: 'Three of a Kind',
  straight: 'Straight', flush: 'Flush', fullhouse: 'Full House',
  fourofakind: 'Four of a Kind', straightflush: 'Straight Flush',
};

interface Props {
  lastPlay: LastPlay | null;
  isFirstPlay: boolean;
}

export default function LastPlayArea({ lastPlay, isFirstPlay }: Props) {
  if (!lastPlay) {
    return (
      <div className="last-play-area empty">
        <div className="last-play-label">
          {isFirstPlay ? 'Game Start — Play the 3♣ to begin' : 'New Round — Play anything'}
        </div>
        <div className="last-play-empty-cards">
          {[0, 1, 2].map(i => (
            <div key={i} className="last-play-ghost-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="last-play-area">
      <div className="last-play-label">LAST PLAY</div>
      <div className="last-play-cards">
        {lastPlay.cards.map(card => (
          <CardComponent key={card.id} card={card} />
        ))}
      </div>
      <div className="last-play-info">
        <span className="last-play-combo">{COMBO_LABELS[lastPlay.comboType] || lastPlay.comboType}</span>
        <span className="last-play-by">by {lastPlay.playerName}</span>
      </div>
    </div>
  );
}
