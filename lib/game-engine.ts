// ============================================================
// Pusoy Dos Game Engine — 100% Filipino rules
// Card rank: 3 < 4 < ... < K < A < 2
// Suit rank: ♣ < ♠ < ♥ < ♦
// ============================================================

export type Suit = 'clubs' | 'spades' | 'hearts' | 'diamonds';
export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

export interface Card {
  rank: Rank;
  suit: Suit;
  id: string; // e.g. "3_clubs"
}

export type ComboType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'straight'
  | 'flush'
  | 'fullhouse'
  | 'fourofakind'
  | 'straightflush'
  | null;

export interface Combo {
  type: ComboType;
  cards: Card[];
}

// ── Rank / Suit ordering ──────────────────────────────────
const RANK_ORDER: Rank[] = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const SUIT_ORDER: Suit[] = ['clubs','spades','hearts','diamonds'];

export function rankValue(r: Rank): number { return RANK_ORDER.indexOf(r); }
export function suitValue(s: Suit): number { return SUIT_ORDER.indexOf(s); }

export function cardValue(c: Card): number {
  return rankValue(c.rank) * 4 + suitValue(c.suit);
}

// Compare two individual cards; returns negative if a < b, 0 if equal, positive if a > b
export function compareCards(a: Card, b: Card): number {
  return cardValue(a) - cardValue(b);
}

// ── Deck ──────────────────────────────────────────────────
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANK_ORDER) {
    for (const suit of SUIT_ORDER) {
      deck.push({ rank, suit, id: `${rank}_${suit}` });
    }
  }
  return deck; // 52 cards
}

export function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ── Dealing ───────────────────────────────────────────────
export interface DealResult {
  hands: Card[][];
  aside: Card | null;
}

export function dealCards(playerCount: 3 | 4): DealResult {
  const deck = shuffleDeck(createDeck());
  const hands: Card[][] = [];

  if (playerCount === 4) {
    for (let i = 0; i < 4; i++) {
      hands.push(deck.slice(i * 13, (i + 1) * 13));
    }
    return { hands, aside: null };
  } else {
    // 3 players: 17 cards each, 1 set aside
    for (let i = 0; i < 3; i++) {
      hands.push(deck.slice(i * 17, (i + 1) * 17));
    }
    return { hands, aside: deck[51] };
  }
}

// ── Combo Detection ───────────────────────────────────────
function sorted(cards: Card[]): Card[] {
  return [...cards].sort(compareCards);
}

function rankGroups(cards: Card[]): Map<Rank, Card[]> {
  const g = new Map<Rank, Card[]>();
  for (const c of cards) {
    if (!g.has(c.rank)) g.set(c.rank, []);
    g.get(c.rank)!.push(c);
  }
  return g;
}

function isStraight(cards: Card[]): boolean {
  if (cards.length !== 5) return false;
  const s = sorted(cards);
  // Special case: A-2-3-4-5 is NOT a valid straight in Pusoy Dos
  // Valid straights must be 5 consecutive ranks in normal order
  for (let i = 1; i < 5; i++) {
    const prev = RANK_ORDER.indexOf(s[i - 1].rank);
    const curr = RANK_ORDER.indexOf(s[i].rank);
    if (curr - prev !== 1) return false;
  }
  return true;
}

function isFlush(cards: Card[]): boolean {
  return cards.length === 5 && cards.every(c => c.suit === cards[0].suit);
}

function isFullHouse(cards: Card[]): boolean {
  if (cards.length !== 5) return false;
  const g = rankGroups(cards);
  const sizes = [...g.values()].map(v => v.length).sort();
  return sizes[0] === 2 && sizes[1] === 3;
}

function isFourOfAKind(cards: Card[]): boolean {
  if (cards.length !== 5) return false;
  const g = rankGroups(cards);
  return [...g.values()].some(v => v.length === 4);
}

function isStraightFlush(cards: Card[]): boolean {
  return isStraight(cards) && isFlush(cards);
}

