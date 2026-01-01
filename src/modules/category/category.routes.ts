import { Router } from 'express'
import { CategoryService } from './category.service'
import { asyncHandler } from '../../middlewares/async.middleware'
import { authMiddleware, requireRole } from '../../middlewares/auth.middleware'

const router = Router()
const categoryService = new CategoryService()

/**
 * @route   GET /api/categories
 * @desc    Get all categories (flat list)
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const categories = await categoryService.getAllCategories()
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    })
  })
)

/**
 * @route   GET /api/categories/tree
 * @desc    Get category tree with hierarchical structure
 * @access  Public
 */
router.get(
  '/tree',
  asyncHandler(async (req, res) => {
    const tree = await categoryService.getCategoryTree()
    res.status(200).json({
      success: true,
      data: tree,
    })
  })
)

/**
 * @route   GET /api/categories/:id/descendants
 * @desc    Get all descendant category IDs using DFS
 * @access  Public
 */
router.get(
  '/:id/descendants',
  asyncHandler(async (req, res) => {
    const categoryIds = await categoryService.getDescendantCategoryIds(
      req.params.id
    )
    res.status(200).json({
      success: true,
      count: categoryIds.length,
      data: categoryIds,
    })
  })
)

/**
 * @route   GET /api/categories/:id/products
 * @desc    Get all products from category and its descendants
 * @access  Public
 */
router.get(
  '/:id/products',
  asyncHandler(async (req, res) => {
    const products = await categoryService.getProductsByCategoryTree(
      req.params.id
    )
    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    })
  })
)

/**
 * @route   GET /api/categories/:id
 * @desc    Get category by ID
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const category = await categoryService.getCategoryById(req.params.id)
    res.status(200).json({ success: true, data: category })
  })
)

/**
 * @route   POST /api/categories
 * @desc    Create new category
 * @access  Admin only
 */
router.post(
  '/',
  authMiddleware,
  requireRole(['ADMIN']),
  asyncHandler(async (req, res) => {
    const category = await categoryService.createCategory(req.body)
    res
      .status(201)
      .json({ success: true, message: 'Category created', data: category })
  })
)

/**
 * @route   PUT /api/categories/:id
 * @desc    Update category
 * @access  Admin only
 */
router.put(
  '/:id',
  authMiddleware,
  requireRole(['ADMIN']),
  asyncHandler(async (req, res) => {
    const category = await categoryService.updateCategory(
      req.params.id,
      req.body
    )
    res
      .status(200)
      .json({ success: true, message: 'Category updated', data: category })
  })
)

/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete category
 * @access  Admin only
 */
router.delete(
  '/:id',
  authMiddleware,
  requireRole(['ADMIN']),
  asyncHandler(async (req, res) => {
    await categoryService.deleteCategory(req.params.id)
    res.status(200).json({ success: true, message: 'Category deleted' })
  })
)

export default router
