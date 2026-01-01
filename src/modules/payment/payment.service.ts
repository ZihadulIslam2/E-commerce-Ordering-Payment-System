import { PaymentProvider, PaymentStatus, Prisma } from '@prisma/client'
import prisma from '../../config/database'
import { PaymentStrategyFactory } from '../../factories/PaymentStrategyFactory'
import { NotFoundError, PaymentError } from '../../utils/errors'
import logger from '../../config/logger'

/**
 * Payment Service
 * Orchestrates payment operations using Strategy pattern via PaymentStrategyFactory
 *
 * Does NOT know about specific payment providers (Stripe, bKash, etc.)
 * Only depends on IPaymentStrategy interface
 */
export class PaymentService {
  /**
   * Initiate payment for an order
   * Uses factory to get appropriate payment strategy
   * Order service doesn't need to know provider details
   */
  async initiatePayment(orderId: string, provider: string = 'stripe') {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    })

    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`)
    }

    if (order.payments.length > 0) {
      throw new PaymentError('Payment already initiated for this order')
    }

    // Get payment strategy from factory (abstracted from payment provider)
    // Order service only provides provider name - doesn't know implementation details
    const strategy = PaymentStrategyFactory.getStrategy(provider)

    // Strategy is responsible for provider-specific payment initiation
    const result = await strategy.initiatePayment({
      orderId: order.id,
      amount: Number(order.totalAmount),
      currency: provider.toLowerCase() === 'bkash' ? 'BDT' : 'USD',
      metadata: {
        userId: order.userId,
      },
    })

    if (!result.success) {
      throw new PaymentError(result.error || 'Payment initiation failed')
    }

    // Store payment record
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider:
          provider.toLowerCase() === 'bkash'
            ? PaymentProvider.BKASH
            : PaymentProvider.STRIPE,
        transactionId: result.paymentId!,
        status: PaymentStatus.PENDING,
        rawResponse: {
          clientSecret: result.clientSecret,
          redirectUrl: result.redirectUrl,
        },
      },
    })

    logger.info(`Payment initiated: ${payment.id} for order ${orderId}`)

    return {
      paymentId: payment.id,
      clientSecret: result.clientSecret,
      redirectUrl: result.redirectUrl,
    }
  }

  /**
   * Verify payment status
   * Uses factory to get strategy matching payment provider
   */
  async verifyPayment(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            items: {
              include: { product: true },
            },
          },
        },
      },
    })

    if (!payment) {
      throw new NotFoundError(`Payment ${paymentId} not found`)
    }

    if (!payment.transactionId) {
      throw new PaymentError('Transaction ID not found')
    }

    // Get strategy for the payment provider
    const strategy = PaymentStrategyFactory.getStrategy(
      payment.provider.toLowerCase()
    )

    // Strategy verifies payment with provider
    const verification = await strategy.verifyPayment(payment.transactionId)

    // Update payment status based on verification
    const updatedPayment = await prisma.$transaction(async (tx) => {
      const newStatus = verification.verified
        ? PaymentStatus.SUCCESS
        : PaymentStatus.FAILED

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: newStatus,
          transactionId: verification.transactionId || payment.transactionId,
          rawResponse: {
            ...(payment.rawResponse as any),
            verificationResult: verification,
            verifiedAt: new Date().toISOString(),
          },
        },
        include: {
          order: {
            include: {
              items: {
                include: { product: true },
              },
            },
          },
        },
      })

      // Update order status and stock if payment succeeded
      if (verification.verified) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID' },
        })

        // Reduce stock for bKash payments (no webhooks)
        if (payment.provider === PaymentProvider.BKASH) {
          await this.reduceStock(tx, payment.orderId)
        }
      }

      return updated
    })

    logger.info(
      `Payment verified: ${paymentId} - ${
        verification.verified ? 'SUCCESS' : 'FAILED'
      }`
    )

    return updatedPayment
  }

  /**
   * Refund payment
   * Uses factory to get strategy matching payment provider
   */
  async refundPayment(paymentId: string, amount?: number) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    })

    if (!payment) {
      throw new NotFoundError(`Payment ${paymentId} not found`)
    }

    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new PaymentError('Can only refund successful payments')
    }

    if (!payment.transactionId) {
      throw new PaymentError('Transaction ID not found')
    }

    // Get strategy for the payment provider
    const strategy = PaymentStrategyFactory.getStrategy(
      payment.provider.toLowerCase()
    )

    // Strategy processes refund with provider
    const result = await strategy.refundPayment(payment.transactionId, amount)

    if (!result.success) {
      throw new PaymentError('Refund processing failed')
    }

    // Update payment record
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.FAILED, // Mark as failed after refund
        rawResponse: {
          ...(payment.rawResponse as any),
          refundId: result.refundId,
          refundedAt: new Date().toISOString(),
          refundAmount: amount || Number(payment.order.totalAmount),
        },
      },
      include: { order: true },
    })

    logger.info(`Payment refunded: ${paymentId}`)

    return updatedPayment
  }

  /**
   * Handle Stripe webhook events
   * Verifies signature, processes events, updates payment/order status, and reduces stock
   */
  async handleStripeWebhook(payload: string | Buffer, signature: string) {
    const strategy = PaymentStrategyFactory.getStrategy('stripe')

    // Verify webhook signature
    const stripeStrategy = strategy as any
    if (!stripeStrategy.constructPaymentIntent) {
      throw new PaymentError('Invalid payment strategy for webhook handling')
    }

    const event = stripeStrategy.constructPaymentIntent(payload, signature)

    logger.info(`Stripe webhook received: ${event.type}`)

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as any)
        break
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as any)
        break
      case 'payment_intent.canceled':
        await this.handlePaymentCanceled(event.data.object as any)
        break
      default:
        logger.info(`Unhandled event type: ${event.type}`)
    }

    return { received: true }
  }

  /**
   * Handle successful payment
   * Updates payment status, order status, and reduces product stock atomically
   */
  private async handlePaymentSuccess(paymentIntent: any) {
    const transactionId = paymentIntent.id

    // Find payment by transaction ID
    const payment = await prisma.payment.findFirst({
      where: { transactionId },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    })

    if (!payment) {
      logger.warn(`Payment not found for transaction: ${transactionId}`)
      return
    }

    // Skip if already processed
    if (payment.status === PaymentStatus.SUCCESS) {
      logger.info(`Payment already processed: ${payment.id}`)
      return
    }

    // Use Prisma transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          rawResponse: {
            ...(payment.rawResponse as any),
            webhookEvent: {
              type: 'payment_intent.succeeded',
              amount: paymentIntent.amount,
              status: paymentIntent.status,
              processedAt: new Date().toISOString(),
            },
          },
        },
      })

      // Update order status
      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: 'PAID' },
      })

      // Reduce product stock for each order item
      for (const item of payment.order.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        })

        if (!product) {
          throw new PaymentError(`Product ${item.productId} not found`)
        }

        if (product.stock < item.quantity) {
          throw new PaymentError(
            `Insufficient stock for product ${product.name}. Available: ${product.stock}, Required: ${item.quantity}`
          )
        }

        // Reduce stock atomically
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        })

        logger.info(
          `Stock reduced for product ${product.name}: ${item.quantity} units`
        )
      }

      logger.info(
        `Payment successful: ${payment.id}, Order: ${payment.orderId}, Stock reduced`
      )
    })
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(paymentIntent: any) {
    const transactionId = paymentIntent.id

    const payment = await prisma.payment.findFirst({
      where: { transactionId },
    })

    if (!payment) {
      logger.warn(`Payment not found for transaction: ${transactionId}`)
      return
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        rawResponse: {
          ...(payment.rawResponse as any),
          webhookEvent: {
            type: 'payment_intent.payment_failed',
            error: paymentIntent.last_payment_error,
            processedAt: new Date().toISOString(),
          },
        },
      },
    })

    logger.info(`Payment failed: ${payment.id}`)
  }

  /**
   * Handle canceled payment
   */
  private async handlePaymentCanceled(paymentIntent: any) {
    const transactionId = paymentIntent.id

    const payment = await prisma.payment.findFirst({
      where: { transactionId },
      include: { order: true },
    })

    if (!payment) {
      logger.warn(`Payment not found for transaction: ${transactionId}`)
      return
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          rawResponse: {
            ...(payment.rawResponse as any),
            webhookEvent: {
              type: 'payment_intent.canceled',
              processedAt: new Date().toISOString(),
            },
          },
        },
      })

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: 'CANCELED' },
      })
    })

    logger.info(`Payment canceled: ${payment.id}`)
  }

  /**
   * Get payment details
   */
  async getPaymentById(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: true,
      },
    })

    if (!payment) {
      throw new NotFoundError(`Payment ${paymentId} not found`)
    }

    return payment
  }

  /**
   * Reduce product stock atomically for an order
   */
  private async reduceStock(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true },
        },
      },
    })

    if (!order) {
      throw new PaymentError(`Order ${orderId} not found for stock reduction`)
    }

    for (const item of order.items) {
      if (!item.product) {
        throw new PaymentError(`Product ${item.productId} not found`)
      }

      if (item.product.stock < item.quantity) {
        throw new PaymentError(
          `Insufficient stock for product ${item.product.name}. Available: ${item.product.stock}, Required: ${item.quantity}`
        )
      }

      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      })

      logger.info(
        `Stock reduced for product ${item.product.name}: ${item.quantity} units`
      )
    }
  }
}
