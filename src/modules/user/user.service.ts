import prisma from '../../config/database'
import logger from '../../config/logger'
import { NotFoundError, ValidationError } from '../../utils/errors'
import { CreateUserDTO, UpdateUserDTO } from './user.dto'

export class UserService {
  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      throw new NotFoundError('User not found')
    }

    return user
  }

  async getAllUsers() {
    return await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async createUser(data: CreateUserDTO) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existingUser) {
      throw new ValidationError('Email already exists')
    }

    const user = await prisma.user.create({
      data,
    })

    logger.info(`User created: ${user.id}`)
    return user
  }

  async updateUser(id: string, data: UpdateUserDTO) {
    await this.getUserById(id)

    const user = await prisma.user.update({
      where: { id },
      data,
    })

    logger.info(`User updated: ${id}`)
    return user
  }

  async deleteUser(id: string) {
    await this.getUserById(id)

    await prisma.user.delete({
      where: { id },
    })

    logger.info(`User deleted: ${id}`)
  }
}
