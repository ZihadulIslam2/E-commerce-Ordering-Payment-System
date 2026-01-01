import { createClient } from 'redis'
import { env } from './env'
import logger from './logger'

const redisClient = createClient({
  socket: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
  ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
})

redisClient.on('error', (err) => {
  logger.error('Redis Client Error', err)
})

redisClient.on('connect', () => {
  logger.info('Redis Client Connected')
})

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect()
    logger.info('Redis connected successfully')
  } catch (error) {
    logger.error('Failed to connect to Redis', error)
    throw error
  }
}

export default redisClient
