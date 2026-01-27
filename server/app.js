import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';


import authRoutes from './routes/auth.routes.js';
import postsRoutes from './routes/posts.routes.js';
import investmentsRoutes from './routes/investments.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api', authRoutes);
app.use('/api', postsRoutes);
app.use('/api', investmentsRoutes);

app.use(errorHandler);


export default app;
