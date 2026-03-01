'use client';

import { useState } from 'react';
import { useRouter } from "next/navigation";
import { Spade, Plus, Users, ArrowRight, LogIn } from "lucide-react";
import AdBanner from "@/components/AdBanner";

export default function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<3 | 4>(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreateGame() {
    if (!username.trim()) { setError('Please enter a username'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPlayers, playerName: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create room'); return; }
      sessionStorage.setItem('playerId', data.playerId);
      sessionStorage.setItem('playerName', data.playerName);
      sessionStorage.setItem('maxPlayers', String(data.maxPlayers));
      sessionStorage.setItem('isHost', 'true');
      router.push(`/room/${data.code}?host=true`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinGame() {
    if (!username.trim()) { setError('Please enter a username'); return; }
    if (!roomCode.trim()) { setError('Please enter a room code'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms?code=${roomCode.trim().toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Room not found'); return; }
      
      sessionStorage.setItem('playerName', username.trim());
      router.push(`/room/${roomCode.trim().toUpperCase()}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = () => {
    if (mode === 'create') handleCreateGame();
    else handleJoinGame();
  };

  return (
    <main className="landing-bg">
      <div className="landing-header">
        <h1 className="landing-logo-text">
          <Spade className="logo-icon" size={36} fill="none" strokeWidth={2} />
          <span>Pusoy Dos</span>
          <Spade className="logo-icon" size={36} fill="none" strokeWidth={2} />
        </h1>
        <p className="landing-tagline">No login required. Just play.</p>
      </div>

      <div className="landing-card">
        <div className="form-group">
          <label className="input-label">Username</label>
          <input 
            className="custom-input" 
            placeholder="Enter your name" 
            data-testid="player-name-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            maxLength={20}
          />
        </div>

        <div role="tablist" aria-orientation="horizontal" className="mode-toggle">
          <button 
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            className={`mode-btn ${mode === 'create' ? 'active' : ''}`}
            onClick={() => setMode('create')}
            data-state={mode === 'create' ? 'active' : 'inactive'}
          >
            Create Game
          </button>
          <button 
            type="button"
            role="tab"
            aria-selected={mode === 'join'}
            className={`mode-btn ${mode === 'join' ? 'active' : ''}`}
            onClick={() => setMode('join')}
            data-state={mode === 'join' ? 'active' : 'inactive'}
          >
            Join Game
          </button>
        </div>

        {mode === 'create' ? (
          <div className="form-group">
            <label className="player-count-title">
              <Users size={16} />
              <span>Players</span>
            </label>
            <div className="player-options">
              <button 
                data-testid="player-count-3"
                className={`option-btn ${maxPlayers === 3 ? 'active' : ''}`}
                onClick={() => setMaxPlayers(3)}
              >
                3 Players
              </button>
              <button 
                data-testid="player-count-4"
                className={`option-btn ${maxPlayers === 4 ? 'active' : ''}`}
                onClick={() => setMaxPlayers(4)}
              >
                4 Players
              </button>
            </div>
          </div>
        ) : (
          <div className="form-group">
            <label className="input-label">Room Code</label>
            <input 
              className="custom-input centered" 
              placeholder="ENTER ROOM CODE" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoinGame()}
              maxLength={6}
            />
          </div>
        )}

        {error && <p className="form-error" style={{ color: '#ff4b4b', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>}

        <button 
          className="primary-btn" 
          onClick={handleSubmit}
          data-testid="create-game-btn"
          disabled={loading || !username.trim() || (mode === 'join' && !roomCode.trim())}
        >
          <span>{loading ? 'Processing...' : (mode === 'create' ? 'Create Room' : 'Join Room')}</span>
          {!loading && (mode === 'create' ? <ArrowRight size={16} /> : <LogIn size={16} />)}
        </button>
      </div>

      <div className="landing-footer-group">
        <footer className="landing-footer">Filipino Card Game • 3-4 Players</footer>
        <span className="landing-footer-dev">Developed by Kairo</span>
      </div>

      {/* Landing Page Ad Slot */}
      <AdBanner 
        dataAdSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_LANDING || ""}
        className="mt-8"
      />
    </main>
  );
}
