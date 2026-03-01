'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { usePusher } from '@/app/hooks/usePusher';
import { Users, Copy, CheckCircle, Play, LogOut, ArrowRight, Loader2, Spade, LogIn } from 'lucide-react';
import AdBanner from "@/components/AdBanner";

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
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [username, setUsername] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [joining, setJoining] = useState(false);
  const [isDissolved, setIsDissolved] = useState(false);

  const joinedRef = useRef(false);
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
    } else if (msg.type === 'room_dissolved') {
      setIsDissolved(true);
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

    sessionStorage.setItem('playerId', pid);
    setPlayerId(pid);
    setUsername(pname || ''); // Default to empty if not found
    setIsHost(host && isHostQuery);
  }, [isHostQuery]);

  // Proactively check room state on mount
  useEffect(() => {
    if (!code) return;
    
    const checkRoom = async () => {
      const resp = await sendAction('get_state');
      if (resp.error) {
        setError(resp.error);
        return;
      }
      if (resp.room) {
        const r = resp.room;
        setRoom(r);
        // If room is full and we are NOT in it yet, show error
        const pid = sessionStorage.getItem('playerId');
        const isExisting = r.players.some((p: any) => p.id === pid);
        if (r.players.length >= r.maxPlayers && !isExisting) {
          setError(`Room is full (${r.players.length}/${r.maxPlayers})`);
        }
      }
    };
    
    checkRoom();
  }, [code, sendAction]);

  // Join the room via API
  useEffect(() => {
    // Only join if we have valid credentials AND either:
    // 1. We are the host (joining directly)
    // 2. We are already known (name in session)
    // 3. We just clicked the "Join Game" button (joining state is true)
    const inSession = typeof window !== 'undefined' && !!sessionStorage.getItem('playerName');
    const isReadyToJoin = isHost || inSession || joining;

    if (!playerId || !username || !code || joinedRef.current || !isReadyToJoin) return;
    
    joinedRef.current = true;
    const join = async () => {
      const resp = await sendAction('join', { playerName: username });
      if (resp.error) {
        setError(resp.error);
        joinedRef.current = false; // Allow retry on error
        setJoining(false); // Stop the joining state to show the form/error
      } else if (resp.room) {
        setRoom(resp.room);
        if (resp.room.gameState?.phase === 'playing') {
          router.push(`/game/${code}`);
        }
      }
    };
    
    join();
  }, [playerId, username, code, sendAction, router, isHost, joining]);

  async function handleJoinAsNew() {
    if (!username.trim()) { setError('Please enter a username'); return; }
    if (joining) return;
    
    setJoining(true);
    sessionStorage.setItem('playerName', username.trim());
    // Reuse existing playerId if available, otherwise it's initialized in useEffect
    sessionStorage.setItem('playerId', playerId);
    sessionStorage.removeItem('isHost');
    
    // The useEffect will trigger 'join' now that username is set
  }

  async function handleStartGame() {
    const resp = await sendAction('start');
    if (resp.error) setError(resp.error);
  }

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function leaveRoom() {
    await sendAction('leave');
    sessionStorage.removeItem('isHost');
    router.push('/');
  }

  const playerCount = room?.players.length || 0;
  const maxP = room?.maxPlayers || 4;
  const isRealHost = room ? room.hostId === playerId : isHost;
  const canStart = isRealHost && playerCount >= 3;
  const isRoomFull = playerCount >= maxP;
  const isReady = playerCount >= 3;

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Show Room Not Found view if explicitly missing
  if (mounted && error === 'Room not found') {
    return (
      <div className="landing-bg">
        <div className="landing-header">
          <h1 className="landing-logo-text">
            <Spade className="logo-icon" size={32} fill="none" strokeWidth={2} />
            <span style={{ fontSize: '2.25rem' }}>Pusoy Dos</span>
          </h1>
          <p style={{ marginTop: '1.5rem', fontSize: '1.25rem', color: '#ff4b4b', fontWeight: 'bold' }}>
            Room Not Found
          </p>
          <p style={{ color: 'rgba(52, 211, 153, 0.6)', marginTop: '0.5rem' }}>
            This room may have been closed by the host or the code is invalid.
          </p>
        </div>

        <div className="landing-card" style={{ padding: '26px', alignItems: 'center' }}>
          <button className="primary-btn" onClick={() => router.push('/')} style={{ width: '100%' }}>
            <LogIn size={16} style={{ transform: 'rotate(180deg)' }} />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    );
  }

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
          
          {error && (
            <p className="form-error" style={{ color: '#ff4b4b', fontSize: '0.875rem', textAlign: 'center', marginBottom: '1rem' }}>
              {error}
            </p>
          )}

          <button 
            className="primary-btn" 
            onClick={handleJoinAsNew}
            disabled={joining || !!error}
          >
            <span>{joining ? 'Joining...' : 'Join Game'}</span>
            {joining ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
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
              onClick={copyCode}
              data-testid="copy-code-btn"
            >
              {copiedCode ? <CheckCircle size={20} color="#10b981" /> : <Copy size={20} />}
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
              {copiedLink ? 'Copied' : 'Copy Link'}
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
            onClick={isRealHost ? handleStartGame : undefined}
            disabled={!canStart}
            style={!isRealHost ? { cursor: 'default' } : {}}
          >
            {isRealHost ? (
              canStart ? (
                <>
                  <Play size={16} fill="currentColor" /> 
                  <span>Start Game</span>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Waiting for players ({playerCount}/{maxP})</span>
                </div>
              )
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isReady ? (
                  <>
                    <div className="player-status-dot active" style={{ width: '8px', height: '8px' }} />
                    <span>Waiting for host to start...</span>
                  </>
                ) : (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Waiting for players ({playerCount}/{maxP})</span>
                  </>
                )}
              </div>
            )}
          </button>

          <button 
            data-testid="leave-room-btn" 
            className="leave-room-btn" 
            onClick={leaveRoom}
          >
            <LogOut size={12} /> 
            <span>Leave Room</span>
          </button>
        </div>
      </div>

      {/* Room Page Ad Slot */}
      <AdBanner 
        dataAdSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_ROOM || ""}
        className="mt-6"
      />

      {isDissolved && (
        <div className="modal-overlay">
          <div className="custom-modal">
            <div className="modal-icon-container">
              <LogOut size={32} />
            </div>
            <h2 className="modal-title">Room Closed</h2>
            <p className="modal-description">
              The host has left the room. The game session is now closed.
            </p>
            <button className="primary-btn" onClick={() => router.push('/')} style={{ width: '100%' }}>
              <ArrowRight size={18} />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
