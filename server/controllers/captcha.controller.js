import { pool } from '../config/db.js';
import crypto from 'crypto';

export async function getCaptcha(req, res) {
    try {
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        const answer = (a + b).toString();
        const id = crypto.randomUUID();

        // Store hash of answer
        const hash = crypto.createHash('sha256').update(answer).digest('hex');

        await pool.query(
            `INSERT INTO captcha_challenges (id, answer_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
            [id, hash]
        );

        res.json({
            id,
            question: `${a} + ${b}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to generate CAPTCHA' });
    }
}

export async function verifyCaptcha(id, answer) {
    const hash = crypto.createHash('sha256').update(answer).digest('hex');

    const { rows } = await pool.query(
        `DELETE FROM captcha_challenges WHERE id = $1 AND answer_hash = $2 AND expires_at > NOW() RETURNING id`,
        [id, hash]
    );

    return rows.length > 0;
}
