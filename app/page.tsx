'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
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
      // Save player info to sessionStorage
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

  return (
    <main className="landing-bg">
      <div className="landing-header">
        <h1 className="landing-logo-text">
          <span className="icon">♤</span> Pusoy Dos <span className="icon">♤</span>
        </h1>
        <p className="landing-tagline">No login required. Just play.</p>
      </div>

      <div className="landing-card">
        <div className="form-group">
          <label className="input-label">Your Name</label>
          <input 
            className="custom-input" 
            placeholder="Enter your name" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateGame()}
            maxLength={20}
          />
        </div>

        <div className="mode-toggle">
          <button className="mode-btn active">Create Game</button>
          <button className="mode-btn" onClick={() => alert('Join Game functionality: Use the invite link or enter code manually (coming soon)')}>Join Game</button>
        </div>

        <div className="form-group">
          <label className="player-count-title">👥 Players</label>
          <div className="player-options">
            <button 
              className={`option-btn ${maxPlayers === 3 ? 'active' : ''}`}
              onClick={() => setMaxPlayers(3)}
            >
              3 Players
            </button>
            <button 
              className={`option-btn ${maxPlayers === 4 ? 'active' : ''}`}
              onClick={() => setMaxPlayers(4)}
            >
              4 Players
            </button>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <button 
          className="primary-btn" 
          onClick={handleCreateGame}
          disabled={loading || !username.trim()}
        >
          {loading ? 'Creating...' : 'Create Room →'}
        </button>
      </div>

      <p className="landing-footer">Filipino Card Game • 3-4 Players</p>
    </main>
  );
}
