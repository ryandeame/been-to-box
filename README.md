# Been-To-Box

Been-To-Box is a playful travel profile app that turns a person's visited places into a colorful, shareable bento-style memory box. Instead of another endless photo grid, each destination becomes a compartment: a cover image, a location, a count of memories, and a path into the full gallery.

The goal is simple: make travel history feel collectible, personal, and fun to open.

## What It Does

- Builds public travel profiles at username-based routes like `/ryandeame`.
- Lets signed-in users upload photos by location.
- Stores user-owned locations, image metadata, and bento cover info in Firestore.
- Uploads original photos to Firebase Storage under each user's location folder.
- Supports email-link, email/password, and Google authentication.
- Shows shareable profile pages while protecting owner-only editing features with Firebase rules.
- Provides an add-photo workflow with drag-and-drop uploads, JPG validation, client-side compression, and UUID filenames.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Firebase Auth
- Cloud Firestore
- Firebase Storage
- Firebase App Hosting

## Project Shape

The app intentionally avoids `firebase-admin` and custom API routes for the current workflow. Authenticated client-side reads and writes go directly through the Firebase browser SDK, while Firestore and Storage rules act as the security boundary.

Primary data paths:

```text
users/{uid}
users/{uid}/locations/{locationId}
users/{uid}/locations/{locationId}/images/{imageId}
users/{uid}/locations/{locationId}/meta/bento-info
usernames/{username}
publicProfiles/{username}
```

Storage path:

```text
users/{uid}/locations/{locationSlug}/{fileName}
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example env file:

```bash
cp .env.example .env.local
```

3. Fill in the Firebase web SDK values in `.env.local`.

4. Run the development server:

```bash
npm run dev
```

5. Open the app at:

```text
http://localhost:3000
```

## Firebase Setup

Enable these Firebase products:

- Authentication with email/password, email-link, and Google providers.
- Cloud Firestore.
- Firebase Storage.
- Firebase App Hosting.

Deploy rules:

```bash
firebase deploy --only firestore:rules,storage
```

Deploy the app:

```bash
firebase deploy --only apphosting
```

For passwordless sign-in and Google auth, add both your local/dev domain and your App Hosting domain in:

```text
Firebase Console -> Authentication -> Settings -> Authorized domains
```

## Environment Variables

Required local variables:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
```

The Firebase web SDK values are public client configuration, not server secrets. Real secrets, service account keys, local env files, and Firebase cache files should never be committed.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Status

Been-To-Box is in active development as a standalone app. The current version focuses on authenticated travel profiles, user-owned uploads, shareable profile pages, and the core bento gallery experience.
