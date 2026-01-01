import dotenv from 'dotenv'

dotenv.config()

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000'),

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,

  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

  // bKash
  BKASH_BASE_URL: process.env.BKASH_BASE_URL,
  BKASH_APP_KEY: process.env.BKASH_APP_KEY,
  BKASH_APP_SECRET: process.env.BKASH_APP_SECRET,
  BKASH_USERNAME: process.env.BKASH_USERNAME,
  BKASH_PASSWORD: process.env.BKASH_PASSWORD,
  BKASH_CALLBACK_URL: process.env.BKASH_CALLBACK_URL,

  // Cache
  CACHE_TTL: parseInt(process.env.CACHE_TTL || '3600'),

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
} as const

// Validate required env variables
const requiredEnvVars = ['DATABASE_URL', 'STRIPE_SECRET_KEY', 'BKASH_APP_KEY']

if (process.env.NODE_ENV === 'production') {
  requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`)
    }
  })
}
