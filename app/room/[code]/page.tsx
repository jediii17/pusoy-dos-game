'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { usePusher } from '@/app/hooks/usePusher';
import { Users, Copy, CheckCircle, Play, LogOut, ArrowRight, Loader2, Spade, LogIn } from 'lucide-react';

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

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/room/${code}` : '';

  const onPusherMessage = useCallback((msg: any) => {
    if (msg.type === 'room_state') {
      setRoom(msg.room);
      if (msg.room.gameState?.phase === 'playing') {
        router.push(`/game/${code}`);
      }
    } else if (msg.type === 'player_joined') {
      setRoom(prev => {
        if (!prev) return prev;
        const exists = prev.players.find(p => p.id === msg.player.id);
        return {
          ...prev,
          players: exists 
            ? prev.players.map(p => p.id === msg.player.id ? { ...p, connected: true } : p) 
            : [...prev.players, msg.player],
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
  }, [code, router]);

  const { sendAction } = usePusher(code, onPusherMessage);

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

  // Join the room via API
  useEffect(() => {
    if (!playerId || !username || !code) return;
    
    const join = async () => {
      const resp = await sendAction('join', { playerName: username });
      if (resp.error) {
        setError(resp.error);
      } else if (resp.room) {
        setRoom(resp.room);
        if (resp.room.gameState?.phase === 'playing') {
          router.push(`/game/${code}`);
        }
      }
    };
    
    join();
  }, [playerId, username, code, sendAction, router]);

  async function handleJoinAsNew() {
    if (!username.trim()) { setError('Please enter a username'); return; }
    setJoining(true);
    sessionStorage.setItem('playerName', username.trim());
    const pid = crypto.randomUUID();
    sessionStorage.setItem('playerId', pid);
    sessionStorage.removeItem('isHost');
    setPlayerId(pid);
  }

  async function handleStartGame() {
    const resp = await sendAction('start');
    if (resp.error) setError(resp.error);
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function leaveRoom() {
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
          <div className="landing-logo">
            {/* <div className="logo-icon">
              <Spade size={32} fill="none" strokeWidth={2} />
            </div>
            <h1 className="landing-logo-text" style={{ fontSize: '2.25rem' }}>Pusoy Dos</h1> */}
            <h1 className="landing-logo-text">
          <Spade className="logo-icon" size={32} fill="none" strokeWidth={2} />
          <span style={{ fontSize: '2.25rem' }}>Pusoy Dos</span>
        </h1>
          </div>
          <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', fontWeight: '500' }}>
            <span style={{ color: 'rgba(52, 211, 153, 0.6)' }}>Joining room </span>
            <span style={{ color: '#fbbf24', fontWeight: '700' }}>{code}</span>
          </p>
        </div>

        <div className="landing-card" style={{ padding: '26px' }}>
          <div className="form-group">
            <label className="input-label" style={{ color: '#d1fae5'}}>Username</label>
            <input 
              className="custom-input" 
              placeholder="Enter your username" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleJoinAsNew()}
              maxLength={20} 
              data-testid="player-name-input"
            />
          </div>
          <button className="primary-btn" onClick={handleJoinAsNew}>
            <span>Join Game</span>
            <LogIn size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (!mounted) return null;

  return (
    <div className="landing-bg" style={{ gap: '1.5rem' }}>
      <div className="lobby-header-small" style={{ marginBottom: '1rem' }}>
        <h1 style={{ gap: '0.5rem' }}><span style={{ color: 'var(--accent)' }}>♤</span> Waiting Room</h1>
        <div className="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
          <div className="player-status-dot" style={{ width: '8px', height: '8px', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }} />
          <span style={{ color: 'var(--primary)', fontWeight: '600' }}>Connected</span>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '500px' }}>
        <div className="room-id-card" data-testid="room-code-display">
          <div className="room-id-label">Room Code</div>
          <div className="room-id-code-row">
            <div className="room-id-code">
              {code}
            </div>
            <button 
              className="icon-btn-small"
              onClick={copyLink}
              data-testid="copy-code-btn"
            >
              {copied ? <CheckCircle size={20} color="#10b981" /> : <Copy size={20} />}
            </button>
          </div>
          
          <div className="invite-link-row">
            <input 
              readOnly 
              className="invite-link-input" 
              value={inviteLink}
            />
            <button 
              className="icon-btn-small"
              onClick={copyLink}
              data-testid="copy-link-btn"
              style={{ fontSize: '0.75rem', fontWeight: '500' }}
            >
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>
        </div>

        <div className="players-card">
          <div className="players-card-header">
            <div className="players-card-title">
              <Users size={16} />
              <span>Players</span>
            </div>
            <span className="players-count">{playerCount}/{maxP}</span>
          </div>
          
          <div className="players-progress-bar">
            <div 
              className="players-progress-fill" 
              style={{ width: `${(playerCount / maxP) * 100}%` }}
            />
          </div>

          <div className="player-list">
            {room?.players.map((p) => (
              <div 
                key={p.id} 
                className="player-row active"
                data-testid={`player-slot-${p.id}`}
              >
                <div className="player-avatar">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="player-name-section">
                  <div className="player-name">
                    {p.name} {p.id === playerId && ' (You)'}
                  </div>
                  {p.id === room.hostId && <div className="player-tag">Host</div>}
                </div>
                <div className={`player-status-dot ${p.connected ? 'active' : ''}`} />
              </div>
            ))}
            {Array.from({ length: maxP - playerCount }).map((_, i) => (
              <div key={i} className="player-row waiting" data-testid={`empty-slot-${i}`}>
                <div className="player-avatar">?</div>
                <div className="player-name-section">
                  <div className="player-name">Waiting...</div>
                </div>
                <div className="player-status-dot waiting" />
              </div>
            ))}
          </div>
        </div>

        <div className="lobby-action-row" style={{ marginTop: '0.5rem' }}>
          <button 
            className="primary-btn"
            onClick={handleStartGame}
            disabled={!canStart}
          >
            {canStart ? (
              <>
                <Play size={16} fill="currentColor" /> 
                <span>Start Game</span>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Loader2 size={16} className="animate-spin" />
                <span>Waiting for players ({playerCount}/{maxP})</span>
              </div>
            )}
          </button>

          <div className="secondary-action" onClick={leaveRoom} style={{ opacity: 0.8 }}>
            <LogOut size={16} />
            <span>Leave Room</span>
          </div>
        </div>
      </div>
    </div>
  );
}
