/**
 * Razorpay Test Configuration
 * This file contains test configuration and utilities for Razorpay integration testing
 */

// Test credentials - Use these for development testing
const RAZORPAY_TEST_CONFIG = {
  // API Credentials (Replace with your test credentials)
  KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_XXXXXXXXX',
  KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'test_secret_key',
  WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret',

  // Test Plan ID (Create this in your Razorpay Dashboard)
  PLAN_MONTHLY_INR: process.env.RAZORPAY_PLAN_MONTHLY_INR || 'plan_test_monthly_inr',

  // Test Card Numbers
  TEST_CARDS: {
    SUCCESS: '4111111111111111',
    FAILURE: '4111111111112222',
    INSUFFICIENT_FUNDS: '5221030000000018',
    NETWORK_ERROR: '4111111111113333',
    // Add CVV (any 3 digits) and expiry (any future date) when using
  },

  // Test Customer Data
  TEST_CUSTOMER: {
    email: 'test@example.com',
    contact: '+910000000000',
    name: 'Test User',
    notes: {
      environment: 'test',
      source: 'automated_test'
    }
  },

  // Webhook Event Types to Test
  WEBHOOK_EVENTS: [
    'subscription.created',
    'subscription.activated',
    'subscription.charged',
    'subscription.updated',
    'subscription.pending',
    'subscription.halted',
    'subscription.cancelled',
    'subscription.completed',
    'subscription.expired',
    'payment.captured',
    'payment.failed',
    'payment.authorized',
  ],

  // URLs
  URLS: {
    LOCAL_WEBHOOK: 'http://localhost:3000/api/razorpay/webhook',
    CREATE_SUBSCRIPTION: 'http://localhost:3000/api/billing/create-subscription',
    VERIFY_PAYMENT: 'http://localhost:3000/api/billing/verify-payment',
    CANCEL_SUBSCRIPTION: 'http://localhost:3000/api/billing/cancel-subscription',
  }
};

// Sample webhook payloads for testing
const SAMPLE_WEBHOOK_PAYLOADS = {
  subscription_activated: {
    "entity": "event",
    "account_id": "acc_test_account",
    "event": "subscription.activated",
    "contains": ["subscription"],
    "payload": {
      "subscription": {
        "entity": {
          "id": "sub_test_123456",
          "entity": "subscription",
          "plan_id": "plan_test_monthly_inr",
          "customer_id": "cust_test_123456",
          "status": "active",
          "current_start": 1735689600,
          "current_end": 1738368000,
          "ended_at": null,
          "quantity": 1,
          "notes": {
            "firebaseUID": "test_user_123",
            "feature": "study-plan"
          },
          "charge_at": 1738368000,
          "start_at": 1735689600,
          "end_at": null,
          "auth_attempts": 0,
          "total_count": 12,
          "paid_count": 1,
          "customer_notify": true,
          "created_at": 1735689500,
          "expire_by": null,
          "short_url": "https://rzp.io/i/test123",
          "has_scheduled_changes": false,
          "change_scheduled_at": null,
          "source": "api",
          "payment_method": "card",
          "offer_id": null,
          "remaining_count": 11
        }
      }
    },
    "created_at": 1735689600
  },

  payment_captured: {
    "entity": "event",
    "account_id": "acc_test_account",
    "event": "payment.captured",
    "contains": ["payment"],
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_test_123456",
          "entity": "payment",
          "amount": 49900,
          "currency": "INR",
          "status": "captured",
          "order_id": null,
          "invoice_id": null,
          "subscription_id": "sub_test_123456",
          "international": false,
          "method": "card",
          "amount_refunded": 0,
          "refund_status": null,
          "captured": true,
          "description": "Subscription Payment",
          "card_id": "card_test_123456",
          "card": {
            "id": "card_test_123456",
            "entity": "card",
            "name": "Test User",
            "last4": "1111",
            "network": "Visa",
            "type": "credit",
            "issuer": null,
            "international": false,
            "emi": false,
            "sub_type": "consumer"
          },
          "bank": null,
          "wallet": null,
          "vpa": null,
          "email": "test@example.com",
          "contact": "+910000000000",
          "customer_id": "cust_test_123456",
          "notes": {
            "subscription_id": "sub_test_123456"
          },
          "fee": 1180,
          "tax": 180,
          "error_code": null,
          "error_description": null,
          "error_source": null,
          "error_step": null,
          "error_reason": null,
          "acquirer_data": {
            "auth_code": "123456"
          },
          "created_at": 1735689700
        }
      }
    },
    "created_at": 1735689700
  },

  subscription_cancelled: {
    "entity": "event",
    "account_id": "acc_test_account",
    "event": "subscription.cancelled",
    "contains": ["subscription"],
    "payload": {
      "subscription": {
        "entity": {
          "id": "sub_test_123456",
          "entity": "subscription",
          "plan_id": "plan_test_monthly_inr",
          "customer_id": "cust_test_123456",
          "status": "cancelled",
          "current_start": 1735689600,
          "current_end": 1738368000,
          "ended_at": 1735689800,
          "quantity": 1,
          "notes": {
            "firebaseUID": "test_user_123",
            "cancellation_reason": "user_requested"
          },
          "charge_at": null,
          "start_at": 1735689600,
          "end_at": 1738368000,
          "auth_attempts": 0,
          "total_count": 12,
          "paid_count": 1,
          "customer_notify": true,
          "created_at": 1735689500,
          "expire_by": null,
          "short_url": "https://rzp.io/i/test123",
          "has_scheduled_changes": false,
          "change_scheduled_at": null,
          "source": "api",
          "payment_method": "card",
          "offer_id": null,
          "remaining_count": 0
        }
      }
    },
    "created_at": 1735689800
  }
};

// Helper function to generate webhook signature
function generateWebhookSignature(payload, secret) {
  const crypto = require('crypto');
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// Helper function to create test subscription request
function createTestSubscriptionRequest(planId = RAZORPAY_TEST_CONFIG.PLAN_MONTHLY_INR) {
  return {
    planId: planId,
    customerNotify: 1,
    metadata: {
      source: 'test',
      feature: 'study-plan',
      environment: 'development'
    }
  };
}

// Helper function to create payment verification request
function createPaymentVerificationRequest(paymentId, subscriptionId, razorpaySignature) {
  return {
    paymentId: paymentId,
    subscriptionId: subscriptionId,
    signature: razorpaySignature
  };
}

// Helper function to generate test Firebase auth token
async function getTestFirebaseToken(uid = 'test_user_123') {
  // This would need actual Firebase Admin SDK setup
  // For now, return a mock token structure
  return `mock_firebase_token_${uid}`;
}

// Export configuration and helpers
module.exports = {
  RAZORPAY_TEST_CONFIG,
  SAMPLE_WEBHOOK_PAYLOADS,
  generateWebhookSignature,
  createTestSubscriptionRequest,
  createPaymentVerificationRequest,
  getTestFirebaseToken
};