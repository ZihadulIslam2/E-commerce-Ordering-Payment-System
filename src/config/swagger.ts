import swaggerJSDoc from 'swagger-jsdoc'

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'E-commerce API',
      version: '1.0.0',
      description:
        'Auth, Product, Order, and Payment APIs with Stripe & bKash integrations.',
    },
    servers: [
      {
        url: '/api',
      },
    ],
    paths: {
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register new user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterRequest' },
              },
            },
          },
          responses: {
            201: {
              description: 'User registered',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthResponse' },
                },
              },
            },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Login success',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthResponse' },
                },
              },
            },
          },
        },
      },
      '/products': {
        get: {
          tags: ['Products'],
          summary: 'List products',
          responses: {
            200: {
              description: 'Array of products',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Product' },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Products'],
          summary: 'Create product (admin)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateProductRequest' },
              },
            },
          },
          responses: {
            201: {
              description: 'Created product',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Product' },
                },
              },
            },
          },
        },
      },
      '/products/{id}': {
        get: {
          tags: ['Products'],
          summary: 'Get product by id',
          parameters: [
            {
              in: 'path',
              name: 'id',
              schema: { type: 'string', format: 'uuid' },
              required: true,
            },
          ],
          responses: {
            200: {
              description: 'Product',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Product' },
                },
              },
            },
          },
        },
      },
      '/orders': {
        post: {
          tags: ['Orders'],
          summary: 'Create order',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateOrderRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Created order',
            },
          },
        },
      },
      '/orders/my-orders': {
        get: {
          tags: ['Orders'],
          summary: 'Get my orders',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'List of user orders',
            },
          },
        },
      },
      '/orders/{id}': {
        get: {
          tags: ['Orders'],
          summary: 'Get order by id',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', schema: { type: 'string', format: 'uuid' }, required: true },
          ],
          responses: {
            200: { description: 'Order detail' },
          },
        },
      },
      '/payments/initiate': {
        post: {
          tags: ['Payments'],
          summary: 'Initiate payment',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaymentInitiateRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Payment initiated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaymentInitiateResponse' },
                },
              },
            },
          },
        },
      },
      '/payments/{id}': {
        get: {
          tags: ['Payments'],
          summary: 'Get payment by id',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'Payment detail' },
          },
        },
      },
      '/payments/{id}/verify': {
        post: {
          tags: ['Payments'],
          summary: 'Verify payment status',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'Verification result' },
          },
        },
      },
      '/payments/{id}/refund': {
        post: {
          tags: ['Payments'],
          summary: 'Refund payment (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { amount: { type: 'number', example: 10.0 } },
                },
              },
            },
          },
          responses: {
            200: { description: 'Refund processed' },
          },
        },
      },
      '/payments/webhook/stripe': {
        post: {
          tags: ['Payments'],
          summary: 'Stripe webhook endpoint',
          description: 'Consumes Stripe webhook events; uses signature verification.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
          responses: {
            200: { description: 'Webhook received' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            password: { type: 'string', example: 'password123' },
            role: { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            password: { type: 'string', example: 'password123' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', example: 'jwt-token' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string' },
                role: { type: 'string', enum: ['USER', 'ADMIN'] },
              },
            },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            sku: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number', format: 'float' },
            stock: { type: 'integer' },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
            categoryId: { type: 'string', format: 'uuid' },
          },
        },
        CreateProductRequest: {
          type: 'object',
          required: ['name', 'sku', 'price', 'stock', 'categoryId', 'status'],
          properties: {
            name: { type: 'string', example: 'MacBook Pro' },
            sku: { type: 'string', example: 'MBP-14-2023' },
            description: { type: 'string' },
            price: { type: 'number', example: 1999.99 },
            stock: { type: 'integer', example: 10 },
            categoryId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'], example: 'ACTIVE' },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            productId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', example: 2 },
          },
          required: ['productId', 'quantity'],
        },
        CreateOrderRequest: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderItem' },
            },
          },
        },
        PaymentInitiateRequest: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' },
            provider: { type: 'string', enum: ['stripe', 'bkash'], example: 'stripe' },
          },
        },
        PaymentInitiateResponse: {
          type: 'object',
          properties: {
            paymentId: { type: 'string', format: 'uuid' },
            clientSecret: { type: 'string' },
            redirectUrl: { type: 'string', nullable: true },
          },
        },
      },
    },
  },
  apis: [],
}

export const swaggerSpec = swaggerJSDoc(options)
