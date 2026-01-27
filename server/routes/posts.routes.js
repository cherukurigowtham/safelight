import express from 'express';
import { getPosts, createPost } from '../controllers/posts.controller.js';
import { authenticateAccessToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/posts', getPosts);
router.post('/posts', authenticateAccessToken, createPost);

export default router;
