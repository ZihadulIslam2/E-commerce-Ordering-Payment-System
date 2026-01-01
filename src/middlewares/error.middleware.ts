import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors'
import logger from '../config/logger'
import { env } from '../config/env'

export const errorMiddleware = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof AppError) {
    logger.error(
      `${error.statusCode} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`
    )

    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(env.NODE_ENV === 'development' && { stack: error.stack }),
    })
  }

  logger.error(
    `500 - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`,
    error
  )

  return res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    ...(env.NODE_ENV === 'development' && { stack: error.stack }),
  })
}
