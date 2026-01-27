import app from './app.js';
import { PORT } from './config/env.js';
import { pool } from './config/db.js';

(async () => {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected');
})();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
