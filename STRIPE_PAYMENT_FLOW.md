# Stripe Payment Flow Implementation

## Overview

Complete Stripe payment integration with webhook handling, payment confirmation, and atomic stock reduction using Prisma transactions.

## Features Implemented

### 1. Payment Intent Creation

- Creates Stripe payment intent with automatic payment methods
- Stores payment record in database with PENDING status
- Returns client secret for frontend payment confirmation

### 2. Webhook Event Handling

- **Signature Verification**: Validates webhook authenticity using Stripe signature
- **Event Processing**: Handles payment lifecycle events
- **Atomic Operations**: Uses Prisma transactions for data consistency

### 3. Stock Reduction

- **Atomic Transaction**: Stock reduction happens atomically with payment confirmation
- **Validation**: Checks stock availability before reduction
- **Rollback**: Transaction fails if insufficient stock

### 4. Payment Status Management

- Updates payment status based on webhook events
- Updates order status (PENDING → PAID)
- Logs all operations for audit trail

## API Endpoints

### 1. Initiate Payment

```bash
POST /api/payments/initiate
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "orderId": "uuid-of-order"
}

Response:
{
  "success": true,
  "message": "Payment initiated successfully",
  "data": {
    "paymentId": "uuid",
    "clientSecret": "pi_xxx_secret_yyy",
    "redirectUrl": null
  }
}
```

### 2. Verify Payment (Manual)

```bash
POST /api/payments/:paymentId/verify
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "id": "uuid",
    "status": "SUCCESS",
    "transactionId": "pi_xxx",
    "order": {...}
  }
}
```

### 3. Stripe Webhook (Automatic)

```bash
POST /api/payments/webhook/stripe
Stripe-Signature: t=timestamp,v1=signature
Content-Type: application/json
[Raw Body Required]

Response:
{
  "received": true
}
```

### 4. Get Payment Details

```bash
GET /api/payments/:paymentId
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "orderId": "uuid",
    "provider": "STRIPE",
    "transactionId": "pi_xxx",
    "status": "SUCCESS",
    "rawResponse": {...},
    "order": {...}
  }
}
```

### 5. Refund Payment (Admin Only)

```bash
POST /api/payments/:paymentId/refund
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "amount": 50.00  // Optional, omit for full refund
}

Response:
{
  "success": true,
  "message": "Payment refunded successfully",
  "data": {
    "id": "uuid",
    "status": "FAILED",  // Marked as FAILED after refund
    "rawResponse": {
      "refundId": "re_xxx",
      "refundedAt": "2026-01-01T12:00:00.000Z"
    }
  }
}
```

## Webhook Events Handled

### 1. payment_intent.succeeded

- ✅ Updates payment status to SUCCESS
- ✅ Updates order status to PAID
- ✅ Reduces product stock atomically
- ✅ Validates stock availability before reduction
- ✅ Logs stock reduction for each product

**Flow:**

1. Receive webhook event
2. Verify signature
3. Find payment by transaction ID
4. Start Prisma transaction
5. Update payment status
6. Update order status
7. For each order item:
   - Check stock availability
   - Reduce stock atomically using `decrement`
8. Commit transaction (or rollback on error)

### 2. payment_intent.payment_failed

- ❌ Updates payment status to FAILED
- ❌ Stores error details in rawResponse
- ❌ No stock reduction

### 3. payment_intent.canceled

- ❌ Updates payment status to FAILED
- ❌ Updates order status to CANCELED
- ❌ No stock reduction

## Environment Variables Required

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d

# Server
PORT=3000
NODE_ENV=development
```

## Stripe Webhook Setup

### 1. Create Webhook Endpoint in Stripe Dashboard

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. URL: `https://your-domain.com/api/payments/webhook/stripe`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`

### 2. Get Webhook Signing Secret

- Copy the signing secret (starts with `whsec_`)
- Add to `.env` as `STRIPE_WEBHOOK_SECRET`

### 3. Test Webhooks Locally

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/payments/webhook/stripe

# Trigger test event
stripe trigger payment_intent.succeeded
```

## Payment Flow Diagram

```
1. Customer creates order
   └─> POST /api/orders
       └─> Order created with status: PENDING

2. Customer initiates payment
   └─> POST /api/payments/initiate
       └─> Payment intent created in Stripe
       └─> Payment record created with status: PENDING
       └─> Returns clientSecret to frontend

3. Frontend confirms payment (Stripe.js)
   └─> stripe.confirmCardPayment(clientSecret)
       └─> Customer completes payment

4. Stripe sends webhook
   └─> POST /api/payments/webhook/stripe
       └─> Signature verified
       └─> Event: payment_intent.succeeded
       └─> TRANSACTION START
           ├─> Payment status: PENDING → SUCCESS
           ├─> Order status: PENDING → PAID
           └─> Stock reduction:
               ├─> Product A: stock - quantity
               ├─> Product B: stock - quantity
               └─> ... (all order items)
       └─> TRANSACTION COMMIT

5. Order fulfilled
   └─> Stock reduced atomically
   └─> Customer receives confirmation
