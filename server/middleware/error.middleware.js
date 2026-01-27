export function errorHandler(err, req, res, next) {
    // prevent unused-vars linting issues for environments where next isn't used
    void next;
    console.error('🔥 SERVER ERROR:', err);

    res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development'
            ? err.message
            : undefined
    });
}
