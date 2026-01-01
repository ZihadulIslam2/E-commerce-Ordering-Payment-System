export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message)
    Object.setPrototypeOf(this, AppError.prototype)
    Error.captureStackTrace(this, this.constructor)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404)
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400)
  }
}

export class PaymentError extends AppError {
  constructor(message: string = 'Payment processing failed') {
    super(message, 402)
  }
}

export class InsufficientStockError extends AppError {
  constructor(message: string = 'Insufficient stock') {
    super(message, 409)
  }
}
