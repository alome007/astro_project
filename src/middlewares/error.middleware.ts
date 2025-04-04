import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

const errorMiddleware = (err: ErrorWithStatusCode, req: Request, res: Response, next: NextFunction): void => {
  let error = err;

  // If the error is not an instance of ApiError, convert it
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, false, err.stack);
  }

  // Extract error details
  const { statusCode, message, stack } = error as ApiError;

  // Log error details
  logger.error(`Error: ${statusCode} - ${message}`);
  logger.error(`Request path: ${req.path}`);
  
  if (process.env.NODE_ENV === 'development') {
    logger.error(stack);
  }

  // Send error response
  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack }), // Include stack trace in development mode only
  });
};

export default errorMiddleware;