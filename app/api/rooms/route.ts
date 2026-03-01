import { NextRequest, NextResponse } from 'next/server';

// This API route handles room creation and lookup.
// The actual WebSocket game logic runs in server.js.
// We use a shared in-memory store accessed via the server.js process.
// For create/join, we POST to this route which calls server.js's room store via HTTP.

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

    // Generate room code and player ID
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];

    const playerId = crypto.randomUUID();

    // Store the intention in a cookie/session — actual room is created when WS connects
    return NextResponse.json({ code, playerId, playerName: playerName.trim(), maxPlayers });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
