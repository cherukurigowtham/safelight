import app from './app.js';
import { PORT } from './config/env.js';
import { pool } from './config/db.js';

(async () => {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected');
})();

import logger from './config/logger.js';

const server = app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        pool.end(() => {
            logger.info('Database pool closed');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        pool.end(() => {
            logger.info('Database pool closed');
            process.exit(0);
        });
    });
});
