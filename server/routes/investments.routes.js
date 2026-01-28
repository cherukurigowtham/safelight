import express from 'express';
import { invest } from '../controllers/investments.controller.js';
import { authenticateAccessToken } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { investmentSchemas } from '../validators/schemas.js';

const router = express.Router();

router.post('/invest', authenticateAccessToken, validate(investmentSchemas.invest), invest);

export default router;
