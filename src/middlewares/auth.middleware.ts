import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { AppError } from '../utils/errors'

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string
      userEmail?: string
      userRole?: string
    }
  }
}

interface JWTPayload {
  userId: string
  email: string
  role: string
}

/**
 * Middleware to verify JWT token
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401)
    }

    const token = authHeader.split(' ')[1]

    if (!token) {
      throw new AppError('No token provided', 401)
    }

    // Verify JWT token
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload

    // Attach user info to request
    req.userId = decoded.userId
    req.userEmail = decoded.email
    req.userRole = decoded.role

    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401)
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Token expired', 401)
    }
    throw error
  }
}

/**
 * Middleware to check user role
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      throw new AppError('Unauthorized', 401)
    }

    if (!allowedRoles.includes(req.userRole)) {
      throw new AppError('Forbidden: Insufficient permissions', 403)
    }

    next()
  }
}
