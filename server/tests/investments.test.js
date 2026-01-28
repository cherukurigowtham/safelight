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

describe('Investments Endpoints', () => {
    let investorToken;
    let creatorToken;
    let postId;

    beforeAll(async () => {
        const { sendEmailOtp } = await import('../services/email.service.js');

        // Helper
        const getCaptcha = async () => {
            const res = await request(app).get('/api/captcha');
            const id = res.body.id;
            const [a, b] = res.body.question.split(' + ');
            const answer = (parseInt(a) + parseInt(b)).toString();
            return { id, answer };
        };

        // Create Creator
        let cap = await getCaptcha();
        await request(app).post('/api/signup/request-otp').send({ email: 'creator@example.com', captchaAnswer: cap.answer, captchaId: cap.id });
        let otp = sendEmailOtp.mock.calls[0][1];
        const creatorRes = await request(app).post('/api/signup/complete').send({ fullName: 'Creator', email: 'creator@example.com', password: 'Password123!', otp });
        creatorToken = creatorRes.body.accessToken;

        // Create Investor
        cap = await getCaptcha();
        await request(app).post('/api/signup/request-otp').send({ email: 'investor@example.com', captchaAnswer: cap.answer, captchaId: cap.id });
        otp = sendEmailOtp.mock.calls[1][1];
        const investorRes = await request(app).post('/api/signup/complete').send({ fullName: 'Investor', email: 'investor@example.com', password: 'Password123!', otp });
        investorToken = investorRes.body.accessToken;

        // Create Post
        const postRes = await request(app)
            .post('/api/posts')
            .set('Authorization', `Bearer ${creatorToken}`)
            .send({
                content: 'Invest in Me',
                category: 'Tech',
                amountNeeded: 10000
            });
        postId = postRes.body.id;
    });

    it('should invest in a post', async () => {
        // Investor has 1000 balance (welcome bonus)
        const res = await request(app)
            .post('/api/invest')
            .set('Authorization', `Bearer ${investorToken}`)
            .send({
                postId: postId,
                amount: 500
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.investment.amount).toBe(500);

        // Check balance
        const balanceRes = await request(app)
            .get('/api/profile')
            .set('Authorization', `Bearer ${investorToken}`);

        expect(balanceRes.body.user.balance).toBe(500); // 1000 - 500
    });

    it('should fail if insufficient funds', async () => {
        const res = await request(app)
            .post('/api/invest')
            .set('Authorization', `Bearer ${investorToken}`)
            .send({
                postId: postId,
                amount: 600 // Only 500 left
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Insufficient balance');
    });
});
