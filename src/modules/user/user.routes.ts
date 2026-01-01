import { Router } from 'express'
import { userController } from './user.controller'
import { body } from 'express-validator'
import { validateRequest } from '../../middlewares/validation.middleware'

const router = Router()

const createUserValidation = [
  body('email').isEmail().withMessage('Invalid email'),
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('phone').optional().trim(),
  validateRequest,
]

const updateUserValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().trim(),
  validateRequest,
]

router.get('/', userController.getAll)
router.get('/:id', userController.getById)
router.post('/', createUserValidation, userController.create)
router.put('/:id', updateUserValidation, userController.update)
router.delete('/:id', userController.delete)

export default router
