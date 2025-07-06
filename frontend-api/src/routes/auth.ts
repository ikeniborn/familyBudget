import { Router } from 'express';
import { backendApi } from '../services/backendApi';
import { verifyTelegramAuth } from '../utils/telegramAuth';

const router = Router();

// Telegram auth callback
router.post('/telegram', async (req, res, next) => {
  try {
    const authData = req.body;
    const { id, first_name, last_name, username } = authData;

    // Verify telegram auth data
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({ error: 'Bot token not configured' });
    }

    const isValid = verifyTelegramAuth(authData, botToken);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid authentication data' });
    }

    // Check if user exists in database
    const users = await backendApi.getUsers();
    const user = users.find((u: any) => u.user_telegram_id === id);

    if (!user) {
      return res.status(403).json({ error: 'User not found in database' });
    }

    // Create session
    req.session = req.session || {};
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
router.post('/logout', (req, res) => {
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
router.get('/me', (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.session.user });
});

export default router;