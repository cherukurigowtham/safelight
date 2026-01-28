import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes.js';
import postsRoutes from './routes/posts.routes.js';
import investmentsRoutes from './routes/investments.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

app.use(helmet());

app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json());
app.use(cookieParser());

app.use('/api', authRoutes);
app.use('/api', postsRoutes);
app.use('/api', investmentsRoutes);

app.use(errorHandler);


export default app;
