# Stripe Payment Testing Guide

## Quick Start Testing

### Run automated tests

```bash
npm install
npm test
```

### 1. Setup Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-jwt-secret
```

### 2. Test Payment Flow (End-to-End)

#### Step 1: Register User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "USER"
  }'
```

#### Step 2: Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
# Copy the JWT token from response
```

#### Step 3: Create Product (as Admin)

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "sku": "TEST-001",
    "description": "Test product for payment",
    "price": 99.99,
    "stock": 100,
    "categoryId": "<CATEGORY_UUID>",
    "status": "ACTIVE"
  }'
# Copy the product ID
```

#### Step 4: Create Order

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer <USER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "<PRODUCT_UUID>",
        "quantity": 2
      }
    ]
  }'
# Copy the order ID
```

#### Step 5: Initiate Payment

```bash
curl -X POST http://localhost:3000/api/payments/initiate \
  -H "Authorization: Bearer <USER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "<ORDER_UUID>"
  }'

# Response:
{
  "success": true,
  "message": "Payment initiated successfully",
  "data": {
    "paymentId": "uuid-of-payment",
    "clientSecret": "pi_xxx_secret_yyy",
    "redirectUrl": null
  }
}
```

#### Step 6: Simulate Stripe Webhook (Testing)

**Option A: Using Stripe CLI**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/payments/webhook/stripe

# In another terminal, trigger test event
stripe trigger payment_intent.succeeded
```

**Option B: Manual Webhook Simulation**

```bash
# Create a test event JSON file
cat > webhook_event.json << 'EOF'
{
  "id": "evt_test_webhook",
  "object": "event",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_xxx",
      "object": "payment_intent",
      "amount": 19998,
      "currency": "usd",
      "status": "succeeded",
      "metadata": {
        "orderId": "<ORDER_UUID>"
      }
    }
  }
}
EOF

# Note: Real Stripe webhooks require signature verification
# Use Stripe CLI for proper testing
```

#### Step 7: Verify Payment Status

```bash
curl -X GET http://localhost:3000/api/payments/<PAYMENT_UUID> \
  -H "Authorization: Bearer <USER_JWT_TOKEN>"

# Check status is "SUCCESS"
```

#### Step 8: Verify Order Status

```bash
curl -X GET http://localhost:3000/api/orders/<ORDER_UUID> \
  -H "Authorization: Bearer <USER_JWT_TOKEN>"

# Check status is "PAID"
```

#### Step 9: Verify Stock Reduced

```bash
curl -X GET http://localhost:3000/api/products/<PRODUCT_UUID>

# Check stock is reduced by order quantity
# Original: 100, After payment: 98 (if quantity was 2)
```

### 3. Test Stripe Payment Intent with Real Card

#### Frontend Integration (React Example)

```javascript
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe('pk_test_xxxxxxxxxxxxx')

function CheckoutForm({ clientSecret }) {
  const stripe = useStripe()
  const elements = useElements()

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    // Confirm payment with Stripe
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement),
        billing_details: {
          name: 'Test User',
        },
      },
    })

    if (result.error) {
      console.error(result.error.message)
    } else {
      if (result.paymentIntent.status === 'succeeded') {
        console.log('Payment successful!')
        // Stripe will send webhook to your server
        // Your server will update order status and reduce stock
      }
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button type="submit" disabled={!stripe}>
        Pay
      </button>
    </form>
  )
}

function App({ clientSecret }) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm clientSecret={clientSecret} />
    </Elements>
  )
}
```

### 4. Test Cards (Stripe Test Mode)

| Card Number         | Scenario                |
| ------------------- | ----------------------- |
| 4242 4242 4242 4242 | Success                 |
| 4000 0000 0000 0002 | Card declined           |
| 4000 0000 0000 9995 | Insufficient funds      |
| 4000 0025 0000 3155 | Requires authentication |

**Card Details for Testing:**

- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

### 5. Test Refund

```bash
curl -X POST http://localhost:3000/api/payments/<PAYMENT_UUID>/refund \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50.00
  }'

# Response:
{
  "success": true,
  "message": "Payment refunded successfully",
  "data": {
    "id": "payment-uuid",
    "status": "FAILED",
    "rawResponse": {
      "refundId": "re_xxxxx",
      "refundedAt": "2026-01-01T12:00:00.000Z",
      "refundAmount": 50.00
    }
  }
}
```

