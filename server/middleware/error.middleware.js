import logger from '../config/logger.js';

export function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    logger.error(err.message, { stack: err.stack, method: req.method, url: req.url });

    const status = err.status || 500;
    const message = status === 500 ? 'Internal Server Error' : err.message;

    res.status(status).json({
        message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
}
