import { Router } from 'express';
import { answerQuestion } from '../controllers/chat.controller.js';
import { requireSession } from '../middleware/session-auth.middleware.js';

const router = Router();

router.post('/', requireSession, answerQuestion);

export default router;
