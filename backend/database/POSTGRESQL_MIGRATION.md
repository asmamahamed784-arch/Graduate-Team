# PostgreSQL Backend Notes

The NQS backend now uses PostgreSQL through `DATABASE_URL`.

The application stores backend data in PostgreSQL through Prisma so the controllers, routes, authentication, booking, queue, QR, notification, and dashboard logic use one PostgreSQL backend.

## Required Environment

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/nqs
POSTGRES_SSL=false
JWT_SECRET=your_secret
PORT=5001
FRONTEND_URL=http://localhost:5173
```

For hosted PostgreSQL providers, set `POSTGRES_SSL=true` only if the provider requires SSL.

## Local Setup

1. Start PostgreSQL.
2. Create the `nqs` database if it does not exist.
3. Run the backend seed:

```powershell
node backend/utils/seed.js
```

The seed creates the document tables automatically and ensures the default admin, operator, National ID services, Banaadir centers, center managers, and center operators exist.

## Backup And Restore

Use PostgreSQL tools:

```powershell
pg_dump -U postgres -h localhost -d nqs > nqs_backup.sql
psql -U postgres -h localhost -d nqs -f nqs_backup.sql
```

## Tables

The document tables are named with a `doc_` prefix, for example:

- `doc_users`
- `doc_centers`
- `doc_services`
- `doc_tickets`
- `doc_notifications`
- `doc_auditlogs`
- `doc_activitylogs`
- `doc_qrscans`

This PostgreSQL layer preserves the current NQS behavior without requiring a new backend project.
