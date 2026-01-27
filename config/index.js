export const ENV = process.env.NODE_ENV || 'development';

export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    (ENV === 'production'
        ? 'https://api.invesa.com'
        : 'http://localhost:3001');
