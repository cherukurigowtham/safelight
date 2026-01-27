import express from 'express';
import {
    requestSignupOtp,
    completeSignup,
    requestPasswordReset,
    resetPassword
} from '../controllers/auth.controller.js';

const router = express.Router();

/* Signup */
router.post('/signup/request-otp', requestSignupOtp);
router.post('/signup/complete', completeSignup);

/* Forgot Password */
router.post('/password/request-otp', requestPasswordReset);
router.post('/password/reset', resetPassword);

export default router;
