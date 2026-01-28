import { z } from 'zod';

export const authSchemas = {
    requestOtp: {
        body: z.object({
            email: z.string().email(),
            captchaAnswer: z.string().min(1),
            captchaId: z.string().uuid()
        })
    },
    completeSignup: {
        body: z.object({
            fullName: z.string().min(2).max(100),
            email: z.string().email(),
            password: z.string().min(8).regex(/[A-Z]/, "Must contain uppercase").regex(/[0-9]/, "Must contain number"),
            otp: z.string().length(6)
        })
    },
    login: {
        body: z.object({
            email: z.string().email(),
            password: z.string().min(1)
        })
    },
    resetPassword: {
        body: z.object({
            email: z.string().email(),
            otp: z.string().length(6),
            password: z.string().min(8)
        })
    }
};

export const postSchemas = {
    create: {
        body: z.object({
            content: z.string().min(10).max(2000),
            category: z.enum(['General', 'Food', 'Art', 'Tech', 'Retail', 'Service']),
            amountNeeded: z.coerce.number().positive().max(10000000)
        })
    }
};

export const investmentSchemas = {
    invest: {
        body: z.object({
            postId: z.number().int().positive(),
            amount: z.coerce.number().positive().max(1000000)
        })
    }
};
