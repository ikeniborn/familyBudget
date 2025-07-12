import { Router } from 'express';
import { backendApi } from '../services/backendApi';
import { verifyTelegramAuth } from '../utils/telegramAuth';

const router = Router();

// Telegram auth callback
router.post('/telegram', async (req, res, next): Promise<void> => {
  try {
    const authData = req.body;
    const { id, first_name, last_name, username } = authData;

    // Verify telegram auth data
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      res.status(500).json({ error: 'Bot token not configured' });
      return;
    }

    const isValid = verifyTelegramAuth(authData, botToken);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid authentication data' });
      return;
    }

    // Check if user exists in database
    const users = await backendApi.getUsers();
    const user = users.find((u: any) => u.user_telegram_id === id);

    if (!user) {
      res.status(403).json({ error: 'User not found in database' });
      return;
    }

    // Create session
    if (!req.session) {
      res.status(500).json({ error: 'Session not initialized' });
      return;
    }
    req.session.user = {
      user_id: user.user_id,
      user_telegram_id: id,
      first_name,
      last_name,
      username,
    };

    res.json({ 
      success: true, 
      user: req.session.user 
    });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', (req, res): void => {
  if (req.session) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  } else {
    res.json({ success: true });
  }
});

// Get current user
router.get('/me', (req, res): void => {
  if (!req.session?.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({ user: req.session.user });
});

export default router;