import { Request, Response } from 'express'
import { UserService } from './user.service'
import { asyncHandler } from '../../middlewares/async.middleware'

const userService = new UserService()

export class UserController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const users = await userService.getAllUsers()

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    })
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getUserById(req.params.id)

    res.status(200).json({
      success: true,
      data: user,
    })
  })

  create = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.createUser(req.body)

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user,
    })
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.updateUser(req.params.id, req.body)

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user,
    })
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    await userService.deleteUser(req.params.id)

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    })
  })
}

export const userController = new UserController()
