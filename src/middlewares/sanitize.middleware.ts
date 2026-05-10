import type { NextFunction, Request, Response } from 'express';
import sanitizeHtml from 'sanitize-html';

const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, innerValue]) => [key, sanitizeValue(innerValue)])
    );
  }

  return value;
};

export const sanitizeBody = (req: Request, _res: Response, next: NextFunction) => {
  req.body = sanitizeValue(req.body);
  next();
};
