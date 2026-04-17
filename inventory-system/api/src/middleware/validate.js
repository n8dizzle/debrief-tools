'use strict';

/**
 * Zod request validator middleware factory.
 *
 * Usage:
 *   const { z } = require('zod');
 *   router.post('/', validate({ body: z.object({ name: z.string() }) }), handler);
 *
 * Supports: body, query, params
 */
const validate = (schemas) => (req, _res, next) => {
  try {
    if (schemas.body)   req.body   = schemas.body.parse(req.body);
    if (schemas.query)  req.query  = schemas.query.parse(req.query);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    next();
  } catch (err) {
    next(err); // ZodError — caught by errorHandler
  }
};

module.exports = { validate };
