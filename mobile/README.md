# NQS Mobile (Flutter)

Citizen-facing mobile client for the existing **National Queue System (NQS)** platform.

This app is a *pure client*. It creates no database and no backend of its own: it talks to
the same Express + Prisma + PostgreSQL API that the React web portal uses, over the same
REST endpoints and the same JWT authentication.

---

## Table of contents

1. [Requirements](#requirements)
2. [Configuration](#configuration)
3. [Running the app](#running-the-app)
4. [Architecture](#architecture)
5. [Backend API used](#backend-api-used)
6. [Authentication and OTP flows](#authentication-and-otp-flows)
7. [Error handling](#error-handling)
8. [Troubleshooting](#troubleshooting)

---

## Requirements

| Tool | Version used |
|---|---|
| Flutter | 3.35.6 (stable) |
| Dart | 3.9.2 |
| Android | minSdk 23 (required by `flutter_secure_storage`) |

The NQS backend must be running and reachable. Start it from the repository root:

```bash
cd backend
npm run dev        # listens on the PORT from backend/.env (5005)
```

---

## Configuration

The backend origin is read from `mobile/.env` (bundled as a Flutter asset). Copy the
example file if you do not have one:

```bash
cp .env.example .env
```

```env
API_BASE_URL=http://localhost:5005
ENABLE_REALTIME=true
ENABLE_HTTP_LOGS=true
```

| Key | Purpose |
|---|---|
| `API_BASE_URL` | Origin of the NQS backend, no trailing slash. |
| `ENABLE_REALTIME` | Connect to the backend Socket.IO server for live queue pushes. |
| `ENABLE_HTTP_LOGS` | Log requests and responses in debug builds only. |

**Which host do I use?**

| Target | Value |
|---|---|
| Android emulator | `http://10.0.2.2:5005` (applied automatically when you leave `localhost`) |
| iOS simulator | `http://localhost:5005` |
| Physical device | `http://<your-computer-LAN-IP>:5005` |
| Staging / production | `https://api.your-domain.example` |

`Env` rewrites `localhost` / `127.0.0.1` to `10.0.2.2` on Android automatically, so the
default value works on both simulators without edits. For a CI or release build you can
override the file entirely:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://api.your-domain.example
```

Cleartext HTTP is permitted only for `10.0.2.2`, `localhost` and `127.0.0.1`
(`android/app/src/main/res/xml/network_security_config.xml`). Any other host must use HTTPS.

---

## Running the app

```bash
cd mobile
flutter pub get
flutter run              # pick a device when prompted

flutter analyze          # static analysis
flutter test             # unit tests for the validation rules
```

---

## Architecture

Feature-first layering. Each feature owns its `data` (repositories), `application`
(Riverpod controllers) and `presentation` (widgets) folders.

```
lib/
  core/
    config/        Env: .env + --dart-define, Android host rewriting
    constants/     ApiEndpoints, request types, statuses, OTP purposes
    network/       ApiClient (Dio), ApiException, RealtimeService (Socket.IO)
    router/        go_router table and auth redirects
    storage/       TokenStorage on flutter_secure_storage
    theme/         Colours, light/dark themes, persisted ThemeMode
    utils/         Validators, Formatters, JSON helpers
  features/
    auth/          splash, login, register, OTP, forgot + reset password
    home/          bottom-navigation shell and dashboard
    services/      service catalogue and detail
    centers/       center list, district filter, center detail
    appointments/  booking form, my appointments, detail, history, confirmation
    queue/         live queue tracking and QR ticket
    notifications/ inbox, read state, dismissal
    profile/       profile, edit, change password, settings, logout
  shared/
    models/        AppUser, ServiceModel, CenterModel, Appointment, QueueStatus, ...
    widgets/       Reusable cards, chips, state views, buttons
  app.dart         MaterialApp.router
  main.dart        Entry point
```

**Choices worth knowing**

- **State**: Riverpod 3 (`Notifier`, `AsyncNotifier`, `FutureProvider`). No code generation.
- **Navigation**: `go_router` with a `redirect` that reads the auth state. Unauthenticated
  users can only reach the guest routes, and signed-in users are bounced off them.
- **JSON**: hand-written `fromJson`. `json_serializable` was deliberately avoided because
  several backend relations are polymorphic — `Ticket.service` is either a bare id string
  or a nested object depending on whether the response was hydrated — which generated
  code models poorly. `Json.refId` / `Json.refName` handle both shapes.
- **Freshness**: appointments poll every 20s, notifications every 30s, queue tracking
  every 15s, all on top of Socket.IO pushes and pull-to-refresh.

---

## Backend API used

No backend file was modified. Every endpoint below already existed.

### Auth
| Method | Path |
|---|---|
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| POST | `/api/auth/login/otp/verify` |
| POST | `/api/auth/login/otp/resend` |
| POST | `/api/auth/logout` |
| GET / PUT | `/api/auth/profile` |
| PUT | `/api/auth/password` |

### OTP
| Method | Path |
|---|---|
| POST | `/api/otp/request` |
| POST | `/api/otp/verify` |
| POST | `/api/otp/forgot-password/request` |
| POST | `/api/otp/forgot-password/verify` |
| POST | `/api/otp/forgot-password/reset` |

### Catalogue, bookings, queue
| Method | Path |
|---|---|
| GET | `/api/services`, `/api/services/:id` |
| GET | `/api/centers`, `/api/centers/:id` |
| GET | `/api/bookings/my`, `/api/bookings/:refOrId`, `/api/bookings/availability` |
| POST | `/api/bookings` |
| PUT | `/api/bookings/:id/cancel`, `/api/bookings/:id/resubmit` |
| GET | `/api/queue/track/:ref`, `/api/queue/live/:centerId` |
| GET | `/api/qr/generate?text=<ref>` |

### Notifications
| Method | Path |
|---|---|
| GET | `/api/notifications` |
| PUT | `/api/notifications/:id/read`, `/api/notifications/read-all` |
| DELETE | `/api/notifications/:id` |

### Realtime (Socket.IO, same origin)
Emits `joinTicket` / `joinCenter`; listens for `ticketUpdate`, `queueUpdate` and
`notification-{userId}`.

Every response follows the `{ success, data, message?, count? }` envelope, which
`ApiClient` unwraps centrally.

---

## Authentication and OTP flows

**Sign in.** `POST /api/auth/login` returns `{ token, user }`. The token is stored in the
platform keystore and attached as `Authorization: Bearer <token>` by a Dio interceptor.
The backend issues a 30-day token and has **no refresh endpoint**, so any `401` clears the
session and returns the user to the login screen.

If the backend answers with `otpRequired: true` (used for some staff roles), the app moves
to the OTP screen and finishes through `/api/auth/login/otp/verify`.

**Booking.** Creating a request is OTP-gated exactly like the web portal:

```
fill the form
  -> POST /api/otp/request   { purpose, phone }
  -> enter the 6-digit code
  -> POST /api/otp/verify    -> verificationToken
  -> POST /api/bookings      { ...payload, otpToken: verificationToken }
  -> GET  /api/qr/generate?text=<ref>
```

The half-finished booking lives in `bookingDraftProvider` while the code is entered, so the
OTP screen performs the actual submission. Resubmitting a corrected request
(`PUT /api/bookings/:id/resubmit`) does not require a new code.

**Forgot password.** `forgot-password/request` → `verify` → `reset`, using the returned
`verificationToken`.

**Validation** mirrors `backend/controllers/authController.js` so users get instant
feedback: username `[A-Za-z0-9._-]{3,}`, password 8+ characters with a letter, a digit and
a special character, and Somali phone numbers normalised to `61xxxxxxx`.

---

## Error handling

`ApiException` converts every failure into one message plus an `ApiErrorKind`:

| Situation | Behaviour |
|---|---|
| No connection / timeout | "You appear to be offline" state with a retry button |
| `401` | Session cleared, redirect to login |
| `403`, `404`, `409` | Backend `message` shown inline on the form |
| `429` | OTP resend countdown restarted from `retryAfter` |
| `5xx` | Generic retry state |

Screens use `LoadingView`, `ErrorStateView`, `EmptyStateView` and `InlineErrorBanner` so
loading, empty and failed states look consistent everywhere.

---

## Troubleshooting

**"Cannot reach the NQS server"** — confirm the backend is up (`cd backend && npm run dev`)
and that `API_BASE_URL` matches its port. On a physical device use your machine's LAN IP,
not `localhost`, and make sure both devices are on the same network.

**Cleartext traffic blocked** — Android only allows plain HTTP for the local development
hosts listed in `network_security_config.xml`. Use HTTPS for any other host.

**Booking says a code cannot be sent** — the account needs a phone number. Add one under
Profile → Edit profile; the backend sends the OTP to the number stored on the account.

**Nothing updates live** — Socket.IO may be blocked on the network. The app keeps polling,
so data still refreshes; set `ENABLE_REALTIME=false` to skip the socket entirely.
