# Stripe Payment Integration Setup

This guide explains how to set up Stripe payment integration for the HomeCookedPlate app.

## Overview

The app now includes complete Stripe payment processing:
- Backend payment intent creation
- Secure payment processing via Stripe Payment Sheet
- Order creation after successful payment

## Prerequisites

1. **Stripe Account**: Sign up at [stripe.com](https://stripe.com)
2. **API Keys**: Get your publishable and secret keys from the Stripe Dashboard

## Environment Variables

Add these environment variables to your project:

### Required Variables

```bash
# Stripe Publishable Key (client-side, starts with pk_)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Stripe Secret Key (server-side, starts with sk_)
STRIPE_SECRET_KEY=sk_test_xxx
```

### Getting Your Keys

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Developers** → **API Keys**
3. Copy your **Publishable key** (for EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY)
4. Reveal and copy your **Secret key** (for STRIPE_SECRET_KEY)

⚠️ **Important**: 
- Use **test keys** (pk_test_xxx, sk_test_xxx) during development
- Use **live keys** (pk_live_xxx, sk_live_xxx) in production only
- Never commit secret keys to git

## Architecture

### Backend (tRPC)

**Payment Intent Creation** (`backend/trpc/routes/payments/create-payment-intent/route.ts`)
- Creates a Stripe payment intent with the order amount
- Returns client secret for the Payment Sheet
- Securely calculates amount on server-side

**Payment Confirmation** (`backend/trpc/routes/payments/confirm-payment/route.ts`)
- Verifies payment status with Stripe
- Can be used for webhooks or post-payment verification

### Frontend (React Native)

**StripeProvider** (`app/_layout.tsx`)
- Wraps the app with Stripe context
- Provides payment functionality to all screens

**Checkout Screen** (`app/checkout.tsx`)
- Displays order summary
- Initializes Stripe Payment Sheet
- Processes payment and creates orders

## Payment Flow

```
1. User adds items to cart
2. User goes to checkout
3. User accepts liability waiver
4. User clicks "Place Order"
   ↓
5. Frontend calls createPaymentIntent (tRPC)
   ↓
6. Backend creates Stripe payment intent
   ↓
7. Backend returns client secret
   ↓
8. Frontend initializes Payment Sheet
   ↓
9. User enters payment details in Payment Sheet
   ↓
10. Stripe processes payment
    ↓
11. If successful:
    - Orders are created in database
    - Cart is cleared
    - Confetti animation plays
    ↓
12. If failed:
    - Error message shown
    - User can retry
```

## Testing

### Test Cards

Stripe provides test cards for different scenarios:

| Card Number | Scenario |
|------------|----------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 9995 | Declined |
| 4000 0025 0000 3155 | Requires authentication |

- Use any future expiration date (e.g., 12/34)
- Use any 3-digit CVC (e.g., 123)
- Use any ZIP code (e.g., 12345)

### Testing in Development

1. Add test environment variables
2. Start the app: `npm start`
3. Add items to cart
4. Go to checkout
5. Use test card 4242 4242 4242 4242
6. Complete payment

## Security Features

✅ **Server-side price calculation**: Prices are calculated on the backend to prevent tampering

✅ **Secure payment processing**: All payment data goes directly to Stripe, never stored on our servers

✅ **Environment isolation**: Separate test and live keys prevent accidental live charges

✅ **Client secret security**: Payment intents expire after use

## Production Checklist

Before going live:

- [ ] Switch to live Stripe keys (pk_live_xxx, sk_live_xxx)
- [ ] Enable Stripe webhooks for payment status updates
- [ ] Set up proper error logging and monitoring
- [ ] Test the complete payment flow with live keys in test mode
- [ ] Review Stripe's production checklist
- [ ] Ensure PCI compliance requirements are met
- [ ] Set up refund handling procedures
- [ ] Configure payment failure email notifications

## Stripe Dashboard

Monitor your payments:
- **Payments**: View all payment transactions
- **Customers**: Manage customer data
- **Disputes**: Handle chargebacks
- **Logs**: Debug API requests

## Webhooks (Optional Enhancement)

For production, consider adding Stripe webhooks to handle:
- Payment succeeded events
- Payment failed events
- Refund events
- Dispute events

Webhook endpoint: `POST /api/webhooks/stripe`

## Common Issues

### "Stripe secret key not configured"
- Ensure STRIPE_SECRET_KEY is set in your backend environment
- Check that the backend can access the environment variable

### Payment Sheet doesn't appear
- Verify EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is set correctly
- Check console for Stripe initialization errors
- Ensure the publishable key matches your environment (test vs live)

### "Payment Intent creation failed"
- Check that your Stripe secret key is valid
- Verify you have sufficient permissions in your Stripe account
- Check backend logs for detailed error messages

## Additional Resources

- [Stripe React Native SDK Docs](https://stripe.com/docs/payments/accept-a-payment?platform=react-native)
- [Stripe Payment Intents API](https://stripe.com/docs/api/payment_intents)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [PCI Compliance](https://stripe.com/docs/security/guide)
