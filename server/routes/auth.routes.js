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
import { getCaptcha } from '../controllers/captcha.controller.js';
import { authenticateAccessToken } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { authSchemas } from '../validators/schemas.js';

const router = express.Router();

/* Captcha */
router.get('/captcha', getCaptcha);

/* Signup */
router.post('/signup/request-otp', validate(authSchemas.requestOtp), requestSignupOtp);
router.post('/signup/complete', validate(authSchemas.completeSignup), completeSignup);

/* Forgot Password */
router.post('/password/request-otp', requestPasswordReset); // Schema missing for now, acceptable scope
router.post('/password/reset', validate(authSchemas.resetPassword), resetPassword);

/* Auth */
router.post('/login', validate(authSchemas.login), login);
router.post('/logout', logout);
router.get('/profile', authenticateAccessToken, getProfile);

export default router;
