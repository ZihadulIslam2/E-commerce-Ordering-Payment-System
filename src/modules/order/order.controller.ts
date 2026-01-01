import { Request, Response } from 'express'
import { OrderService } from './order.service'
import { asyncHandler } from '../../middlewares/async.middleware'
import { OrderStatus } from '@prisma/client'

const orderService = new OrderService()

export class OrderController {
  /**
   * Create order for logged-in user
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId

    if (!userId) {
      throw new Error('User ID not found in request')
    }

    const order = await orderService.createOrder(userId, req.body)

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    })
  })

  /**
   * Get order by ID
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.getOrderById(req.params.id)

    res.status(200).json({
      success: true,
      data: order,
    })
  })

  /**
   * Get user's orders
   */
  getUserOrders = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId

    if (!userId) {
      throw new Error('User ID not found in request')
    }

    const orders = await orderService.getOrdersByUserId(userId)

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    })
  })

  /**
   * Update order status (admin only)
   */
  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.updateOrderStatus(
      req.params.id,
      req.body.status as OrderStatus
    )

    res.status(200).json({
      success: true,
      message: 'Order status updated',
      data: order,
    })
  })

  /**
   * Cancel order
   */
  cancel = asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.cancelOrder(req.params.id)

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    })
  })
}

export const orderController = new OrderController()