### 6. Webhook Events to Monitor

#### Success Flow

```
1. payment_intent.created
   └─> Payment record created in DB

2. payment_intent.succeeded
   └─> ✅ Payment status: SUCCESS
   └─> ✅ Order status: PAID
   └─> ✅ Stock reduced

3. charge.succeeded
   └─> Confirmation of charge
```

#### Failed Flow

```
1. payment_intent.created
   └─> Payment record created in DB

2. payment_intent.payment_failed
   └─> ❌ Payment status: FAILED
   └─> ❌ Order status: PENDING
   └─> ❌ Stock unchanged
```

### 7. Database Verification

```sql
-- Check payment status
SELECT id, "orderId", provider, "transactionId", status, "createdAt"
FROM "Payment"
WHERE id = '<PAYMENT_UUID>';

-- Check order status
SELECT id, "userId", "totalAmount", status, "createdAt"
FROM "Order"
WHERE id = '<ORDER_UUID>';

-- Check order items
SELECT oi.id, oi.quantity, oi.price, oi.subtotal, p.name, p.stock
FROM "OrderItem" oi
JOIN "Product" p ON oi."productId" = p.id
WHERE oi."orderId" = '<ORDER_UUID>';

-- Check stock changes
SELECT id, name, sku, stock, "updatedAt"
FROM "Product"
WHERE id = '<PRODUCT_UUID>';
```

### 8. Testing Edge Cases

#### Test 1: Insufficient Stock

```bash
# 1. Create order with quantity = 200 (more than available stock)
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "<UUID>", "quantity": 200}]
  }'

# 2. Initiate payment
curl -X POST http://localhost:3000/api/payments/initiate \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "<ORDER_UUID>"}'

# 3. Trigger webhook
stripe trigger payment_intent.succeeded

# Expected: Transaction fails, stock unchanged, payment remains PENDING
```

#### Test 2: Duplicate Webhook

```bash
# Trigger same webhook event twice
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.succeeded

# Expected: First webhook processes successfully
#          Second webhook skips (idempotency check)
#          Stock reduced only once
```

#### Test 3: Invalid Signature

```bash
curl -X POST http://localhost:3000/api/payments/webhook/stripe \
  -H "Stripe-Signature: invalid-signature" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 400 Bad Request with "Invalid webhook signature"
```

### 9. Monitoring Logs

```bash
# Watch server logs
tail -f logs/app.log

# Look for:
✅ Payment initiated: <paymentId> for order <orderId>
✅ Stripe webhook received: payment_intent.succeeded
✅ Stock reduced for product <name>: <quantity> units
✅ Payment successful: <paymentId>, Order: <orderId>, Stock reduced
```

### 10. Postman Collection

Import this collection for easy testing:

```json
{
  "info": {
    "name": "Stripe Payment Flow",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Register",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/auth/register",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"name\": \"Test User\",\n  \"email\": \"test@example.com\",\n  \"password\": \"password123\"\n}"
        }
      }
    },
    {
      "name": "2. Login",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/auth/login",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"test@example.com\",\n  \"password\": \"password123\"\n}"
        }
      }
    },
    {
      "name": "3. Create Order",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/orders",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"items\": [\n    {\n      \"productId\": \"{{productId}}\",\n      \"quantity\": 2\n    }\n  ]\n}"
        }
      }
    },
    {
      "name": "4. Initiate Payment",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/payments/initiate",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"orderId\": \"{{orderId}}\"\n}"
        }
      }
    },
    {
      "name": "5. Get Payment",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/payments/{{paymentId}}",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ]
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    }
  ]
}
```

### 11. CI/CD Testing

```yaml
# .github/workflows/test-payments.yml
name: Test Payment Flow

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_KEY }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
        run: npm test
```

---

**Testing Checklist:**

- [ ] Payment initiation creates payment intent
- [ ] Client secret returned to frontend
- [ ] Webhook signature verified
- [ ] Payment success updates payment status
- [ ] Payment success updates order status
- [ ] Stock reduced atomically
- [ ] Stock reduction validates availability
- [ ] Transaction rolls back on insufficient stock
- [ ] Duplicate webhooks handled (idempotency)
- [ ] Failed payments update status correctly
- [ ] Refunds process successfully
- [ ] Admin-only refund access enforced
- [ ] All operations logged
