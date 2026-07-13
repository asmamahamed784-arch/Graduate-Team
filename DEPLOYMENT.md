# NQS National ID System Deployment Guide

This guide prepares the National Queue System for National ID services for MongoDB Atlas, Render, Vercel, and SMTP email notifications.

## 1. MongoDB Atlas

1. Create a MongoDB Atlas account and project.
2. Create a cluster.
3. Create a database user with a strong password.
4. Add your Render backend IP access rule. For simple student/demo deployment, Atlas can allow `0.0.0.0/0`, but restrict this before real production use.
5. Copy the connection string.
6. Set it as:

```env
MONGO_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/nqs-national-id
```

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
MONGO_URI=
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
- Queue ticket generation when an email is provided
- Appointment approval
- Appointment cancellation
- Appointment completion

Every delivery attempt is saved in MongoDB `emaillogs` with `Sent` or `Failed` status.

SMS is currently log-only in MongoDB. A real SMS provider can be added later in `backend/services/smsLogService.js`.

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
npm run install:all   # installs root tooling + backend + frontend
npm run seed:full     # seeds demo data (services, centers, users, tickets)
npm run dev           # runs backend and frontend together
```

Or run each side separately:

```bash
cd backend && npm run dev     # API on http://localhost:5001
cd frontend && npm run dev    # SPA on http://localhost:5173
```

Open:

```text
http://localhost:5173
```

## 6. Post-Deployment Test Checklist

After deployment, test these flows:

- Register a citizen account and confirm an email log is created.
- Login as admin, operator, and citizen.
- Load Services and Centers pages.
- Book a National ID appointment.
- Confirm the booking email is sent or logged.
- Check the ticket on Track Queue.
- Verify the ticket on QR Verify as admin/operator.
- Open Admin Appointments and approve/cancel a booking.
- Confirm approval/cancellation email logs.
- Complete a ticket from Queue Management.
- Confirm completion email logs.
- Submit the Contact form and verify the message appears in Contact Messages.
- Open Reports and confirm real database counts load.
- Open Activity Logs and confirm audit events are listed.

## 7. Production Notes

- Use a strong `JWT_SECRET`.
- Restrict Atlas network access before real production use.
- Set `FRONTEND_URL` to the final Vercel URL so CORS is restricted.
- Set `VITE_API_URL` to the final Render backend URL.
- Do not commit real `.env` files or SMTP credentials.
