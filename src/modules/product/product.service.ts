import prisma from '../../config/database'
import cacheService from '../../utils/cache'
import logger from '../../config/logger'
import { NotFoundError, ValidationError } from '../../utils/errors'
import {
  CreateProductDTO,
  UpdateProductDTO,
  ProductFilters,
  createProductSchema,
  updateProductSchema,
  productFiltersSchema,
} from './product.dto'
import { Prisma } from '@prisma/client'

export class ProductService {
  private cacheKeyPrefix = 'product:'

  /**
   * Get all products with optional filters
   */
  async getAllProducts(filters?: ProductFilters) {
    // Validate filters with Zod
    const validatedFilters = filters ? productFiltersSchema.parse(filters) : {}

    const cacheKey = `${this.cacheKeyPrefix}all:${JSON.stringify(
      validatedFilters
    )}`

    const cached = await cacheService.get(cacheKey)
    if (cached) {
      logger.debug('Products retrieved from cache')
      return cached
    }

    const where: Prisma.ProductWhereInput = {}

    if (validatedFilters.categoryId) {
      where.categoryId = validatedFilters.categoryId
    }

    if (
      validatedFilters.minPrice !== undefined ||
      validatedFilters.maxPrice !== undefined
    ) {
      where.price = {}
      if (validatedFilters.minPrice !== undefined) {
        where.price.gte = validatedFilters.minPrice
      }
      if (validatedFilters.maxPrice !== undefined) {
        where.price.lte = validatedFilters.maxPrice
      }
    }

    if (validatedFilters.status !== undefined) {
      where.status = validatedFilters.status
    }

    if (validatedFilters.search) {
      where.OR = [
        { name: { contains: validatedFilters.search, mode: 'insensitive' } },
        {
          description: {
            contains: validatedFilters.search,
            mode: 'insensitive',
          },
        },
      ]
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    })

    await cacheService.set(cacheKey, products, 600)
    logger.info(`Retrieved ${products.length} products`)
    return products
  }

  /**
   * Get product by ID
   */
  async getProductById(id: string) {
    const cacheKey = `${this.cacheKeyPrefix}${id}`

    const cached = await cacheService.get(cacheKey)
    if (cached) {
      logger.debug(`Product ${id} retrieved from cache`)
      return cached
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    })

    if (!product) {
      throw new NotFoundError('Product not found')
    }

    await cacheService.set(cacheKey, product)
    return product
  }

  /**
   * Create new product (Admin only)
   */
  async createProduct(data: CreateProductDTO) {
    // Validate with Zod
    const validated = createProductSchema.parse(data)

    // Check if SKU already exists
    const existingProduct = await prisma.product.findUnique({
      where: { sku: validated.sku },
    })

    if (existingProduct) {
      throw new ValidationError('Product with this SKU already exists')
    }

    // Verify category exists
    const categoryExists = await prisma.category.findUnique({
      where: { id: validated.categoryId },
    })

    if (!categoryExists) {
      throw new NotFoundError('Category not found')
    }

    const product = await prisma.product.create({
      data: validated,
      include: { category: true },
    })

    await cacheService.invalidatePattern(`${this.cacheKeyPrefix}all:*`)
    logger.info(`Product created: ${product.id} - ${product.name}`)

    return product
  }

  async updateProduct(id: string, data: UpdateProductDTO) {
    await this.getProductById(id)

    if (data.price !== undefined && data.price <= 0) {
      throw new ValidationError('Price must be greater than 0')
    }

    if (data.stock !== undefined && data.stock < 0) {
      throw new ValidationError('Stock cannot be negative')
    }

    const product = await prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    })

    await cacheService.delete(`${this.cacheKeyPrefix}${id}`)
    await cacheService.invalidatePattern(`${this.cacheKeyPrefix}all:*`)
    logger.info(`Product updated: ${id}`)

    return product
  }

  async deleteProduct(id: string) {
    await this.getProductById(id)

    await prisma.product.delete({
      where: { id },
    })

    await cacheService.delete(`${this.cacheKeyPrefix}${id}`)
    await cacheService.invalidatePattern(`${this.cacheKeyPrefix}all:*`)
    logger.info(`Product deleted: ${id}`)
  }

  async checkStockAvailability(
    productId: string,
    quantity: number
  ): Promise<boolean> {
    const product = await this.getProductById(productId)
    return product.stock >= quantity
  }
}
