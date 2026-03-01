import { NextRequest, NextResponse } from 'next/server';
import { startGame, playCards, passTurn, getRoom, joinRoom } from '@/lib/room-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, code, playerId, cardIds, playerName } = body;

    if (!code || !playerId) {
      return NextResponse.json({ error: 'Missing code or playerId' }, { status: 400 });
    }

    switch (action) {
      case 'join': {
        const { room, error } = await joinRoom(code, playerId, playerName || 'Player');
        if (error) return NextResponse.json({ error }, { status: 400 });
        return NextResponse.json({ room });
      }
      
      case 'start': {
        const { gameState, error } = await startGame(code);
        if (error) return NextResponse.json({ error }, { status: 400 });
        return NextResponse.json({ gameState });
      }

      case 'play': {
        const { gameState, error } = await playCards(code, playerId, cardIds || []);
        if (error) return NextResponse.json({ error }, { status: 400 });
        return NextResponse.json({ gameState });
      }

      case 'pass': {
        const { gameState, error } = await passTurn(code, playerId);
        if (error) return NextResponse.json({ error }, { status: 400 });
        return NextResponse.json({ gameState });
      }

      case 'get_state': {
        const room = await getRoom(code);
        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        return NextResponse.json({ room });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Game action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
