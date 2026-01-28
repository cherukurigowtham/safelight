import { jest } from '@jest/globals';
import request from 'supertest';
import { setupTestDb } from './test-utils.js';

const { pool } = setupTestDb();

// Mock dependencies
jest.unstable_mockModule('../config/db.js', () => ({ pool }));
jest.unstable_mockModule('../services/email.service.js', () => ({
    sendEmailOtp: jest.fn().mockResolvedValue(true)
}));

// We don't mock captcha.controller.js because we want to test it (or mock it if it's external, but now it's internal DB).
// However, the controller is imported by auth.controller.js.
// Since we are using the real controller, we need to make sure the flow works.
// Or we can mock the verifyCaptcha function from the controller if we want to bypass the DB check.
// Let's use real DB check for integration test completeness.

const { default: app } = await import('../app.js');

describe('Auth Endpoints', () => {
    let otp;
    let captchaId;
    let captchaAnswer;

    it('should get captcha', async () => {
        const res = await request(app).get('/api/captcha');
        expect(res.status).toBe(200);
        expect(res.body.id).toBeDefined();
        expect(res.body.question).toBeDefined();

        captchaId = res.body.id;
        const [a, b] = res.body.question.split(' + ');
        captchaAnswer = (parseInt(a) + parseInt(b)).toString();
    });

    it('should request signup OTP', async () => {
        const res = await request(app)
            .post('/api/signup/request-otp')
            .send({
                email: 'test@example.com',
                captchaAnswer: captchaAnswer,
                captchaId: captchaId
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should complete signup and have initial balance', async () => {
        const { sendEmailOtp } = await import('../services/email.service.js');
        otp = sendEmailOtp.mock.calls[0][1];

        const res = await request(app)
            .post('/api/signup/complete')
            .send({
                fullName: 'Test User',
                email: 'test@example.com',
                password: 'Password123!', // Met complexity requirements
                otp
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user).toBeDefined();

        const balanceRes = await pool.query('SELECT * FROM wallet_transactions WHERE user_id = $1', [res.body.user.id]);
        expect(balanceRes.rows.length).toBe(1);
        expect(balanceRes.rows[0].amount).toBe(1000);
        expect(balanceRes.rows[0].type).toBe('WELCOME');
    });

    it('should login', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({
                email: 'test@example.com',
                password: 'Password123!'
            });

        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBeDefined();
        // Check for refreshToken cookie
        const cookies = res.headers['set-cookie'];
        expect(cookies).toBeDefined();
        expect(cookies.some(c => c.includes('refreshToken'))).toBe(true);
    });

    it('should get profile', async () => {
         const loginRes = await request(app)
            .post('/api/login')
            .send({
                email: 'test@example.com',
                password: 'Password123!'
            });
         const token = loginRes.body.accessToken;

         const res = await request(app)
            .get('/api/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.user.balance).toBe(1000);
    });
});
