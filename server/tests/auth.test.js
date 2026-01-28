import { jest } from '@jest/globals';
import request from 'supertest';
import { setupTestDb } from './test-utils.js';

const { pool } = setupTestDb();

// Mock dependencies
jest.unstable_mockModule('../config/db.js', () => ({ pool }));
jest.unstable_mockModule('../services/email.service.js', () => ({
    sendEmailOtp: jest.fn().mockResolvedValue(true)
}));
jest.unstable_mockModule('../services/captcha.service.js', () => ({
    verifyCaptcha: jest.fn().mockReturnValue(true)
}));

const { default: app } = await import('../app.js');

describe('Auth Endpoints', () => {
    let otp;

    it('should request signup OTP', async () => {
        const res = await request(app)
            .post('/api/signup/request-otp')
            .send({
                email: 'test@example.com',
                captchaAnswer: '123',
                captchaExpected: 'hashed123'
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
                password: 'password123',
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
                password: 'password123'
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
                password: 'password123'
            });
         const token = loginRes.body.accessToken;

         const res = await request(app)
            .get('/api/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.user.balance).toBe(1000);
    });
});
