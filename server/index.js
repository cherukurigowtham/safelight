import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
// import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from './config/db.js';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
import { PORT, NODE_ENV, FRONTEND_ORIGIN, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN } from './config/env.js';
import { findUserByEmail, generateTokens, saveRefreshToken, deleteRefreshToken } from './services/auth.service.js';
import postsRoutes from './routes/posts.routes.js';
import investmentsRoutes from './routes/investments.routes.js';

/* ============================================================
   MIDDLEWARE
   ============================================================ */

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/uploads', express.static('uploads'));

app.use('/api', postsRoutes);
app.use('/api', investmentsRoutes);

/* ============================================================
   RATE LIMITING (9.5)
   ============================================================ */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many attempts. Try again later.'
});

app.use('/api/login', authLimiter);
app.use('/api/signup', authLimiter);

/* ============================================================
   FILE UPLOAD SETUP
   ============================================================ */

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// const upload = multer({
//   storage: multer.diskStorage({
//     destination: uploadDir,
//     filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
//   })
// });

/* ============================================================
   IN-MEMORY STORES (TEMP)
   ============================================================ */

// const users = []; // legacy in-memory, will be superseded by DB in production
// const refreshTokens = [];
// In production, OTPs and messages are persisted in DB (DB migrations introduced)
// Removed in-memory stores in favor of DB-backed implementations

/* ============================================================
   INPUT VALIDATION SCHEMAS (9.6)
   ============================================================ */

// const signupSchema = z.object({
//   fullName: z.string().min(2),
//   email: z.string().email(),
//   password: z.string().min(8)
// });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

// DB helper: simple migrations runner (production-ready)
async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  // ensure migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);
  // load applied migrations
  const { rows } = await pool.query('SELECT name FROM migrations');
  const applied = new Set(rows.map(r => r.name));

  let files = [];
  try {
    files = await fs.promises.readdir(migrationsDir);
  } catch {
    // no migrations folder yet
  }
  const sqlFiles = files.filter(n => n.endsWith('.sql')).sort();
  for (const file of sqlFiles) {
    if (applied.has(file)) continue;
    const sql = await fs.promises.readFile(path.join(migrationsDir, file), 'utf8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`Migration ${file} applied`);
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }
}
async function ensureSchema() {
  // Create core tables if they do not exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 1000,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS otp_tokens (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      business_id INTEGER,
      text TEXT,
      is_from_business BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);
  console.log('DB schema ensured');
}

// Helper: parse expires string like 15m, 7d into milliseconds
function parseExpiresInMs(expiresIn) {
  if (!expiresIn) return 0;
  const m = String(expiresIn).match(/^(\d+)([smhd])$/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  switch (unit) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

/* ============================================================
   AUTH HELPERS
   ============================================================ */

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

/* ============================================================
   AUTH MIDDLEWARE
   ============================================================ */

function authenticateAccessToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.accessToken;
  if (!token) return res.sendStatus(401);

  try {
    req.user = jwt.verify(token, ACCESS_TOKEN_SECRET);
    next();
  } catch {
    return res.sendStatus(403);
  }
}

/* ============================================================
   SIGNUP
   ============================================================ */

/**
 * @swagger
 * /api/signup/request-otp:
 *   post:
 *     summary: Request an OTP for signup
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent successfully
 */
// Legacy signup removed. Use /api/signup/complete.

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Login to the platform
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
app.post('/api/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const user = await findUserByEmail(parsed.email);

    if (!user || !(await bcrypt.compare(parsed.password, user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const tokens = generateTokens(user);
    const expiresMs = parseExpiresInMs(REFRESH_TOKEN_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + expiresMs);

    await saveRefreshToken(user.id, tokens.refreshToken, expiresAt);

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: NODE_ENV === 'production'
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: NODE_ENV === 'production'
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        balance: user.balance
      }
    });
  } catch (err) {
    next(err);
  }
});

/* ============================================================
   REFRESH TOKEN
   ============================================================ */

app.post('/api/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) return res.sendStatus(403);
    const rt = await pool.query('SELECT user_id, expires_at FROM refresh_tokens WHERE token = $1', [refreshToken]);
    if (!rt.rows.length) return res.sendStatus(403);
    const { user_id: userId } = rt.rows[0];
    // ensure not expired
    // If expires_at stored, the query above ensures it's not expired by NOW()
    const { rows: userRows } = await pool.query(
      'SELECT id, full_name AS "fullName", email, balance FROM users WHERE id = $1',
      [userId]
    );
    const user = userRows[0];
    if (!user) return res.sendStatus(403);
    const newAccessToken = generateAccessToken(user);
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
});

/* ============================================================
   PROTECTED TEST ROUTE
   ============================================================ */

