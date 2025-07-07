import express from 'express';
import { UserService } from '../../services/UserService';
import prisma from '../../database/prisma';

const router = express.Router();
const userService = new UserService(prisma);

// GET /api/users - Get all users
router.get('/', async (req, res) => {
  try {
    const users = await userService.getAll();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await userService.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /api/users/telegram/:telegramId - Get user by Telegram ID
router.get('/telegram/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const user = await userService.findByTelegramId(telegramId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user by Telegram ID:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  try {
    const { userName, userEmail, telegramId } = req.body;

    if (!userName || !telegramId) {
      return res.status(400).json({ error: 'userName and telegramId are required' });
    }

    const user = await userService.create({
      userName,
      userEmail,
      telegramId
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const { userName, userEmail, isActive } = req.body;
    
    const user = await userService.update(userId, {
      userName,
      userEmail,
      isActive
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;