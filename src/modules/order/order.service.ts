import { Prisma, OrderStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import prisma from '../../config/database'
import logger from '../../config/logger'
import {
  NotFoundError,
  ValidationError,
  InsufficientStockError,
} from '../../utils/errors'
import { CreateOrderDTO, createOrderSchema, OrderItemDTO } from './order.dto'

export class OrderService {
  /**
   * Create a new order for logged-in user
   * Does NOT reduce stock - that happens during payment/confirmation
   */
  async createOrder(userId: string, data: CreateOrderDTO) {
    // Validate with Zod
    const validated = createOrderSchema.parse(data)

    if (!validated.items || validated.items.length === 0) {
      throw new ValidationError('Order must contain at least one item')
    }

    // Use transaction for data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Fetch all products in bulk
      const productIds = validated.items.map((item) => item.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      })

      if (products.length !== productIds.length) {
        throw new NotFoundError('One or more products not found')
      }

      // Verify all products are active and check stock availability
      const productMap = new Map(products.map((p) => [p.id, p]))
      let totalAmount = new Decimal(0)
      const orderItems: Prisma.OrderItemCreateManyOrderInput[] = []

      for (const item of validated.items) {
        const product = productMap.get(item.productId)

        if (!product) {
          throw new NotFoundError(`Product ${item.productId} not found`)
        }

        // Validate product is active
        if (product.status !== 'ACTIVE') {
          throw new ValidationError(
            `Product "${product.name}" is not available`
          )
        }

        // Validate stock is available (informational only - stock not reduced)
        if (product.stock < item.quantity) {
          throw new InsufficientStockError(
            `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`
          )
        }

        // Calculate subtotal deterministically: price * quantity
        const price = product.price
        const subtotal = price.multiply(item.quantity)
        totalAmount = totalAmount.plus(subtotal)

        // Add order item data
        orderItems.push({
          productId: product.id,
          quantity: item.quantity,
          price: price,
          subtotal: subtotal,
        })
      }

      // Create order with items in single transaction
      const order = await tx.order.create({
        data: {
          userId,
          totalAmount: totalAmount,
          status: OrderStatus.PENDING,
          items: {
            createMany: {
              data: orderItems,
            },
          },
        },
        include: {
          items: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      })

      logger.info(
        `Order created: ${order.id} for user ${userId} - Total: $${totalAmount}`
      )

      return order
    })

    return result
  }

  /**
   * Get order by ID with all details
   */
  async getOrderById(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`)
    }

    return order
  }

  /**
   * Get all orders for a user
   */
  async getOrdersByUserId(userId: string) {
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    logger.info(`Retrieved ${orders.length} orders for user ${userId}`)
    return orders
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = await this.getOrderById(orderId)

    // Validate status transitions
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: [OrderStatus.PAID, OrderStatus.CANCELED],
      PAID: [OrderStatus.PENDING, OrderStatus.CANCELED],
      CANCELED: [],
    }

    if (!validTransitions[order.status as OrderStatus]?.includes(status)) {
      throw new ValidationError(
        `Cannot transition order from ${order.status} to ${status}`
      )
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        items: true,
        user: { select: { id: true, email: true, name: true } },
      },
    })

    logger.info(`Order ${orderId} status updated to ${status}`)
    return updatedOrder
  }

  /**
   * Cancel order - only allowed for PENDING orders
   */
  async cancelOrder(orderId: string) {
    const order = await this.getOrderById(orderId)

    if (order.status !== OrderStatus.PENDING) {
      throw new ValidationError(
        `Cannot cancel order with status ${order.status}. Only PENDING orders can be cancelled.`
      )
    }

    const cancelledOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELED },
      include: {
        items: true,
        user: { select: { id: true, email: true, name: true } },
      },
    })

    logger.info(`Order ${orderId} cancelled`)
    return cancelledOrder
  }
}
