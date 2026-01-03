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

// Prefer Authorization: Bearer <token>, but accept common fallbacks
const extractToken = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) return authHeader.split(' ')[1]
  if (authHeader) return authHeader.trim()
  if (typeof req.query.token === 'string') return req.query.token
  if (typeof (req as any).cookies?.token === 'string')
    return (req as any).cookies.token
  if (typeof (req.body as any)?.token === 'string')
    return (req.body as any).token
  return undefined
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
    const token = extractToken(req)

    if (!token) {
      throw new AppError('No token provided', 401)
    }

    // Verify JWT token with optional fallback secret to avoid invalid token after rotation
    const tryVerify = (secret: string) =>
      jwt.verify(token, secret) as JWTPayload

    let decoded: JWTPayload
    try {
      decoded = tryVerify(env.JWT_SECRET)
    } catch (err) {
      const fallback = (process.env.JWT_SECRET_FALLBACK || '').trim()
      if (fallback) {
        decoded = tryVerify(fallback)
      } else {
        throw err
      }
    }

    // Attach user info to request
    req.userId = decoded.userId
    req.userEmail = decoded.email
    req.userRole = decoded.role

    next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Token expired', 401)
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401)
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
