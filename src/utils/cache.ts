import redisClient from '../config/redis'
import logger from '../config/logger'

export class CacheService {
  private ttl: number

  constructor(ttl: number = parseInt(process.env.CACHE_TTL || '3600')) {
    this.ttl = ttl
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redisClient.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await redisClient.setEx(key, ttl || this.ttl, JSON.stringify(value))
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await redisClient.del(key)
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error)
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern)
      if (keys.length > 0) {
        await redisClient.del(keys)
      }
    } catch (error) {
      logger.error(`Cache invalidate pattern error for ${pattern}:`, error)
    }
  }
}

export default new CacheService()
