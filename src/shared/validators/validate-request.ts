import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

type RequestSchema = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

const isRequestSchema = (schema: ZodTypeAny | RequestSchema): schema is RequestSchema =>
  'body' in schema || 'params' in schema || 'query' in schema;

export const validateRequest =
  (schema: ZodTypeAny | RequestSchema) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!isRequestSchema(schema)) {
      req.body = schema.parse(req.body);
      return next();
    }

    if (schema.body) {
      req.body = schema.body.parse(req.body);
    }

    if (schema.params) {
      req.params = schema.params.parse(req.params);
    }

    if (schema.query) {
      req.query = schema.query.parse(req.query);
    }

    next();
  };
