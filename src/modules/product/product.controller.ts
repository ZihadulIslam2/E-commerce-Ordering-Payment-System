import { Request, Response } from 'express'
import { ProductService } from './product.service'
import { asyncHandler } from '../../middlewares/async.middleware'

const productService = new ProductService()

export class ProductController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { categoryId, minPrice, maxPrice, isActive } = req.query

    const filters: any = {}

    if (categoryId) filters.categoryId = String(categoryId)
    if (minPrice) filters.minPrice = Number(minPrice)
    if (maxPrice) filters.maxPrice = Number(maxPrice)
    if (isActive !== undefined) filters.isActive = isActive === 'true'

    const products = await productService.getAllProducts(filters)

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    })
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.getProductById(req.params.id)

    res.status(200).json({
      success: true,
      data: product,
    })
  })

  create = asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.createProduct(req.body)

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    })
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.updateProduct(req.params.id, req.body)

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    })
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    await productService.deleteProduct(req.params.id)

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    })
  })
}

export const productController = new ProductController()
