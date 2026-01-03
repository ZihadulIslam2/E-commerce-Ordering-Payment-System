import bcrypt from 'bcrypt'
import jwt, { SignOptions } from 'jsonwebtoken'
import prisma from '../../config/database'
import logger from '../../config/logger'
import { env } from '../../config/env'
import { ValidationError, AppError } from '../../utils/errors'
import {
  RegisterDTO,
  LoginDTO,
  AuthResponse,
  registerSchema,
  loginSchema,
} from './auth.dto'

export class AuthService {
  private readonly SALT_ROUNDS = 10

  /**
   * Generate JWT token for authenticated user
   */
  private generateToken(userId: string, email: string, role: string): string {
    const options: SignOptions = {
      // Accept duration strings like '7d' instead of truncating to seconds
      expiresIn: env.JWT_EXPIRE,
    }
    return jwt.sign({ userId, email, role }, env.JWT_SECRET as string, options)
  }

  /**
   * Register a new user
   */
  async register(data: RegisterDTO): Promise<AuthResponse> {
    // Validate with Zod
    const validated = registerSchema.parse(data)

    // Check if email is unique
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    })

    if (existingUser) {
      throw new ValidationError('Email already registered')
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(
      validated.password,
      this.SALT_ROUNDS
    )

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        name: validated.name,
      },
    })

    logger.info(`User registered successfully: ${user.id}`)

    // Generate JWT token
    const token = this.generateToken(user.id, user.email, user.role)

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }
  }

  /**
   * Login existing user
   */
  async login(data: LoginDTO): Promise<AuthResponse> {
    // Validate with Zod
    const validated = loginSchema.parse(data)

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    })

    if (!user) {
      throw new ValidationError('Invalid email or password')
    }

    // Compare password with bcrypt
    const isPasswordValid = await bcrypt.compare(
      validated.password,
      user.password
    )

    if (!isPasswordValid) {
      throw new ValidationError('Invalid email or password')
    }

    logger.info(`User logged in successfully: ${user.id}`)

    // Generate JWT token
    const token = this.generateToken(user.id, user.email, user.role)

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }
  }
}
