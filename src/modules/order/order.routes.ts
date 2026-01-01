import { Router } from 'express'
import { orderController } from './order.controller'
import { authMiddleware, requireRole } from '../../middlewares/auth.middleware'
import { body } from 'express-validator'
import { validateRequest } from '../../middlewares/validation.middleware'

const router = Router()

// Validation middleware
const createOrderValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  body('items.*.productId')
    .isString()
    .notEmpty()
    .withMessage('Product ID is required'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  validateRequest,
]

const updateStatusValidation = [
  body('status')
    .isIn(['PENDING', 'PAID', 'CANCELED'])
    .withMessage('Invalid order status'),
  validateRequest,
]

/**
 * @route   POST /api/orders
 * @desc    Create order for logged-in user
 * @access  Authenticated users
 */
router.post('/', authMiddleware, createOrderValidation, orderController.create)

/**
 * @route   GET /api/orders/my-orders
 * @desc    Get logged-in user's orders
 * @access  Authenticated users
 */
router.get('/my-orders', authMiddleware, orderController.getUserOrders)

/**
 * @route   GET /api/orders/:id
 * @desc    Get order details by ID
 * @access  Authenticated users
 */
router.get('/:id', authMiddleware, orderController.getById)

/**
 * @route   PATCH /api/orders/:id/status
 * @desc    Update order status (admin only)
 * @access  Admin only
 */
router.patch(
  '/:id/status',
  authMiddleware,
  requireRole(['ADMIN']),
  updateStatusValidation,
  orderController.updateStatus
)

/**
 * @route   POST /api/orders/:id/cancel
 * @desc    Cancel pending order
 * @access  Authenticated users
 */
router.post('/:id/cancel', authMiddleware, orderController.cancel)

export default router
