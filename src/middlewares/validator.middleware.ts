import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ApiError } from './error.middleware';

/**
 * Middleware to validate request data
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => error.msg);
    throw new ApiError(400, errorMessages.join(', '));
  }
  next();
};

export { validateRequest };