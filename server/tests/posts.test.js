import { jest } from '@jest/globals';
import request from 'supertest';
import { setupTestDb } from './test-utils.js';

const { pool } = setupTestDb();

jest.unstable_mockModule('../config/db.js', () => ({ pool }));
jest.unstable_mockModule('../services/email.service.js', () => ({
    sendEmailOtp: jest.fn().mockResolvedValue(true)
}));
jest.unstable_mockModule('../services/captcha.service.js', () => ({
    verifyCaptcha: jest.fn().mockReturnValue(true)
}));

const { default: app } = await import('../app.js');

describe('Posts Endpoints', () => {
    let token;

    beforeAll(async () => {
        // Mock Captcha Flow (DB approach) or use a helper.
        // For simplicity in test, we can request a captcha first.
        const captchaRes = await request(app).get('/api/captcha');
        const captchaId = captchaRes.body.id;
        const [a, b] = captchaRes.body.question.split(' + ');
        const captchaAnswer = (parseInt(a) + parseInt(b)).toString();

        await request(app).post('/api/signup/request-otp').send({
            email: 'poster@example.com',
            captchaAnswer,
            captchaId
        });

        const { sendEmailOtp } = await import('../services/email.service.js');
        const otp = sendEmailOtp.mock.calls[0][1];

        const signupRes = await request(app).post('/api/signup/complete').send({
            fullName: 'Poster',
            email: 'poster@example.com',
            password: 'Password123!',
            otp
        });
        token = signupRes.body.accessToken;
    });

    it('should create a post', async () => {
        const res = await request(app)
            .post('/api/posts')
            .set('Authorization', `Bearer ${token}`)
            .send({
                content: 'My Investment Idea',
                category: 'Tech',
                amountNeeded: 5000
            });

        expect(res.status).toBe(201);
        expect(res.body.content).toBe('My Investment Idea');
    });

    it('should list posts', async () => {
        const res = await request(app)
            .get('/api/posts');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0].content).toBe('My Investment Idea');
    });
});
