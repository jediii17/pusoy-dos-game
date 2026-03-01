import { NextRequest, NextResponse } from 'next/server';
import { createRoom, getRoom } from '@/lib/room-store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
  }

  const room = await getRoom(code.toUpperCase());
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, maxPlayers: room.maxPlayers, playerCount: room.players.length });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { maxPlayers, playerName } = body;

    if (!playerName || playerName.trim().length < 1) {
      return NextResponse.json({ error: 'Player name is required' }, { status: 400 });
    }
    if (![3, 4].includes(maxPlayers)) {
      return NextResponse.json({ error: 'maxPlayers must be 3 or 4' }, { status: 400 });
    }

    const hostId = crypto.randomUUID();
    const room = await createRoom(maxPlayers, hostId, playerName.trim());

    return NextResponse.json({
      code: room.code,
      playerId: hostId,
      playerName: playerName.trim(),
      maxPlayers: room.maxPlayers
    });
  } catch (error) {
    console.error('Room creation error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
