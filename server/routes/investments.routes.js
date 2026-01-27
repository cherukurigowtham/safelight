import express from 'express';
import { invest } from '../controllers/investments.controller.js';
import { authenticateAccessToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/invest', authenticateAccessToken, invest);

export default router;
