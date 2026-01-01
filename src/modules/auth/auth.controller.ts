import { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { asyncHandler } from '../../middlewares/async.middleware'

const authService = new AuthService()

export class AuthController {
  register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body)

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    })
  })

  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body)

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    })
  })
}

export const authController = new AuthController()
