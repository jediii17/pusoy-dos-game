'use client';

import { useEffect } from 'react';
import * as PusherPushNotifications from '@pusher/push-notifications-web';

export default function BeamsManager() {
  useEffect(() => {
    // Only run on client-side
    const beamsClient = new PusherPushNotifications.Client({
      instanceId: 'eaa32ecb-f635-47c2-b51b-1e834da9f68f',
    });

    // Check if permission is already denied to avoid re-requesting
    if (Notification.permission === 'denied') {
      console.warn('⚠️ Pusher Beams: Notification permission is denied. Please reset it in your browser settings.');
      return;
    }

    beamsClient.start()
      .then(() => beamsClient.addDeviceInterest('hello'))
      .then(() => console.log('Successfully registered and subscribed to "hello"!'))
      .catch((error) => {
        if (error.name === 'AbortError' || error.message?.includes('permission denied')) {
          console.warn('⚠️ Pusher Beams: Notification permission was denied or dismissed by the user.');
        } else {
          console.error('Pusher Beams error:', error);
        }
      });
  }, []);

  return null; // This component doesn't render anything
}
