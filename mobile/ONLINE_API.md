# Publish NQS Backend Online (anyone can use the APK)

The mobile APK must call a **public HTTPS API**. Local Wi‑Fi IPs only work on your network.

## Option A — Render (recommended for the rubric)

1. Push this project to GitHub (already linked: `Graduate-Team`).
2. Open [https://dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect the repo and select `render.yaml`.
4. Add / confirm env vars:
   - `DATABASE_URL` (from Render Postgres)
   - `JWT_SECRET`
   - `POSTGRES_SSL=true`
   - `NODE_ENV=production`
5. Deploy. Copy the service URL, e.g.:
   `https://nqs-backend-xxxx.onrender.com`
6. Rebuild the citizen APK with that URL:

```bash
cd mobile
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR-RENDER-URL
```

APK output:
`mobile/build/app/outputs/flutter-apk/app-release.apk`

## Option B — Railway

1. New Project → Deploy from GitHub → root `backend`
2. Add PostgreSQL plugin and set `DATABASE_URL`
3. Start command: `node server.js`
4. Build: `npm install && npx prisma generate`
5. Use the public Railway HTTPS URL the same way in `--dart-define=API_BASE_URL=...`

## After deploy

- Anyone with internet can install the APK (no need for your Wi‑Fi).
- Seed admin / centers once on the hosted DB (`npm run seed` via Render shell if needed).
- Free Render services sleep after idle; first request may be slow.

## Local-only APK (debug)

Still works for emulator / same Wi‑Fi only:

```bash
flutter build apk --release --dart-define=API_BASE_URL=http://YOUR-LAN-IP:5005
```
