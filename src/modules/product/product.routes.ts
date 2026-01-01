import { Router } from 'express'
import { productController } from './product.controller'
import { authMiddleware, requireRole } from '../../middlewares/auth.middleware'

const router = Router()

/**
 * @route   GET /api/products
 * @desc    Get all products with optional filters
 * @access  Public
 */
router.get('/', productController.getAll)

/**
 * @route   GET /api/products/:id
 * @desc    Get product details by ID
 * @access  Public
 */
router.get('/:id', productController.getById)

/**
 * @route   POST /api/products
 * @desc    Create new product
 * @access  Admin only
 */
router.post(
  '/',
  authMiddleware,
  requireRole(['ADMIN']),
  productController.create
)

/**
 * @route   PUT /api/products/:id
 * @desc    Update product
 * @access  Admin only
 */
router.put(
  '/:id',
  authMiddleware,
  requireRole(['ADMIN']),
  productController.update
)

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product
 * @access  Admin only
 */
router.delete(
  '/:id',
  authMiddleware,
  requireRole(['ADMIN']),
  productController.delete
)

export default router
