import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorMiddleware.js';

// Load route files
import authRoutes from './routes/authRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import centerRoutes from './routes/centerRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import queueRoutes from './routes/queueRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import counterRoutes from './routes/counterRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import qrRoutes from './routes/qrRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import operatorRoutes from './routes/operatorRoutes.js';
import operatorApiRoutes from './routes/operatorApiRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';

// Load config
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

// Socket.io initialization
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Expose io object globally to access in controllers
app.set('io', io);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Socket.io Real-time connection handler
io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  // Room scoping: join by center to receive specific queue updates
  socket.on('joinCenter', (centerId) => {
    socket.join(centerId);
    console.log(`🏢 Client joined center room: ${centerId}`);
  });

  // Room scoping: join by ticket reference to track a single ticket
  socket.on('joinTicket', (ticketRef) => {
    socket.join(ticketRef);
    console.log(`🎫 Client tracking ticket: ${ticketRef}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/centers', centerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/counters', counterRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/operators', operatorRoutes);
app.use('/api/operator', operatorApiRoutes);
app.use('/api/sessions', sessionRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'NQS National ID Appointment API is running.' });
});

// Error handling middleware (must be registered last)
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the existing NQS backend process or set a different PORT in backend/.env.`);
    process.exit(1);
  }
  throw error;
});
