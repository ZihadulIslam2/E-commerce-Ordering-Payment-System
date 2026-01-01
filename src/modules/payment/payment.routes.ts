import { Router } from 'express'
import { paymentController } from './payment.controller'
import { authMiddleware, requireRole } from '../../middlewares/auth.middleware'
import { body } from 'express-validator'
import { validateRequest } from '../../middlewares/validation.middleware'
import express from 'express'

const router = Router()

const initiateValidation = [
  body('orderId').isUUID().withMessage('Invalid order ID'),
  body('provider')
    .optional()
    .isIn(['stripe', 'bkash'])
    .withMessage('Provider must be stripe or bkash'),
  validateRequest,
]

const refundValidation = [
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  validateRequest,
]

/**
 * @route   POST /api/payments/webhook/stripe
 * @desc    Handle Stripe webhook events
 * @access  Public (verified by signature)
 * @note    Must be defined before other routes to ensure raw body parsing
 */
router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  paymentController.webhook
)

/**
 * @route   POST /api/payments/initiate
 * @desc    Initiate payment for order
 * @access  Authenticated users
 */
router.post(
  '/initiate',
  authMiddleware,
  initiateValidation,
  paymentController.initiate
)

/**
 * @route   GET /api/payments/:id
 * @desc    Get payment details
 * @access  Authenticated users
 */
router.get('/:id', authMiddleware, paymentController.getById)

/**
 * @route   POST /api/payments/:id/verify
 * @desc    Verify payment status with provider
 * @access  Authenticated users
 */
router.post('/:id/verify', authMiddleware, paymentController.verify)

/**
 * @route   POST /api/payments/:id/refund
 * @desc    Refund payment (admin only)
 * @access  Admin only
 */
router.post(
  '/:id/refund',
  authMiddleware,
  requireRole(['ADMIN']),
  refundValidation,
  paymentController.refund
)

export default router
