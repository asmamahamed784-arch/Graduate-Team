# National Queue System (NQS) API Documentation

Base URL: `http://localhost:5001`

## Authentication

### Register Citizen
`POST /api/auth/register`

```json
{
  "name": "Amina Ali",
  "email": "amina.ali@gov.so",
  "phone": "+252 61 000 0003",
  "password": "password123"
}
```

### Login Citizen
`POST /api/auth/login`

```json
{
  "email": "amina.ali@gov.so",
  "password": "password123"
}
```

### Get Profile
`GET /api/auth/profile`

Requires `Authorization: Bearer <token>`.

## Centers

### List Centers
`GET /api/centers`

Returns Banaadir National ID centers.

### Create Center
`POST /api/centers`

Admin only.

```json
{
  "name": "Banaadir National ID Center",
  "address": "Banaadir Regional Administration, Mogadishu",
  "city": "Banaadir",
  "phone": "+252 61 000 1001",
  "counters": 12,
  "capacity": 500,
  "hours": "08:00 AM - 05:00 PM"
}
```

## Services

### List Services
`GET /api/services`

Returns the active National ID Registration service.

### Create Service
`POST /api/services`

Admin only.

```json
{
  "name": "National ID Registration",
  "description": "Apply for a new National ID card, update identity details, or receive appointment support.",
  "category": "National ID",
  "duration": 15,
  "priority": "High",
  "requirements": ["Existing identification or birth record", "Recent ID photo", "Completed National ID application form"]
}
```

## Bookings

### Book Appointment
`POST /api/bookings`

Citizen or admin access.

```json
{
  "serviceId": "603f90bcf8b39c001f301490",
  "centerId": "603f90bcf8b39c001f301495",
  "date": "2026-06-07",
  "timeSlot": "09:30 AM"
}
```

### Get My Bookings
`GET /api/bookings/my`

Citizen access.

### Cancel Appointment
`PUT /api/bookings/:id/cancel`

Citizen or admin access.

## Queue

### Call Next Ticket
`POST /api/queue/call-next`

Operator or admin access.

```json
{
  "centerId": "603f90bcf8b39c001f301495",
  "counter": "Counter 03"
}
```

### Put Ticket On Hold
`PUT /api/queue/:id/hold`

Operator or admin access.

### Complete Ticket
`PUT /api/queue/:id/complete`

Operator or admin access.

### Track Ticket
`GET /api/queue/track/:ref`

Public access.

```json
{
  "success": true,
  "data": {
    "reference": "NQS-3041",
    "status": "Waiting",
    "position": 2,
    "estimatedWait": "30 min",
    "center": "Banaadir National ID Center",
    "service": "National ID Registration"
  }
}
```

## Reports, Notifications, and Audits

### Dashboard Statistics
`GET /api/reports/stats`

Operator or admin access.

### Audit Logs
`GET /api/audits`

Admin access.
