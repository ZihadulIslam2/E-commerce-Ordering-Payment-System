import { Request, Response } from 'express'
import { PaymentService } from './payment.service'
import { asyncHandler } from '../../middlewares/async.middleware'

const paymentService = new PaymentService()

export class PaymentController {
  initiate = asyncHandler(async (req: Request, res: Response) => {
    const { orderId, provider } = req.body
    const result = await paymentService.initiatePayment(orderId, provider)

    res.status(200).json({
      success: true,
      message: 'Payment initiated successfully',
      data: result,
    })
  })

  verify = asyncHandler(async (req: Request, res: Response) => {
    const payment = await paymentService.verifyPayment(req.params.id)

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: payment,
    })
  })

  refund = asyncHandler(async (req: Request, res: Response) => {
    const { amount } = req.body
    const payment = await paymentService.refundPayment(req.params.id, amount)

    res.status(200).json({
      success: true,
      message: 'Payment refunded successfully',
      data: payment,
    })
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const payment = await paymentService.getPaymentById(req.params.id)

    res.status(200).json({
      success: true,
      data: payment,
    })
  })

  /**
   * Handle Stripe webhook events
   * Requires raw body for signature verification
   */
  webhook = asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string

    if (!signature) {
      res.status(400).json({
        success: false,
        message: 'Missing stripe-signature header',
      })
      return
    }

    // Use raw body for signature verification
    const payload = (req as any).rawBody || req.body

    await paymentService.handleStripeWebhook(payload, signature)

    res.status(200).json({ received: true })
  })
}

export const paymentController = new PaymentController()
