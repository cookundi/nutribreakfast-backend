// src/middleware/errorHandler.js

const logger = require('../utils/logger');
const { Prisma } = require('@prisma/client');
const { ZodError } = require('zod');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const handlePrismaError = (err) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return new AppError(
          `Duplicate field value: ${err.meta?.target}. Please use another value.`,
          400
        );
      case 'P2014':
        return new AppError(
          `Invalid ID: ${err.meta?.target}`,
          400
        );
      case 'P2003':
        return new AppError(
          `Invalid input data: ${err.meta?.target}`,
          400
        );
      default:
        return new AppError('Database operation failed', 400);
    }
  }
  
  if (err instanceof Prisma.PrismaClientValidationError) {
    return new AppError('Invalid data provided', 400);
  }
  
  return err;
};

const handleZodError = (err) => {
  const errors = err.errors.map(e => ({
    field: e.path.join('.'),
    message: e.message
  }));
  
  return new AppError(
    `Validation error: ${JSON.stringify(errors)}`,
    400
  );
};

const handleJWTError = () => 
  new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired. Please log in again.', 401);

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } 
  // Programming or unknown error: don't leak error details
  else {
    logger.error('ERROR 💥', err);
    
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!'
    });
  }
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    logger.error('Error:', err);
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (err instanceof Prisma.PrismaClientKnownRequestError || 
        err instanceof Prisma.PrismaClientValidationError) {
      error = handlePrismaError(err);
    }
    
    if (err instanceof ZodError) {
      error = handleZodError(err);
    }
    
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;
module.exports.AppError = AppError;