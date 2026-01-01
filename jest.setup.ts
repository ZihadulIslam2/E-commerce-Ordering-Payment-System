import dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

// Extend default timeout for integration tests
jest.setTimeout(30000)
