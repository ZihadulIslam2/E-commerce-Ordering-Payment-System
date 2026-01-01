import axios from 'axios'
import {
  IPaymentStrategy,
  PaymentData,
  PaymentResult,
  PaymentVerificationResult,
} from '../types'
import logger from '../config/logger'
import { PaymentError } from '../utils/errors'

/**
 * bKash Payment Strategy
 * Implements bKash payment gateway integration
 *
 * Token Management:
 * - bKash requires authentication token for all API calls
 * - Token expires after 1 hour
 * - We cache the token and refresh it 5 minutes before expiry
 */
export class BkashPaymentStrategy implements IPaymentStrategy {
  private baseUrl: string
  private appKey: string
  private appSecret: string
  private username: string
  private password: string
  private token: string | null = null
  private tokenExpiry: number = 0

  constructor() {
    this.baseUrl = process.env.BKASH_BASE_URL!
    this.appKey = process.env.BKASH_APP_KEY!
    this.appSecret = process.env.BKASH_APP_SECRET!
    this.username = process.env.BKASH_USERNAME!
    this.password = process.env.BKASH_PASSWORD!
  }

  /**
   * Get bKash authentication token
   * Caches token and refreshes before expiry (5-minute buffer)
   */
  private async getToken(): Promise<string> {
    const now = Date.now()

    // Return cached token if still valid (5-minute buffer before expiry)
    if (this.token && this.tokenExpiry > now + 5 * 60 * 1000) {
      return this.token
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/tokenized/checkout/token/grant`,
        {
          app_key: this.appKey,
          app_secret: this.appSecret,
        },
        {
          headers: {
            username: this.username,
            password: this.password,
            'Content-Type': 'application/json',
          },
        }
      )

      this.token = response.data.id_token
      this.tokenExpiry = now + response.data.expires_in * 1000

      logger.info('bKash token obtained successfully')
      return this.token!
    } catch (error: any) {
      logger.error('Failed to get bKash token:', error)
      throw new PaymentError('Failed to authenticate with bKash')
    }
  }

  /**
   * Initiate payment with bKash
   * Creates checkout URL for customer to complete payment
   */
  async initiatePayment(paymentData: PaymentData): Promise<PaymentResult> {
    try {
      const token = await this.getToken()

      const response = await axios.post(
        `${this.baseUrl}/tokenized/checkout/create`,
        {
          mode: '0011', // Tokenized payment mode
          payerReference: paymentData.metadata?.userId || 'guest',
          callbackURL:
            process.env.BKASH_CALLBACK_URL ||
            'http://localhost:3000/api/payments/bkash/callback',
          amount: paymentData.amount.toString(),
          currency: 'BDT',
          intent: 'sale',
          merchantInvoiceNumber: paymentData.orderId,
        },
        {
          headers: {
            Authorization: token,
            'X-APP-Key': this.appKey,
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.data.statusCode === '0000') {
        return {
          success: true,
          paymentId: response.data.paymentID,
          redirectUrl: response.data.bkashURL,
        }
      }

      return {
        success: false,
        error: response.data.statusMessage || 'Failed to create bKash payment',
      }
    } catch (error: any) {
      logger.error('bKash payment initiation error:', error)
      throw new PaymentError(
        error.message || 'Failed to initiate bKash payment'
      )
    }
  }

  /**
   * Verify bKash payment
   * Executes the payment after customer authorization
   */
  async verifyPayment(paymentId: string): Promise<PaymentVerificationResult> {
    try {
      const token = await this.getToken()

      const response = await axios.post(
        `${this.baseUrl}/tokenized/checkout/execute`,
        {
          paymentID: paymentId,
        },
        {
          headers: {
            Authorization: token,
            'X-APP-Key': this.appKey,
            'Content-Type': 'application/json',
          },
        }
      )

      return {
        verified:
          response.data.statusCode === '0000' &&
          response.data.transactionStatus === 'Completed',
        transactionId: response.data.trxID,
        amount: parseFloat(response.data.amount),
        message: response.data.statusMessage,
      }
    } catch (error: any) {
      logger.error('bKash verification error:', error)
      return {
        verified: false,
        message: error.message || 'Failed to verify bKash payment',
      }
    }
  }

  /**
   * Refund bKash payment
   * Processes refund for completed transactions
   */
  async refundPayment(
    paymentId: string,
    amount?: number
  ): Promise<PaymentResult> {
    try {
      const token = await this.getToken()

      const response = await axios.post(
        `${this.baseUrl}/tokenized/checkout/payment/refund`,
        {
          paymentID: paymentId,
          amount: amount?.toString(),
          trxID: paymentId,
          sku: 'refund',
        },
        {
          headers: {
            Authorization: token,
            'X-APP-Key': this.appKey,
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.data.statusCode === '0000') {
        return {
          success: true,
          refundId: response.data.refundTrxID,
          message: 'bKash refund processed successfully',
        }
      }

      return {
        success: false,
        error: response.data.statusMessage || 'Failed to refund bKash payment',
      }
    } catch (error: any) {
      logger.error('bKash refund error:', error)
      throw new PaymentError(error.message || 'Failed to process bKash refund')
    }
  }
}
