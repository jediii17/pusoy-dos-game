'use client';

import { useEffect } from 'react';
import * as PusherPushNotifications from '@pusher/push-notifications-web';

export default function BeamsManager() {
  useEffect(() => {
    let isMounted = true;
    let beamsClient: PusherPushNotifications.Client | null = null;

    async function initBeams() {
      try {
        // Check if permission is already denied to avoid re-requesting
        if (Notification.permission === 'denied') {
          console.warn('⚠️ Pusher Beams: Notification permission is denied. Please reset it in your browser settings.');
          return;
        }

        beamsClient = new PusherPushNotifications.Client({
          instanceId: 'eaa32ecb-f635-47c2-b51b-1e834da9f68f',
        });

        await beamsClient.start();
        
        if (!isMounted) return;

        await beamsClient.addDeviceInterest('hello');
        console.log('Successfully registered and subscribed to "hello"!');
      } catch (error: any) {
        if (!isMounted) return;

        if (error.name === 'AbortError' || error.message?.includes('permission denied')) {
          console.warn('⚠️ Pusher Beams: Notification permission was denied or dismissed by the user.');
        } else {
          console.error('Pusher Beams error:', error);
        }
      }
    }

    initBeams();

    return () => {
      isMounted = false;
    };
  }, []);

  return null; // This component doesn't render anything
}
