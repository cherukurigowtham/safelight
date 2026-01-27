export const PORT = process.env.PORT || 3001;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const DATABASE_URL = process.env.DATABASE_URL;
export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

export const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
export const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;

export const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
export const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export const EMAIL_USER = process.env.EMAIL_USER;
export const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;

// Validation for critical ones
const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
required.forEach(key => {
    if (!process.env[key]) {
        console.error(`CRITICAL: Environment variable ${key} is missing!`);
        if (NODE_ENV === 'production') process.exit(1);
    }
});