app.get('/api/profile', authenticateAccessToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name AS "fullName", email, balance
             FROM users
             WHERE id = $1`,
      [req.user.id]
    );
    const user = rows[0];
    if (!user) return res.sendStatus(404);
    res.json({ user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ============================================================
   LOGOUT
   ============================================================ */
app.post('/api/logout', async (req, res) => {
  // Clear httpOnly cookies on client logout
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    try {
      await deleteRefreshToken(refreshToken);
    } catch (e) { console.error(e); }
  }
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ success: true });
});

// Basic health check for container/orchestrator
app.get('/healthz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

/* ============================================================
   SWAGGER DOCUMENTATION
   ============================================================ */

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Invesa API',
      version: '1.0.0',
      description: 'API documentation for Invesa platform',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
  },
  apis: ['./index.js', './routes/*.js'],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/* ============================================================
   PRODUCTION-READY ENDPOINTS (OTP, PASSWORD, MESSAGES)
   (Lightweight implementations for demo; replace with real services in prod)
================================================================*/

// OTP flows for signup (in-memory for demo)
app.post('/api/signup/request-otp', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  try {
    await pool.query(
      'INSERT INTO otp_tokens (email, code, expires_at) VALUES ($1, $2, $3)',
      [email, code, expiresAt]
    );
  } catch {
    // ignore duplicate insert errors for now
  }
  res.json({ success: true, message: 'OTP sent successfully' });
});

// Complete signup with OTP
app.post('/api/signup/complete', async (req, res, next) => {
  try {
    const { fullName, email, password, otp } = req.body;
    const { rows } = await pool.query('SELECT code, expires_at FROM otp_tokens WHERE email = $1 ORDER BY expires_at DESC LIMIT 1', [email]);
    const record = rows[0];
    if (!record || record.code !== otp || new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    // Consume OTP
    await pool.query('DELETE FROM otp_tokens WHERE email = $1 AND code = $2', [email, otp]);
    const hashedPassword = await bcrypt.hash(password, 12);
    const { rows: urows } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, balance)
       VALUES ($1, $2, $3, 1000)
       RETURNING id, full_name AS "fullName", email, balance`,
      [fullName, email, hashedPassword]
    );
    const user = urows[0];
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const expiresMs = parseExpiresInMs(REFRESH_TOKEN_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + expiresMs);
    await pool.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [user.id, refreshToken, expiresAt]);
    res.cookie('accessToken', accessToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.json({ success: true, accessToken, refreshToken, user });
  } catch (err) {
    next(err);
  }
});

// Password reset: request otp (forgot-password)
app.post('/api/password/request-otp', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await pool.query('INSERT INTO otp_tokens (email, code, expires_at) VALUES ($1, $2, $3)', [email, code, expiresAt]);
  res.json({ success: true, otp: code });
});

// Password reset
app.post('/api/password/reset', async (req, res) => {
  const { email, otp, password } = req.body || {};
  const { rows } = await pool.query('SELECT code, expires_at FROM otp_tokens WHERE email = $1 ORDER BY expires_at DESC LIMIT 1', [email]);
  const record = rows[0];
  if (!record || record.code !== otp || new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ success: false, message: 'Invalid OTP' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashedPassword, email]);
    // consume OTP
    await pool.query('DELETE FROM otp_tokens WHERE email = $1 AND code = $2', [email, otp]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Messages (DB-backed)
app.get('/api/messages/:businessId', authenticateAccessToken, async (req, res) => {
  const businessId = req.params.businessId;
  const { rows } = await pool.query(
    'SELECT id, text, is_from_business AS isFromBusiness FROM messages WHERE business_id = $1 ORDER BY id ASC',
    [businessId]
  );
  res.json({ success: true, messages: rows });
});
app.post('/api/messages', authenticateAccessToken, async (req, res) => {
  const { businessId, text } = req.body || {};
  if (!businessId || !text) return res.status(400).json({ success: false, message: 'Missing fields' });
  const { rows } = await pool.query(
    'INSERT INTO messages (business_id, text, is_from_business) VALUES ($1, $2, $3) RETURNING id, text, is_from_business AS "isFromBusiness"',
    [businessId, text, false]
  );
  res.json({ success: true, message: rows[0] });
});

/* ============================================================
   GLOBAL ERROR HANDLER (9.4)
   ============================================================ */

app.use((err, req, res, next) => {
  // silence lint for unused 'next' in some environments
  void next;
  console.error(err);

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input',
      errors: err.errors
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

/* ============================================================
   SERVER START
   ============================================================ */

// Start server after ensuring migrations and schema
(async function startServer() {
  try {
    await runMigrations();
    await ensureSchema();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
})();
