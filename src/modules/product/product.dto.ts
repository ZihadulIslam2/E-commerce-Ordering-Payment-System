import { z } from 'zod'

// Zod schemas for validation
export const createProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters'),
  sku: z.string().min(3, 'SKU must be at least 3 characters'),
  description: z.string().optional(),
  price: z.number().positive('Price must be greater than 0'),
  stock: z.number().int().nonnegative('Stock cannot be negative'),
  categoryId: z.string().uuid('Invalid category ID'),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

export const updateProductSchema = z.object({
  name: z.string().min(2).optional(),
  sku: z.string().min(3).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().nonnegative().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

export const productFiltersSchema = z.object({
  categoryId: z.string().uuid().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  search: z.string().optional(),
})

// TypeScript types
export type CreateProductDTO = z.infer<typeof createProductSchema>
export type UpdateProductDTO = z.infer<typeof updateProductSchema>
export type ProductFilters = z.infer<typeof productFiltersSchema>
