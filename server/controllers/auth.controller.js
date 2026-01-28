import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { registerUser, generateTokens, findUserByEmail, saveRefreshToken, deleteRefreshToken } from '../services/auth.service.js';
import { createEmailOtp, verifyEmailOtp } from '../services/otp.service.js';
import { sendEmailOtp } from '../services/email.service.js';
import { verifyCaptcha } from '../services/captcha.service.js';
import { getUserBalance } from '../repositories/wallet.repository.js';

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

        // Save refresh token
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await saveRefreshToken(user.id, tokens.refreshToken, expiresAt);

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

/* ============================================================
   LOGIN
   ============================================================ */
export async function login(req, res) {
    try {
        const { email, password } = req.body;
        const user = await findUserByEmail(email);

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const tokens = generateTokens(user);

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await saveRefreshToken(user.id, tokens.refreshToken, expiresAt);

        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            path: '/api/refresh'
        });

        res.json({
            success: true,
            accessToken: tokens.accessToken,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Login failed' });
    }
}

/* ============================================================
   LOGOUT
   ============================================================ */
export async function logout(req, res) {
    try {
        const { refreshToken } = req.cookies;
        if (refreshToken) {
            await deleteRefreshToken(refreshToken);
        }
        res.clearCookie('refreshToken', { path: '/api/refresh' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Logout failed' });
    }
}

/* ============================================================
   PROFILE
   ============================================================ */
export async function getProfile(req, res) {
    try {
        const userId = req.user.id;

        const { rows } = await pool.query('SELECT id, full_name AS "fullName", email FROM users WHERE id = $1', [userId]);
        const user = rows[0];

        if (!user) return res.status(404).json({ message: 'User not found' });

        const balance = await getUserBalance(pool, userId);

        res.json({
            success: true,
            user: {
                ...user,
                balance
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch profile' });
    }
}
