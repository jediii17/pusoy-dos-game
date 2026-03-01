'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';

interface Player {
  id: string;
  name: string;
  connected: boolean;
  position: number;
}

interface RoomState {
  code: string;
  maxPlayers: number;
  hostId: string;
  players: Player[];
  gameState: { phase: string } | null;
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const code = params.code as string;
  const isHostQuery = searchParams.get('host') === 'true';

  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [joining, setJoining] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/room/${code}` : '';

  // Initialize player info
  useEffect(() => {
    let pid = sessionStorage.getItem('playerId');
    let pname = sessionStorage.getItem('playerName');
    const host = sessionStorage.getItem('isHost') === 'true';

    if (!pid) {
      pid = crypto.randomUUID();
      sessionStorage.setItem('playerId', pid);
    }
    if (!pname) {
      pname = '';
    }

    setPlayerId(pid);
    setUsername(pname);
    setIsHost(host && isHostQuery);
  }, [isHostQuery]);

  const connect = useCallback(() => {
    if (!playerId || !username || !code) return;
    const wsUrl = `ws://${window.location.host}/ws?room=${code}&player=${playerId}&name=${encodeURIComponent(username)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // If we're entering a non-host room for the first time, register
      if (!isHostQuery) {
        ws.send(JSON.stringify({ type: 'join', roomCode: code, playerId, playerName: username }));
      }
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'room_state') {
          setRoom(msg.room);
          // If game already started, redirect to game
          if (msg.room.gameState?.phase === 'playing') {
            router.push(`/game/${code}`);
          }
        } else if (msg.type === 'player_joined') {
          setRoom(prev => {
            if (!prev) return prev;
            const exists = prev.players.find(p => p.id === msg.player.id);
            return {
              ...prev,
              players: exists ? prev.players.map(p => p.id === msg.player.id ? { ...p, connected: true } : p) : [...prev.players, msg.player],
            };
          });
        } else if (msg.type === 'player_left') {
          setRoom(prev => {
            if (!prev) return prev;
            return { ...prev, players: prev.players.map(p => p.id === msg.playerId ? { ...p, connected: false } : p) };
          });
        } else if (msg.type === 'game_state') {
          if (msg.gameState?.phase === 'playing') router.push(`/game/${code}`);
        } else if (msg.type === 'error') {
          setError(msg.message);
        }
      } catch {}
    };

    ws.onerror = () => setError('Connection error. The room may not exist.');
    ws.onclose = () => { /* reconnect handled by effect cleanup */ };
  }, [playerId, username, code, isHostQuery, router]);

  useEffect(() => {
    if (!playerId || !username) return;

    // For non-hosts joining, we need to create the room on server via WS handshake
    connect();
    return () => { wsRef.current?.close(); };
  }, [connect, playerId, username]);

  async function handleJoinAsNew() {
    if (!username.trim()) { setError('Please enter a username'); return; }
    setJoining(true);
    sessionStorage.setItem('playerName', username.trim());
    const pid = crypto.randomUUID();
    sessionStorage.setItem('playerId', pid);
    sessionStorage.removeItem('isHost');
    setPlayerId(pid);
  }

  function handleStartGame() {
    wsRef.current?.send(JSON.stringify({ type: 'start_game' }));
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function leaveRoom() {
    wsRef.current?.close();
    sessionStorage.removeItem('isHost');
    router.push('/');
  }

  const playerCount = room?.players.length || 0;
  const maxP = room?.maxPlayers || 4;
  const canStart = isHost && playerCount >= 3;

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Show join form if not yet identified (Client-side only)
  if (mounted && !sessionStorage.getItem('playerName') && !joining) {
    return (
      <div className="landing-bg">
        <div className="landing-header">
           <h1 className="landing-logo-text"><span className="icon">♤</span> Join Game <span className="icon">♤</span></h1>
           <p className="landing-tagline">Room ID: {code}</p>
        </div>
        <div className="landing-card">
          <div className="form-group">
            <label className="input-label">YOUR NAME</label>
            <input 
              className="custom-input" 
              placeholder="Enter your name to join..." 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleJoinAsNew()}
              maxLength={20} 
            />
          </div>
          <button className="primary-btn" onClick={handleJoinAsNew}>
            Join Room →
          </button>
        </div>
      </div>
    );
  }

  if (!mounted) return null;

  return (
    <div className="landing-bg">
      <div className="lobby-header-small">
        <h1><span style={{ color: '#ffc132' }}>♤</span> Waiting Room</h1>
        <p className="status">● Connected</p>
      </div>

      <div style={{ width: '100%', maxWidth: '500px' }}>
        <div className="room-id-card">
          <span className="room-id-label">ROOM CODE</span>
          <div className="room-id-code-row">
            <span className="room-id-code">{code}</span>
            <span style={{ cursor: 'pointer', opacity: 0.5 }} onClick={copyLink}>📋</span>
          </div>
          <div className="room-id-share-link">
            <span className="room-id-url">{inviteLink}</span>
            <span className="copy-link-text" onClick={copyLink}>Copy Link</span>
          </div>
        </div>

        <div className="players-card">
          <div className="players-card-header">
            <span className="players-card-title">👥 Players</span>
            <span className="players-count">{playerCount}/{maxP}</span>
          </div>
          
          <div className="players-progress-bar">
            <div 
              className="players-progress-fill" 
              style={{ width: `${(playerCount / maxP) * 100}%` }}
            />
          </div>

          <div className="player-list">
            {room?.players.map((p, i) => (
              <div key={p.id} className="player-row">
                <div className="player-avatar">{p.name.charAt(0).toUpperCase()}</div>
                <div className="player-name-section">
                  <div className="player-name">{p.name} {p.id === playerId && '(You)'}</div>
                  {p.id === room.hostId && <div className="player-tag">HOST</div>}
                </div>
                <div className="player-status-dot" />
              </div>
            ))}
            {Array.from({ length: maxP - playerCount }).map((_, i) => (
              <div key={i} className="player-row waiting">
                <div className="player-avatar" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }}>?</div>
                <div className="player-name-section">
                  <div className="player-name">Waiting...</div>
                </div>
                <div className="player-status-dot waiting" />
              </div>
            ))}
          </div>
        </div>

        <div className="lobby-action-row">
          <button 
            className="primary-btn"
            style={{ 
              background: canStart ? 'var(--primary)' : 'rgba(0, 139, 94, 0.2)',
              color: canStart ? 'white' : 'rgba(255, 255, 255, 0.2)',
              boxShadow: canStart ? '0 8px 32px rgba(0, 139, 94, 0.3)' : 'none'
            }}
            onClick={handleStartGame}
            disabled={!canStart}
          >
            {canStart ? '▶ Start Game' : `Waiting for players (${playerCount}/${maxP})`}
          </button>

          <div className="secondary-action" onClick={leaveRoom}>
            <span>← Leave Room</span>
          </div>
        </div>
      </div>
    </div>
  );
}
