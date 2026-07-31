# NQS - National Queue System (National ID)

A full-stack web system for booking National ID appointments and managing live service queues across Banaadir centers. Citizens book appointments and track queue tickets; operators serve center queues; admins manage centers, services, reports, and audits.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, Tailwind CSS, React Router, Socket.IO client |
| Backend | Node.js, Express, Socket.IO, JWT auth, Nodemailer |
| Database | PostgreSQL using `pg` |

## Project Structure

```text
Graduate-Team/
  backend/            Express REST API + Socket.IO server
    config/           PostgreSQL connection
    controllers/      Route handlers and business logic
    middleware/       Auth, roles, and error handling
    models/           PostgreSQL document models
    routes/           API routes
    services/         Email and SMS log services
    utils/            Seeder, RBAC helpers, scope rules
    docs/             API documentation
    server.js         Backend entry point
  frontend/           React SPA
  scripts/            Verification and maintenance scripts
  DEPLOYMENT.md       Deployment guide
```

## Getting Started

Prerequisites: Node.js 20+ and PostgreSQL.

```bash
npm run install:all
```

Copy `backend/.env.example` to `backend/.env` and set:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/nqs
POSTGRES_SSL=false
JWT_SECRET=your_secret
PORT=5001
FRONTEND_URL=http://localhost:5173
```

Seed core data:

```bash
node backend/utils/seed.js
```

Run the full system:

```bash
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` and `/socket.io` to the backend on port `5001`.

## Default Accounts

After running the backend seed:

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `Admin@12345` |
| Operator | `operator` | `Operator@123` |
| Center Manager | `<district>center` | `Center@12345` |
| Center Operator | `<district>operator` | `Operator@123` |

Example center accounts: `hodancenter`, `hodanoperator`, `dayniilecenter`, `dayniileoperator`.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for PostgreSQL, Render backend, and Vercel frontend setup.
