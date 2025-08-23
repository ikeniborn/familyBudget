import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import authPasswordRoutes from './routes/auth-password';
import authRoutes from './routes/auth';
import simpleApiRoutes from './routes/api/simple';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Basic middleware
app.use(cors({
  origin: [
    'http://localhost:3000',  // Production SvelteKit build
    'http://localhost:5173',  // SvelteKit dev server
    process.env.FRONTEND_URL || 'http://localhost:3000'
  ],
  credentials: true,
}));
app.use(express.json());

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    },
  })
);

// Routes
app.use('/api/auth', authPasswordRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', simpleApiRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'API is running (simplified mode with auth)'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Frontend API server running on http://localhost:${PORT}`);
  console.log('Running in simplified mode with password authentication');
  console.log(`Password auth enabled: ${process.env.ENABLE_PASSWORD_AUTH === 'true'}`);
});