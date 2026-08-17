# ServoForge local authentication on Railway

ServoForge keeps its own username/password accounts. There is no public sign-up and no external identity provider.

## First deployment

1. Deploy this repository as the Railway service. `package.json` exposes `npm start`, which starts `server.js`.
2. Attach a Railway Volume to the ServoForge service and mount it at `/app/data`.
3. Generate/open the Railway public domain.
4. The first visit redirects to `/login.html`. Because the account database is empty, ServoForge shows one-time **Create owner account** setup.
5. Create the Owner account. After this succeeds, owner setup is permanently closed while the persistent authentication database remains present.
6. Open **Users** from the ServoForge top bar to create normal user accounts or additional administrator accounts.

Railway provides `RAILWAY_VOLUME_MOUNT_PATH` automatically when a volume is attached. `server.js` uses that directory first for `servoforge-auth.json`. For a local development override, set `SERVOFORGE_DATA_DIR`.

## What is stored

`servoforge-auth.json` contains:

- usernames, display names, roles, status, and password hashes;
- opaque server-side sessions (only a SHA-256 hash of the browser session token is stored);
- successful and failed sign-in history with timestamp, username, network address, and browser/device user-agent;
- last sign-in and successful sign-in count per user.

Passwords are hashed with Node.js `scrypt` and a unique random salt. Plaintext passwords are never written to the authentication database.

## Roles

- **Owner**: first account; can create/manage users and administrators. The owner account cannot be disabled.
- **Admin**: can create and manage normal users and view sign-in history.
- **User**: can sign in and use ServoForge, but cannot access user administration.

## Persistence and deployment rules

- Keep the Railway Volume attached. Without persistent storage, locally created accounts and sign-in history are lost when the service filesystem is replaced.
- Run one ServoForge service replica while using this file-backed authentication store.
- The Railway-hosted version serves an authentication-safe, network-only service worker so a previously cached PWA shell cannot bypass sign-out. The GitHub Pages staging build keeps its existing offline service worker behavior.
- `/healthz` is intentionally unauthenticated and can be used for a Railway health check.

## Local test

Run:

```bash
npm start
```

Then open `http://localhost:3000`. Local data is written to `./data` by default and is ignored by Git.

Run the authentication integration test with:

```bash
npm run test:auth
```
