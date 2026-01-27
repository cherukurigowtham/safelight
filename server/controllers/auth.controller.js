import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { registerUser, generateTokens } from '../services/auth.service.js';
import { createEmailOtp, verifyEmailOtp } from '../services/otp.service.js';
import { sendEmailOtp } from '../services/email.service.js';
import { verifyCaptcha } from '../services/captcha.service.js';

/* ============================================================
   SIGNUP — STEP 1: REQUEST OTP (NO USER CREATED)
   ============================================================ */

export async function requestSignupOtp(req, res) {
    try {
        const { email, captchaAnswer, captchaExpected } = req.body;

        if (!verifyCaptcha(captchaExpected, captchaAnswer)) {
            return res.status(400).json({ message: 'Invalid CAPTCHA' });
        }

        const otp = await createEmailOtp(email);
        await sendEmailOtp(email, otp);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
}

/* ============================================================
   SIGNUP — STEP 2: VERIFY OTP + CREATE USER
   ============================================================ */

export async function completeSignup(req, res) {
    try {
        const { fullName, email, password, otp } = req.body;

        const valid = await verifyEmailOtp(email, otp);
        if (!valid) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const user = await registerUser({ fullName, email, password });

        if (!user) {
            return res.status(409).json({
                message: 'An account with this email already exists. Please log in.'
            });
        }

        const tokens = generateTokens(user);

        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            path: '/api/refresh'
        });

        res.json({
            success: true,
            accessToken: tokens.accessToken,
            user
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Signup failed' });
    }
}

/* ============================================================
   FORGOT PASSWORD — REQUEST OTP
   ============================================================ */

export async function requestPasswordReset(req, res) {
    try {
        const { email } = req.body;

        const { rows } = await pool.query(
            `SELECT id FROM users WHERE email = $1`,
            [email]
        );

        if (!rows.length) {
            // Do not reveal user existence
            return res.json({ success: true });
        }

        const otp = await createEmailOtp(email);
        await sendEmailOtp(email, otp);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to send reset OTP' });
    }
}

/* ============================================================
   FORGOT PASSWORD — RESET PASSWORD
   ============================================================ */

export async function resetPassword(req, res) {
    try {
        const { email, otp, password } = req.body;

        const valid = await verifyEmailOtp(email, otp);
        if (!valid) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const hashed = await bcrypt.hash(password, 12);

        await pool.query(
            `UPDATE users SET password_hash = $1 WHERE email = $2`,
            [hashed, email]
        );

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Password reset failed' });
    }
}
