import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { EMAIL_USER, EMAIL_APP_PASSWORD, NODE_ENV } from '../config/env.js';
import logger from '../config/logger.js';

let transporter;

if (NODE_ENV === 'production') {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_APP_PASSWORD
        }
    });
} else {
    // Dev/Test: No-op or log to file
    transporter = {
        sendMail: async (mailOptions) => {
            const logPath = path.join(process.cwd(), 'email_logs.txt');
            const logEntry = `\n[${new Date().toISOString()}] To: ${mailOptions.to} | Subject: ${mailOptions.subject} | Content: ${mailOptions.html}`;
            fs.appendFileSync(logPath, logEntry);
            logger.info(`Email sent mock to ${mailOptions.to} (logged to email_logs.txt)`);
            return Promise.resolve();
        }
    };
}

export async function sendEmailOtp(email, otp) {
    try {
        await transporter.sendMail({
            to: email,
            from: EMAIL_USER || 'no-reply@invesa.com',
            subject: 'Your OTP',
            html: `<h2>${otp}</h2><p>Expires in 5 minutes</p>`
        });
    } catch (err) {
        logger.error('Failed to send email', err);
        throw err;
    }
}
