import { Router, Request, Response } from 'express';
// import bcrypt from 'bcryptjs'; // Uncomment when needed for real password hashing

declare module 'express-session' {
  interface SessionData {
    user?: {
      user_id: number;
      user_telegram_id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  }
}

const router = Router();

interface LoginRequest {
  username: string;
  password: string;
}

// Login with username/password
router.post('/login', async (req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // Check if password auth is enabled
    if (process.env.ENABLE_PASSWORD_AUTH !== 'true') {
      res.status(403).json({ error: 'Password authentication is disabled' });
      return;
    }

    // Check admin credentials
    if (username === process.env.ADMIN_USERNAME) {
      // For admin, compare with environment variable
      // In production, you should hash the admin password too
      const isValidPassword = password === process.env.ADMIN_PASSWORD;
      
      if (isValidPassword) {
        // Create session for admin
        req.session.user = {
          user_id: 1, // Admin user ID
          user_telegram_id: 0, // No telegram ID for admin
          first_name: 'Admin',
          last_name: 'User',
          username: 'admin'
        };
        
        res.json({
          success: true,
          user: {
            id: 1,
            username: 'admin',
            firstName: 'Admin',
            lastName: 'User',
            isAdmin: true
          }
        });
        return;
      }
    }

    // For future: check database for other users
    // const user = await prisma.user.findFirst({
    //   where: { username }
    // });
    // if (user && await bcrypt.compare(password, user.password_hash)) {
    //   // Create session
    // }

    res.status(401).json({ error: 'Invalid username or password' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if password auth is enabled
router.get('/password-auth-enabled', (_req: Request, res: Response): void => {
  res.json({
    enabled: process.env.ENABLE_PASSWORD_AUTH === 'true'
  });
});

// Logout
router.post('/logout', (req: Request, res: Response): void => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Could not logout' });
      return;
    }
    res.json({ success: true });
  });
});

// Get current user
router.get('/me', (req: Request, res: Response): void => {
  if (!req.session.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  
  res.json({
    user: {
      id: req.session.user.user_id,
      username: req.session.user.username,
      firstName: req.session.user.first_name,
      lastName: req.session.user.last_name,
      isAdmin: req.session.user.username === 'admin'
    }
  });
});

export default router;