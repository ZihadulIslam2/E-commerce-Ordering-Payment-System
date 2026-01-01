import { Router } from 'express'
import authRoutes from './modules/auth/auth.routes'
import userRoutes from './modules/user/user.routes'
import productRoutes from './modules/product/product.routes'
import categoryRoutes from './modules/category/category.routes'
import orderRoutes from './modules/order/order.routes'
import paymentRoutes from './modules/payment/payment.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/products', productRoutes)
router.use('/categories', categoryRoutes)
router.use('/orders', orderRoutes)
router.use('/payments', paymentRoutes)

export default router
