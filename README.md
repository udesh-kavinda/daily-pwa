# Daily PWA

Mobile-first microloan PWA with offline collection capture, Clerk auth, and Firebase push notifications.

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env.local` using `.env.example` and set Clerk + Firebase keys.

3. Run the dev server:

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Features

- Installable PWA for iOS + Android
- Offline queue and sync demo for collector flow
- Firebase Cloud Messaging for push notifications
- Clerk auth scaffolding (creditor/collector roles)
- Mobile-first interface with tailored UX

## Firebase Setup

1. Create a Firebase project.
2. Enable Cloud Messaging.
3. Generate a Web Push certificate key pair for `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
4. Create a service account and add `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

## Notes

- Placeholder SVG icons and screenshots are in `public/icons` and `public/screenshots`.
- Replace them with PNGs for production, especially for iOS install prompts.
- Push tokens are stored locally in `data/push-tokens.json` (demo only).
