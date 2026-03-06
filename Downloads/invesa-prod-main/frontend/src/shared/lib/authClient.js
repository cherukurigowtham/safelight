import { createAuthClient } from '@neondatabase/neon-js/auth';

// Get the env var, but provide the known good URL as a fallback
const envUrl = import.meta.env.VITE_NEON_AUTH_URL || 'https://ep-dawn-mountain-ahctulnd.neonauth.c-3.us-east-1.aws.neon.tech/invesa-db/auth';

// Hard fallback: if the env var has the .aws.tech typo (missing .neon), fix it dynamically
const safeAuthUrl = envUrl.includes('.aws.tech') ? envUrl.replace('.aws.tech', '.aws.neon.tech') : envUrl;

export const authClient = createAuthClient(safeAuthUrl);
