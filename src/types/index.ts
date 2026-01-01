/**
 * Payment Strategy Interface
 * Defines contract for all payment providers
 */
export interface IPaymentStrategy {
  /**
   * Initiate payment with order details
   */
  initiatePayment(paymentData: PaymentData): Promise<PaymentResult>

  /**
   * Verify if payment was successful
   */
  verifyPayment(paymentId: string): Promise<PaymentVerificationResult>

  /**
   * Refund completed payment
   */
  refundPayment(paymentId: string, amount?: number): Promise<RefundResult>
}

export interface PaymentData {
  orderId: string
  amount: number
  currency: string
  metadata?: Record<string, any>
}

export interface PaymentResult {
  success: boolean
  paymentId?: string
  clientSecret?: string
  redirectUrl?: string
  message?: string
  error?: string
}

export interface PaymentVerificationResult {
  verified: boolean
  status?: string
  transactionId?: string
  amount?: number
  message?: string
}

export interface RefundResult {
  success: boolean
  refundId?: string
  message?: string
  error?: string
}

export interface ShippingAddress {
  fullName: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
}

export interface CreateOrderDTO {
  userId: string
  items: OrderItemDTO[]
  shippingAddress: ShippingAddress
  paymentMethod: 'stripe' | 'bkash'
}

export interface OrderItemDTO {
  productId: string
  quantity: number
}