export function getComboType(cards: Card[]): ComboType {
  const n = cards.length;
  if (n === 1) return 'single';
  if (n === 2) {
    const g = rankGroups(cards);
    return g.size === 1 ? 'pair' : null;
  }
  if (n === 3) {
    const g = rankGroups(cards);
    return g.size === 1 ? 'triple' : null;
  }
  if (n === 5) {
    if (isStraightFlush(cards)) return 'straightflush';
    if (isFourOfAKind(cards)) return 'fourofakind';
    if (isFullHouse(cards)) return 'fullhouse';
    if (isFlush(cards)) return 'flush';
    if (isStraight(cards)) return 'straight';
    return null;
  }
  return null;
}

// ── Five-card hand strength ordering ─────────────────────
const FIVE_CARD_RANK: ComboType[] = ['straight', 'flush', 'fullhouse', 'fourofakind', 'straightflush'];

function fiveCardTypeValue(t: ComboType): number {
  return FIVE_CARD_RANK.indexOf(t!);
}

// Compare two straights/flushes/straight-flushes by highest card
function compareByHighestCard(a: Card[], b: Card[]): number {
  const sa = sorted(a);
  const sb = sorted(b);
  for (let i = 4; i >= 0; i--) {
    const diff = compareCards(sa[i], sb[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Get the "key" card of a Full House (the triple rank)
function fullHouseKey(cards: Card[]): Card {
  const g = rankGroups(cards);
  for (const [, v] of g) {
    if (v.length === 3) return v[0];
  }
  throw new Error('Invalid full house');
}

// Get the quad rank card
function fourOfAKindKey(cards: Card[]): Card {
  const g = rankGroups(cards);
  for (const [, v] of g) {
    if (v.length === 4) return v[0];
  }
  throw new Error('Invalid four of a kind');
}

function compareFiveCard(a: Combo, b: Combo): number {
  const typeA = fiveCardTypeValue(a.type);
  const typeB = fiveCardTypeValue(b.type);
  if (typeA !== typeB) return typeA - typeB;

  switch (a.type) {
    case 'straight':
    case 'flush':
    case 'straightflush':
      return compareByHighestCard(a.cards, b.cards);
    case 'fullhouse': {
      const diff = compareCards(fullHouseKey(a.cards), fullHouseKey(b.cards));
      return diff;
    }
    case 'fourofakind': {
      const diff = compareCards(fourOfAKindKey(a.cards), fourOfAKindKey(b.cards));
      return diff;
    }
    default:
      return 0;
  }
}

// ── Main Compare / CanBeat ─────────────────────────────────
// Returns negative if a < b, 0 equal, positive if a > b
export function compareHands(a: Combo, b: Combo): number {
  if (a.type !== b.type) return NaN; // incompatible — can't compare directly

  switch (a.type) {
    case 'single':
      return compareCards(a.cards[0], b.cards[0]);
    case 'pair':
    case 'triple': {
      // Compare by rank first, then highest suit if same rank
      const rankDiff = rankValue(a.cards[0].rank) - rankValue(b.cards[0].rank);
      if (rankDiff !== 0) return rankDiff;
      // Compare by highest suit card
      const highA = sorted(a.cards).at(-1)!;
      const highB = sorted(b.cards).at(-1)!;
      return suitValue(highA.suit) - suitValue(highB.suit);
    }
    default:
      return compareFiveCard(a, b);
  }
}

export function canBeat(current: Combo, attempt: Combo): boolean {
  if (current.type !== attempt.type) return false;
  const cmp = compareHands(attempt, current);
  return !isNaN(cmp) && cmp > 0;
}

// ── Starting Player ────────────────────────────────────────
export function findStartingPlayer(hands: Card[][]): number {
  for (let i = 0; i < hands.length; i++) {
    if (hands[i].some(c => c.rank === '3' && c.suit === 'clubs')) return i;
  }
  return 0; // fallback
}

export function isValidFirstPlay(cards: Card[]): boolean {
  return cards.some(c => c.rank === '3' && c.suit === 'clubs');
}

// ── Sort helpers ───────────────────────────────────────────
export function sortByRank(hand: Card[]): Card[] {
  return [...hand].sort(compareCards);
}

export function sortBySuit(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    const suitDiff = suitValue(a.suit) - suitValue(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return rankValue(a.rank) - rankValue(b.rank);
  });
}
