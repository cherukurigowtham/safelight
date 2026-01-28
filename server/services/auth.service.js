import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { insertWalletTransaction } from '../repositories/wallet.repository.js';

import {
    ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_IN
} from '../config/env.js';

export async function registerUser({ fullName, email, password }) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `
            INSERT INTO users (full_name, email, password_hash, email_verified)
            VALUES ($1, $2, $3, true)
            RETURNING id, full_name, email
            `,
            [fullName, email, hashedPassword]
        );

        const user = rows[0];

        // Add welcome bonus
        await insertWalletTransaction(client, {
            userId: user.id,
            amount: 1000,
            type: 'WELCOME',
            referenceId: null
        });

        await client.query('COMMIT');
        return user;
    } catch (err) {
        await client.query('ROLLBACK');
        // Unique email violation
        if (err.code === '23505') {
            return null;
        }
        throw err;
    } finally {
        client.release();
    }
}

export async function findUserByEmail(email) {
    const { rows } = await pool.query(
        `SELECT id, full_name AS "fullName", email, password_hash, balance
         FROM users
         WHERE email = $1`,
        [email]
    );
    return rows[0];
}

export function generateTokens(user) {
    const accessToken = jwt.sign(
        { id: user.id, email: user.email },
        ACCESS_TOKEN_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
        { id: user.id },
        REFRESH_TOKEN_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    return { accessToken, refreshToken };
}

export async function saveRefreshToken(userId, token, expiresAt) {
    await pool.query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
        [userId, token, expiresAt]
    );
}

export async function deleteRefreshToken(token) {
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
}
