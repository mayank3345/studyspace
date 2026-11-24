import { Router } from 'express';
import { currentUser, login, logout, register } from '../controllers/auth.controller.js';
import { requireSession } from '../middleware/session-auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireSession, currentUser);
router.post('/logout', requireSession, logout);

export default router;
