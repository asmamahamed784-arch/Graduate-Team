# NQS — National Queue System (National ID)

A full-stack web system for booking National ID appointments and managing live service queues across Banaadir centers. Citizens book appointments and track queue tickets in real time; operators serve counters; admins manage centers, services, reports, and audits.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router 7, Socket.IO client, i18next, Chart.js |
| Backend | Node.js, Express 4, Socket.IO, JWT auth, Nodemailer |
| Database | MongoDB (Mongoose 8) |

## Project Structure

```
Graduate-Team/
├── backend/            # Express REST API + Socket.IO server
│   ├── config/         # Database connection
│   ├── controllers/    # Route handlers (business logic)
│   ├── middleware/     # Auth (JWT), roles, error handling
│   ├── models/         # Mongoose schemas
│   ├── routes/         # API route definitions (mounted in server.js)
│   ├── services/       # Email / SMS log services
│   ├── utils/          # Seeder, RBAC helpers, scope rules
│   ├── docs/           # API docs + Postman collection
│   └── server.js       # App entry point
├── frontend/           # React SPA (Vite)
│   ├── public/         # Static assets
│   └── src/
│       ├── api/        # Axios instance + response-envelope wrapper
│       ├── auth/       # JWT token storage helpers
│       ├── components/ # Reusable UI components
│       ├── context/    # Auth, Queue, Notification providers
│       ├── hooks/      # Custom hooks (useAuth, useQueue, ...)
│       ├── layouts/    # Main / Auth / Dashboard layouts
│       ├── pages/      # Route views (public, citizen, operator, admin)
│       ├── routes/     # Router config + route guards
│       └── utils/      # Shared helpers (ticket PDF, ...)
├── scripts/            # Verification / maintenance scripts
└── DEPLOYMENT.md       # Production deployment guide
```

## Getting Started

Prerequisites: Node.js 20+, a running MongoDB instance (local service or Atlas).

```bash
# 1. Install everything (root tooling + backend + frontend)
npm run install:all

# 2. Configure the backend
#    Copy backend/.env.example to backend/.env and fill in MONGO_URI + JWT_SECRET
#    (SMTP settings are optional in development)

# 3. Seed the database with demo data (services, centers, users, tickets)
npm run seed:full

# 4. Run backend + frontend together
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` and `/socket.io` to the backend on port 5001.

You can also run each side separately: `npm run dev:backend` / `npm run dev:frontend`, or `npm run dev` inside `backend/` or `frontend/`.

### Seeded accounts (after `npm run seed:full`)

| Role | Username | Password |
|----------|------------|----------------|
| Admin | `admin` | `Admin@12345` |
| Operator | `operator` | `Operator@123` |
| Citizen | `amina` | `password123` |

`npm run seed` (without `:full`) only ensures the admin/operator accounts exist and leaves existing data untouched.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for MongoDB Atlas, Render (backend), and Vercel (frontend) setup.
