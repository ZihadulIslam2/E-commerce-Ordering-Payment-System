import Stripe from 'stripe'
import {
  IPaymentStrategy,
  PaymentData,
  PaymentResult,
  PaymentVerificationResult,
  RefundResult,
} from '../types'
import logger from '../config/logger'
import { PaymentError } from '../utils/errors'
import { env } from '../config/env'

/**
 * Stripe Payment Strategy Implementation
 * Handles payment processing through Stripe API
 * Supports payment intent creation, confirmation, and webhook verification
 */
export class StripePaymentStrategy implements IPaymentStrategy {
  private stripe: Stripe

  constructor() {
    if (!env.STRIPE_SECRET_KEY) {
      throw new PaymentError('STRIPE_SECRET_KEY is not configured')
    }
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    })
  }

  /**
   * Get Stripe instance for webhook signature verification
   */
  getStripeInstance(): Stripe {
    return this.stripe
  }

  /**
   * Initiate payment by creating Stripe payment intent
   */
  async initiatePayment(paymentData: PaymentData): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(paymentData.amount * 100), // Convert to cents
        currency: paymentData.currency.toLowerCase(),
        metadata: {
          orderId: paymentData.orderId,
          ...paymentData.metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      })

      logger.info(`Stripe payment intent created: ${paymentIntent.id}`)

      return {
        success: true,
        paymentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret || undefined,
        message: 'Payment intent created successfully',
      }
    } catch (error: any) {
      logger.error('Stripe payment initiation error:', error)
      throw new PaymentError(
        error.message || 'Failed to initiate Stripe payment'
      )
    }
  }

  /**
   * Verify Stripe payment status
   */
  async verifyPayment(paymentId: string): Promise<PaymentVerificationResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId)

      logger.info(
        `Stripe payment verified: ${paymentId} - ${paymentIntent.status}`
      )

      return {
        verified: paymentIntent.status === 'succeeded',
        status: paymentIntent.status,
        transactionId: paymentIntent.id,
      }
    } catch (error: any) {
      logger.error('Stripe payment verification error:', error)
      return {
        verified: false,
        status: 'failed',
      }
    }
  }

  /**
   * Confirm Stripe payment (for server-side confirmation)
   */
  async confirmPayment(paymentIntentId: string): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId
      )

      logger.info(
        `Stripe payment confirmed: ${paymentIntent.id} - ${paymentIntent.status}`
      )

      return {
        success: paymentIntent.status === 'succeeded',
        paymentId: paymentIntent.id,
        message: `Payment ${paymentIntent.status}`,
      }
    } catch (error: any) {
      logger.error('Stripe payment confirmation error:', error)
      throw new PaymentError(
        error.message || 'Failed to confirm Stripe payment'
      )
    }
  }

  /**
   * Construct payment intent from webhook event
   * Used for webhook signature verification
   */
  constructPaymentIntent(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event {
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET

    if (!webhookSecret) {
      throw new PaymentError('STRIPE_WEBHOOK_SECRET is not configured')
    }

    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      )
    } catch (error: any) {
      logger.error('Stripe webhook signature verification failed:', error)
      throw new PaymentError('Invalid webhook signature')
    }
  }

  /**
   * Refund Stripe payment
   */
  async refundPayment(
    paymentId: string,
    amount?: number
  ): Promise<RefundResult> {
    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentId,
      }

      if (amount) {
        refundParams.amount = Math.round(amount * 100)
      }

      const refund = await this.stripe.refunds.create(refundParams)

      logger.info(`Stripe refund created: ${refund.id}`)

      return {
        success: true,
        refundId: refund.id,
        message: 'Refund processed successfully',
      }
    } catch (error: any) {
      logger.error('Stripe refund error:', error)
      throw new PaymentError(error.message || 'Failed to process Stripe refund')
    }
  }
}
