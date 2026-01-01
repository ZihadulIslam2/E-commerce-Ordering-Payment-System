import { createApp } from './app'
import { env } from './config/env'
import { connectRedis } from './config/redis'
import logger from './config/logger'

const startServer = async () => {
  try {
    // Connect to Redis (non-blocking)
    connectRedis().catch((err) => {
      logger.warn(
        'Redis connection failed, server will continue without cache:',
        err
      )
    })

    // Create Express app
    const app = createApp()

    // Start server
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Server is running on port ${env.PORT}`)
      logger.info(`📝 Environment: ${env.NODE_ENV}`)
      logger.info(
        `🗄️  Database: ${
          env.DATABASE_URL?.split('@')[1]?.split(':')[0] || 'unknown'
        }`
      )
    })

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, closing server gracefully')
      server.close(() => {
        logger.info('Server closed')
        process.exit(0)
      })
    })

    process.on('SIGINT', () => {
      logger.info('SIGINT received, closing server gracefully')
      server.close(() => {
        logger.info('Server closed')
        process.exit(0)
      })
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Rejection:', err)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err)
  process.exit(1)
})

startServer()
