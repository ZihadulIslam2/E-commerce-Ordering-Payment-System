# E-commerce Ordering & Payment System

A production-ready e-commerce backend system built with Node.js, Express, TypeScript, Prisma ORM, and PostgreSQL. Supports multiple payment gateways (Stripe & bKash) using Strategy and Factory design patterns.

## Features

- **Product Management**: CRUD operations for products with stock management
- **Order Management**: Create, track, and manage orders with inventory control
- **Payment Processing**: Multi-gateway support (Stripe & bKash)
- **Caching**: Redis caching for improved performance
- **Transaction Management**: Prisma transactions for data consistency
- **Error Handling**: Comprehensive error handling with custom error classes
- **Validation**: Request validation using express-validator
- **Security**: Helmet, CORS, and rate limiting
- **Logging**: Winston logger for structured logging
- **Clean Architecture**: MVC + Service Layer with SOLID principles

## Tech Stack

- Node.js & Express.js
- TypeScript
- Prisma ORM
- PostgreSQL (Neon)
- Redis
- Stripe SDK
- bKash API
- Winston (logging)

## Architecture

```
MVC + Service Layer
├── Controllers: Handle HTTP requests/responses
├── Services: Business logic
├── Models: Prisma schema
├── Routes: API endpoints
├── Strategies: Payment gateway implementations
├── Factories: Payment strategy factory
└── Middleware: Validation, error handling
```

## Design Patterns

- **Strategy Pattern**: Different payment gateway implementations
- **Factory Pattern**: Payment strategy selection
- **Dependency Injection**: Services injected into controllers
- **Repository Pattern**: Prisma as data access layer

## Setup

### Prerequisites

- Node.js >= 18
- PostgreSQL database (Neon recommended)
- Redis server
- Stripe account
- bKash merchant account

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and configure:

   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your credentials:

   ```env
   DATABASE_URL="postgresql://user:password@host:5432/database"
   STRIPE_SECRET_KEY=sk_test_...
   BKASH_APP_KEY=your_app_key
   # ... other variables
   ```

4. Generate Prisma client:

   ```bash
   npm run prisma:generate
   ```

5. Run migrations:

   ```bash
   npm run prisma:migrate
   ```

6. Start development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Products

- `GET /api/products` - Get all products (with filters)
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Orders

- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order by ID
- `GET /api/orders/user/:userId` - Get user orders
- `PATCH /api/orders/:id/status` - Update order status
- `POST /api/orders/:id/cancel` - Cancel order

### Payments

- `POST /api/payments/initiate` - Initiate payment
- `GET /api/payments/:id` - Get payment details
- `POST /api/payments/:id/verify` - Verify payment
- `POST /api/payments/:id/refund` - Refund payment

## Example Requests

### Create Product

```json
POST /api/products
{
  "name": "Wireless Headphones",
  "description": "High-quality wireless headphones",
  "price": 99.99,
  "stock": 50,
  "category": "Electronics",
  "imageUrl": "https://example.com/image.jpg"
}
```

### Create Order

```json
POST /api/orders
{
  "userId": "user-uuid",
  "items": [
    {
      "productId": "product-uuid",
      "quantity": 2
    }
  ],
  "shippingAddress": {
    "fullName": "John Doe",
    "addressLine1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "USA",
    "phone": "+1234567890"
  },
  "paymentMethod": "stripe"
}
```

### Initiate Payment

```json
POST /api/payments/initiate
{
  "orderId": "order-uuid"
}
```

## SOLID Principles Applied

- **Single Responsibility**: Each class has one reason to change
- **Open/Closed**: Payment strategies can be extended without modification
- **Liskov Substitution**: All payment strategies implement IPaymentStrategy
- **Interface Segregation**: Interfaces are client-specific
- **Dependency Inversion**: Controllers depend on service abstractions

## Error Handling

Custom error classes:

- `AppError`: Base error class
- `NotFoundError`: 404 errors
- `ValidationError`: 400 errors
- `PaymentError`: 402 errors
- `InsufficientStockError`: 409 errors

## Caching Strategy

- Product details cached for 1 hour
- Product lists cached for 10 minutes
- Cache invalidation on updates

## Transaction Management

Prisma transactions used for:

- Order creation with stock reduction
- Payment verification with order updates
- Order cancellation with stock restoration

## Security

- Helmet for security headers
- CORS configuration
- Rate limiting (100 requests per 15 minutes)
- Input validation
- Environment variable protection

## Logging

Winston logger with:

- Structured JSON logging
- Error stack traces
- Request/response logging
- Database query logging (dev mode)

## Production Deployment

1. Build TypeScript:

   ```bash
   npm run build
   ```

2. Run production:

   ```bash
   npm start
   ```

3. Environment variables must be set in production

## Project Structure

```
assesment_project/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── logger.ts
│   │   └── redis.ts
│   ├── controllers/
│   │   ├── OrderController.ts
│   │   ├── PaymentController.ts
│   │   └── ProductController.ts
│   ├── factories/
│   │   └── PaymentStrategyFactory.ts
│   ├── middleware/
│   │   ├── asyncHandler.ts
│   │   ├── errorHandler.ts
│   │   └── validation.ts
│   ├── routes/
│   │   ├── orderRoutes.ts
│   │   ├── paymentRoutes.ts
│   │   └── productRoutes.ts
│   ├── services/
│   │   ├── OrderService.ts
│   │   ├── PaymentService.ts
│   │   └── ProductService.ts
│   ├── strategies/
│   │   ├── BkashPaymentStrategy.ts
│   │   └── StripePaymentStrategy.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── cache.ts
│   │   └── errors.ts
│   └── app.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
# E-commerce-Ordering-Payment-System
