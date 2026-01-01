import { z } from 'zod'

// Zod schemas for validation
export const orderItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
})

export const createOrderSchema = z.object({
  items: z
    .array(orderItemSchema)
    .min(1, 'Order must contain at least one item'),
})

// TypeScript types
export type OrderItemDTO = z.infer<typeof orderItemSchema>
export type CreateOrderDTO = z.infer<typeof createOrderSchema>

// Response types
export interface OrderItemResponse {
  id: string
  orderId: string
  productId: string
  quantity: number
  price: number
  subtotal: number
}

export interface OrderResponse {
  id: string
  userId: string
  status: string
  totalAmount: number
  items: OrderItemResponse[]
  createdAt: Date
  updatedAt: Date
}
