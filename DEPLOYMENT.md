# NQS National ID System Deployment Guide

This guide prepares the National Queue System for National ID services for PostgreSQL, Render, Vercel, and SMTP email notifications.

## 1. PostgreSQL Database

Use PostgreSQL locally or a hosted PostgreSQL provider such as Render PostgreSQL, Railway, Neon, Supabase, or your university server.

Create a database named `nqs` for local development:

```bash
createdb -U postgres nqs
```

Set the backend database URL:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/nqs
POSTGRES_SSL=false
```

For hosted PostgreSQL, copy the provider connection string into `DATABASE_URL`. Set `POSTGRES_SSL=true` only if the provider requires SSL.

Do not hardcode the database URL in code.

## 2. Render Backend

1. Push the project to GitHub.
2. Create a new Render Web Service.
3. Set the root directory to:

```text
backend
```

4. Set the build command:

```bash
npm install
```

5. Set the start command:

```bash
npm start
```

6. Add environment variables:

```env
DATABASE_URL=
POSTGRES_SSL=true
JWT_SECRET=
PORT=5001
FRONTEND_URL=https://your-vercel-app.vercel.app
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Render provides `PORT` automatically. Keeping `PORT=5001` locally is fine.

## 3. SMTP Email

Use a real SMTP provider such as Gmail App Password, Brevo, Mailgun, SendGrid SMTP, or your university mail server.

Required variables:

```env
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Emails are sent for:

- User registration
- Booking confirmation
- Queue ticket generation when contact details are available
- Appointment approval
- Appointment cancellation
- Appointment completion

Every delivery attempt is saved in PostgreSQL `doc_emaillogs` with `Sent` or `Failed` status.

SMS is currently log-only in PostgreSQL. A real SMS provider can be added later in `backend/services/smsLogService.js`.

## 4. Vercel Frontend

1. Create a new Vercel project from the GitHub repository.
2. Set the root directory to:

```text
frontend
```

3. Set the build command:

```bash
npm run build
```

4. Set the output directory:

```text
dist
```

5. Add environment variable:

```env
VITE_API_URL=https://your-render-backend.onrender.com
```

Local development can leave `VITE_API_URL` empty and use the Vite proxy to the local backend.

## 5. Local Development

From the repository root:

```bash
npm run install:all
node backend/utils/seed.js
npm run dev
```

Or run each side separately:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Open:

```text
http://localhost:5173
```

## 6. Post-Deployment Test Checklist

After deployment, test these flows:

- Register a citizen account.
- Login as admin, operator, center manager, and citizen.
- Load Services and Centers pages.
- Book a National ID appointment.
- Confirm the booking appears in the citizen dashboard and admin appointments.
- Check the ticket on Track Queue.
- Verify the ticket on QR Verify as admin/operator.
- Approve/cancel a booking from Admin Appointments.
- Confirm cancellation notification appears only for the correct citizen.
- Complete a ticket from Queue Management.
- Submit the Contact form and verify the message appears in Contact Messages.
- Open Reports and confirm real PostgreSQL counts load.
- Open Activity Logs and confirm audit events are listed.

## 7. Production Notes

- Use a strong `JWT_SECRET`.
- Restrict PostgreSQL network access before real production use.
- Set `FRONTEND_URL` to the final Vercel URL so CORS is restricted.
- Set `VITE_API_URL` to the final Render backend URL.
- Do not commit real `.env` files or SMTP credentials.
