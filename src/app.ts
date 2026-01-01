import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { env } from './config/env'
import logger from './config/logger'
import { errorMiddleware } from './middlewares/error.middleware'
import routes from './routes'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './config/swagger'

export const createApp = (): Application => {
  const app = express()

  // Security middleware
  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later',
  })
  app.use('/api/', limiter)

  // Body parser
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // Swagger docs
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
  app.get('/docs.json', (_req: Request, res: Response) => {
    res.json(swaggerSpec)
  })

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
    })
  })

  // API routes
  app.use('/api', routes)

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    })
  })

  // Error handler
  app.use(errorMiddleware)

  return app
}
