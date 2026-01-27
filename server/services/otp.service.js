import crypto from 'crypto';
import { pool } from '../config/db.js';

function hashOtp(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/* ============================================================
   CREATE OTP (EMAIL ONLY, NO USER YET)
   ============================================================ */

export async function createEmailOtp(email) {
    const otp = generateOtp();
    const hashed = hashOtp(otp);

    await pool.query(
        `
        INSERT INTO otps (email, code, type, expires_at)
        VALUES ($1, $2, 'EMAIL', NOW() + INTERVAL '5 minutes')
        `,
        [email, hashed]
    );

    return otp;
}

/* ============================================================
   VERIFY OTP
   ============================================================ */

export async function verifyEmailOtp(email, otp) {
    const hashed = hashOtp(otp);

    const { rows } = await pool.query(
        `
        SELECT id FROM otps
        WHERE email = $1
          AND code = $2
          AND used = false
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [email, hashed]
    );

    if (!rows.length) return false;

    await pool.query(
        `UPDATE otps SET used = true WHERE id = $1`,
        [rows[0].id]
    );

    return true;
}
