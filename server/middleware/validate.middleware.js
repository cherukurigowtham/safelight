import { z } from 'zod';

export function validate(schema) {
    return (req, res, next) => {
        try {
            // Validate body, query, and params if they exist in schema
            if (schema.body) {
                req.body = schema.body.parse(req.body);
            }
            if (schema.query) {
                req.query = schema.query.parse(req.query);
            }
            if (schema.params) {
                req.params = schema.params.parse(req.params);
            }
            next();
        } catch (err) {
            if (err instanceof z.ZodError) {
                return res.status(400).json({
                    message: 'Validation failed',
                    errors: err.errors
                });
            }
            next(err);
        }
    };
}
