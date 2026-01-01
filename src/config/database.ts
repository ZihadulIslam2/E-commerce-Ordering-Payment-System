import { PrismaClient } from '@prisma/client'
import logger from './logger'

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
})

prisma.$on('query', (e: any) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`Query: ${e.query}`)
    logger.debug(`Duration: ${e.duration}ms`)
  }
})

prisma.$on('error', (e: any) => {
  logger.error('Prisma Error:', e)
})

export default prisma
