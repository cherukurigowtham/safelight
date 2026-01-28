import express from 'express';
import { getPosts, createPost } from '../controllers/posts.controller.js';
import { authenticateAccessToken } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { postSchemas } from '../validators/schemas.js';

const router = express.Router();

router.get('/posts', getPosts);
router.post('/posts', authenticateAccessToken, validate(postSchemas.create), createPost);

export default router;
