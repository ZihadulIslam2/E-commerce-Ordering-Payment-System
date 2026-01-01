import request from 'supertest'
import { createApp } from '../../src/app'

// Mock auth middleware to bypass JWT and set user context
jest.mock('../../src/middlewares/auth.middleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => {
    _req.userId = 'user-123'
    _req.userRole = 'USER'
    next()
  },
  requireRole: (_roles: string[]) => (_req: any, _res: any, next: any) =>
    next(),
}))

// Mock AuthService to avoid DB / hashing
jest.mock('../../src/modules/auth/auth.service', () => {
  return {
    AuthService: jest.fn().mockImplementation(() => ({
      register: jest.fn().mockResolvedValue({
        token: 'jwt-token',
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      }),
      login: jest.fn().mockResolvedValue({
        token: 'jwt-token',
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      }),
    })),
  }
})

// Mock OrderService to avoid DB
jest.mock('../../src/modules/order/order.service', () => {
  return {
    OrderService: jest.fn().mockImplementation(() => ({
      createOrder: jest.fn().mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
        totalAmount: 100,
        status: 'PENDING',
      }),
    })),
  }
})

// Mock PaymentService to avoid external providers
const mockHandleStripeWebhook = jest.fn().mockResolvedValue({ received: true })
jest.mock('../../src/modules/payment/payment.service', () => {
  return {
    PaymentService: jest.fn().mockImplementation(() => ({
      initiatePayment: jest.fn().mockResolvedValue({
        paymentId: 'payment-123',
        clientSecret: 'pi_secret_123',
        redirectUrl: null,
      }),
      verifyPayment: jest.fn().mockResolvedValue({
        id: 'payment-123',
        status: 'SUCCESS',
      }),
      handleStripeWebhook: mockHandleStripeWebhook,
    })),
  }
})

const app = createApp()

describe('Auth endpoints (happy path)', () => {
  it('registers a user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.token).toBeDefined()
    expect(res.body.data.user.email).toBe('test@example.com')
  })

  it('logs in a user', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'password123',
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.token).toBeDefined()
  })
})

describe('Order + Payment flow (happy path)', () => {
  it('creates an order', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId: 'prod-1', quantity: 2 }],
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe('order-123')
  })

  it('initiates a payment', async () => {
    const res = await request(app)
      .post('/api/payments/initiate')
      .send({ orderId: 'order-123', provider: 'stripe' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.paymentId).toBe('payment-123')
    expect(res.body.data.clientSecret).toBe('pi_secret_123')
  })
})

describe('Stripe webhook (payment success)', () => {
  it('handles payment_intent.succeeded event', async () => {
    const payload = Buffer.from(
      JSON.stringify({ type: 'payment_intent.succeeded', data: { object: {} } })
    )

    const res = await request(app)
      .post('/api/payments/webhook/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 't=123,v1=test')
      .send(payload)

    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
    expect(mockHandleStripeWebhook).toHaveBeenCalled()
  })
})