```

## Security Features

### 1. Webhook Signature Verification

```typescript
// Stripe validates webhook authenticity
const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
```

### 2. Idempotency

- Checks if payment already processed
- Prevents duplicate stock reduction
- Skips processing if payment status is already SUCCESS

### 3. Atomic Transactions

- All database operations wrapped in Prisma transaction
- Stock reduction happens atomically with status updates
- Automatic rollback on any error

### 4. Stock Validation

```typescript
if (product.stock < item.quantity) {
  throw new PaymentError('Insufficient stock')
}
```

## Error Handling

### Insufficient Stock

```json
{
  "error": "Insufficient stock for product ProductName. Available: 5, Required: 10"
}
```

- Transaction rolls back
- Payment status remains PENDING
- Order status remains PENDING
- No stock reduction occurs

### Invalid Webhook Signature

```json
{
  "error": "Invalid webhook signature"
}
```

- Returns 400 Bad Request
- No database operations performed

### Payment Not Found

```json
{
  "error": "Payment not found for transaction: pi_xxx"
}
```

- Logs warning
- Returns success to Stripe (to prevent retries)

## Testing Guide

### 1. Test Payment Success Flow

```bash
# Create test order
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": "uuid", "quantity": 2}
    ]
  }'

# Initiate payment
curl -X POST http://localhost:3000/api/payments/initiate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "order-uuid"}'

# Use Stripe test cards
# Success: 4242 4242 4242 4242
# Decline: 4000 0000 0000 0002

# Trigger webhook (testing)
stripe trigger payment_intent.succeeded
```

### 2. Test Stock Reduction

```bash
# Check product stock before payment
curl http://localhost:3000/api/products/:productId

# Complete payment (via webhook)

# Check product stock after payment
curl http://localhost:3000/api/products/:productId
# Stock should be reduced by order quantity
```

### 3. Test Insufficient Stock

```bash
# Create order with quantity > available stock
# Complete payment
# Transaction should fail
# Stock should remain unchanged
```

## Database Schema

### Payment Table

```prisma
model Payment {
  id            String        @id @default(uuid())
  orderId       String        @unique
  provider      PaymentProvider
  transactionId String?       @unique
  status        PaymentStatus
  rawResponse   Json?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  order         Order         @relation(fields: [orderId], references: [id])
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
}

enum PaymentProvider {
  STRIPE
  BKASH
}
```

## Logging

All operations are logged for audit:

```
✅ Payment initiated: <paymentId> for order <orderId>
✅ Stripe webhook received: payment_intent.succeeded
✅ Stock reduced for product <name>: <quantity> units
✅ Payment successful: <paymentId>, Order: <orderId>, Stock reduced
❌ Payment failed: <paymentId>
❌ Payment canceled: <paymentId>
⚠️  Payment not found for transaction: <transactionId>
⚠️  Payment already processed: <paymentId>
```

## Best Practices

1. **Always use webhooks** for payment confirmation (not client-side verification)
2. **Test webhooks locally** using Stripe CLI before deploying
3. **Monitor webhook delivery** in Stripe dashboard
4. **Set up retry logic** for failed webhook processing
5. **Log all payment events** for debugging and compliance
6. **Use test mode** during development (test API keys)
7. **Implement idempotency** to handle duplicate webhooks
8. **Validate stock** before payment to avoid overselling

## Architecture

```
┌─────────────┐
│   Client    │
│  (Stripe.js)│
└──────┬──────┘
       │
       │ confirmCardPayment(clientSecret)
       │
       ▼
┌─────────────────┐
│  Stripe Server  │
│  Payment Intent │
└────────┬────────┘
         │
         │ Webhook Event
         │
         ▼
┌──────────────────────────────────────────┐
│  Your Server                              │
│  POST /api/payments/webhook/stripe        │
│  ┌────────────────────────────────────┐  │
│  │ 1. Verify Signature                │  │
│  │ 2. Parse Event                     │  │
│  │ 3. Start Transaction               │  │
│  │    ├─ Update Payment: SUCCESS      │  │
│  │    ├─ Update Order: PAID           │  │
│  │    └─ Reduce Stock (atomic)        │  │
│  │ 4. Commit Transaction              │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL DB  │
│  (Neon)         │
└─────────────────┘
```

## Stack Reduction Implementation

```typescript
// Atomic stock reduction using Prisma
await tx.product.update({
  where: { id: productId },
  data: {
    stock: {
      decrement: quantity, // Atomic operation
    },
  },
})
```

**Benefits:**

- ✅ Thread-safe (no race conditions)
- ✅ Atomic (all-or-nothing)
- ✅ Consistent (ACID compliance)
- ✅ Isolated (concurrent transactions don't interfere)

## Troubleshooting

### Webhook not receiving events

- Check webhook URL is publicly accessible
- Verify HTTPS in production (required by Stripe)
- Check Stripe dashboard webhook logs
- Use Stripe CLI for local testing

### Stock not reducing

- Check logs for transaction errors
- Verify product IDs in order items
- Check stock availability before payment
- Review Prisma transaction logs

### Payment status not updating

- Verify webhook signature
- Check STRIPE_WEBHOOK_SECRET is correct
- Review webhook event type handling
- Check database transaction commits

---

**Implementation Complete** ✅

- Payment intent creation
- Webhook signature verification
- Event handling (success/failed/canceled)
- Atomic stock reduction in transactions
- Payment and order status updates
- Comprehensive error handling
- Audit logging
