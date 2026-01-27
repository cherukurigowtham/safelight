import nodemailer from 'nodemailer';

import { EMAIL_USER, EMAIL_APP_PASSWORD } from '../config/env.js';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_APP_PASSWORD
    }
});

export async function sendEmailOtp(email, otp) {
    await transporter.sendMail({
        to: email,
        from: EMAIL_USER,
        subject: 'Your OTP',
        html: `<h2>${otp}</h2><p>Expires in 5 minutes</p>`
    });
}
