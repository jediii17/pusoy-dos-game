import { useEffect, useRef, useState, useCallback } from 'react';
import Pusher from 'pusher-js';

const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY!;
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap1';

export function usePusher(roomCode: string, onMessage: (msg: any) => void) {
  const [connected, setConnected] = useState(false);
  const pusherRef = useRef<Pusher | null>(null);

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!roomCode) return;

    const pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
    });
    pusherRef.current = pusher;

    const channel = pusher.subscribe(`room-${roomCode}`);

    channel.bind_global((eventName: string, data: any) => {
      onMessageRef.current({ type: eventName, ...data });
    });

    pusher.connection.bind('connected', () => setConnected(true));
    pusher.connection.bind('disconnected', () => setConnected(false));
    pusher.connection.bind('error', (err: any) => {
      console.warn('Pusher connection error:', err);
    });

    return () => {
      if (pusherRef.current) {
        channel.unbind_all();
        pusher.unsubscribe(`room-${roomCode}`);
        pusher.disconnect();
        pusherRef.current = null;
      }
    };
  }, [roomCode]);

  const sendAction = useCallback(async (action: string, payload: any = {}) => {
    const playerId = sessionStorage.getItem('playerId');
    try {
      const resp = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          code: roomCode,
          playerId,
          ...payload,
        }),
      });
      return await resp.json();
    } catch (error) {
      console.error('Action failed:', error);
      return { error: 'Network error' };
    }
  }, [roomCode]);

  return { connected, sendAction };
}
