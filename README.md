# Pusoy Dos Game 🃏

Welcome to the **Pusoy Dos Game**, a modern and interactive real-time multiplayer card game web application inspired by the popular Filipino shedding-card game.

## 📖 Overview

This project provides a fully playable Pusoy Dos experience right in your browser. Whether you want to test your strategy against advanced CPU opponents or challenge friends in real-time multiplayer matches in the 1v1 Arena, the game offers a seamless, reactive, and engaging user experience. 

It handles game rooms, match synchronization, real-time player interactions, and intelligent CPU logic all within a responsive next-generation web architecture.

### ✨ Key Features
- **Real-time Multiplayer Lobby & Gameplay:** Create rooms, share links, and play against others seamlessly.
- **Advanced CPU Opponents:** Play solo against CPU players that scale in difficulty (Easy, Average, Hard), mimic human-play pacing, and offer dynamic response times.
- **1v1 Arena & Classic Map:** Distinct game modes and environments.
- **Responsive Layout & Animations:** A deeply polished UX/UI optimized for mobile and desktop screens.
- **Real-time Synchronization:** Built on fast WebSocket connections to handle real-time broadcasting and game state updates.

## 🛠 Tech Stack

Built with a cutting-edge front-end and real-time backend stack:

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **UI Library:** [React 19](https://react.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Real-time Engine:** [Pusher Channels](https://pusher.com/) for WebSocket broadcasting
- **Data & State Management:** [Upstash Redis](https://upstash.com/) for fast, serverless game state management
- **Icons & Assets:** [Lucide React](https://lucide.dev/)

## 📂 Project Structure

- `app/` - Next.js App Router containing pages (`/game`, `/room`, `/gameover`) and API endpoints (`/api`).
- `components/` - Reusable UI elements, game boards, buttons, and layout containers.
- `lib/` - Utility functions, game logic validations, and API/Redis helpers.
- `public/` - Static assets such as images, background audio, and SVGs.

## 🚀 Getting Started

### Prerequisites
Before running the project locally, make sure you have:
- Node.js (v20+ recommended)
- A [Pusher](https://pusher.com/) account and credentials for WebSockets.
- An [Upstash Redis](https://upstash.com/) datastore for state caching.

### 1. Clone the repository
```bash
git clone <repository-url>
cd pusoy-dos-game
```

### 2. Install Dependencies
Install the required node modules using your preferred package manager:
```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Setup Environment Variables
Duplicate the `.env.local.example` file and rename it to `.env.local`. Fill in the required API keys for Pusher and Upstash:

```env
# Example .env.local
NEXT_PUBLIC_PUSHER_APP_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=your_pusher_cluster
PUSHER_APP_ID=your_pusher_app_id
PUSHER_SECRET=your_pusher_secret

UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

### 4. Run the Development Server
Start the local development server:
```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application running. You can start playing or open a new incognito window to simulate joining your own multiplayer room!

## 📜 License
This project is proprietary and intended for internal use or portfolio demonstration.
