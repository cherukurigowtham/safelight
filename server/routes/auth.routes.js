import express from 'express';
import {
    requestSignupOtp,
    completeSignup,
    requestPasswordReset,
    resetPassword,
    login,
    logout,
    getProfile
} from '../controllers/auth.controller.js';
import { authenticateAccessToken } from '../middleware/auth.middleware.js';

const router = express.Router();

/* Signup */
router.post('/signup/request-otp', requestSignupOtp);
router.post('/signup/complete', completeSignup);

/* Forgot Password */
router.post('/password/request-otp', requestPasswordReset);
router.post('/password/reset', resetPassword);

/* Auth */
router.post('/login', login);
router.post('/logout', logout);
router.get('/profile', authenticateAccessToken, getProfile);

export default router;
