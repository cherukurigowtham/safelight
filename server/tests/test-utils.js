import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set Env Vars for testing
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';

export function setupTestDb() {
    const db = newDb();

    // Apply migrations
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();

    for (const file of migrationFiles) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        try {
            db.public.none(sql);
        } catch (e) {
            console.error(`Failed to run migration ${file}:`, e);
            throw e;
        }
    }

    const { Pool } = db.adapters.createPg();
    const pool = new Pool();

    return { db, pool };
}
