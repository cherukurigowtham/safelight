import jwt from 'jsonwebtoken';
import { ACCESS_TOKEN_SECRET } from '../config/env.js';

export function authenticateAccessToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.sendStatus(401);

    try {
        req.user = jwt.verify(token, ACCESS_TOKEN_SECRET);
        next();
    } catch {
        res.sendStatus(403);
    }
}
