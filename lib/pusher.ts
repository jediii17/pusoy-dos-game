import Pusher from 'pusher';

const pusherKey = process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY;

if (!process.env.PUSHER_APP_ID || !pusherKey || !process.env.PUSHER_SECRET) {
  console.warn('⚠️ Pusher environment variables are missing. Real-time updates will not work.');
}

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '',
  key: pusherKey || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap1',
  useTLS: true,
});
