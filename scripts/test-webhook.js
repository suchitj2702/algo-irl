#!/usr/bin/env node

/**
 * Razorpay Webhook Test Script
 *
 * This script simulates various Razorpay webhook events to test your webhook handler.
 * It sends properly signed webhook payloads to your local server.
 *
 * Usage: npm run razorpay:webhook
 */

require('dotenv').config({ path: '.env.local' });
const http = require('http');
const crypto = require('crypto');

// Import webhook payloads
const { SAMPLE_WEBHOOK_PAYLOADS, generateWebhookSignature } = require('../tests/setup/razorpay-test-config');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper to make HTTP requests
function sendWebhook(payload) {
  return new Promise((resolve, reject) => {
    const payloadString = JSON.stringify(payload);
    const signature = generateWebhookSignature(
      payloadString,
      process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret'
    );

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/razorpay/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature,
        'Content-Length': Buffer.byteLength(payloadString)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: body
        });
      });
    });

    req.on('error', reject);
    req.write(payloadString);
    req.end();
  });
}

// Test different webhook events
async function testWebhookEvent(eventName, payload) {
  log(`\n📨 Testing ${eventName}...`, 'cyan');

  try {
    const response = await sendWebhook(payload);

    if (response.statusCode === 200) {
      log(`✅ ${eventName} processed successfully`, 'green');
      return true;
    } else if (response.statusCode === 409) {
      log(`⚠️  ${eventName} already processed (idempotent)`, 'yellow');
      return true;
    } else {
      log(`❌ ${eventName} failed with status ${response.statusCode}`, 'red');
      if (response.body) {
        log(`   Response: ${response.body}`, 'yellow');
      }
      return false;
    }
  } catch (error) {
    log(`❌ Error sending ${eventName}: ${error.message}`, 'red');
    return false;
  }
}

// Generate dynamic test data
function generateTestIds() {
  const timestamp = Date.now();
  return {
    subscriptionId: `sub_test_${timestamp}`,
    paymentId: `pay_test_${timestamp}`,
    customerId: `cust_test_${timestamp}`,
    userId: `user_test_${timestamp}`
  };
}

// Create custom webhook payloads with dynamic data
function createDynamicPayload(eventType, testIds) {
  const basePayload = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Add unique event ID
    entity: 'event',
    account_id: 'acc_test_account',
    event: eventType,
    created_at: Math.floor(Date.now() / 1000)
  };

  switch (eventType) {
    case 'subscription.created':
      return {
        ...basePayload,
        contains: ['subscription'],
        payload: {
          subscription: {
            entity: {
              id: testIds.subscriptionId,
              entity: 'subscription',
              plan_id: process.env.RAZORPAY_PLAN_MONTHLY_INR || 'plan_test_monthly',
              customer_id: testIds.customerId,
              status: 'created',
              quantity: 1,
              notes: {
                firebaseUID: testIds.userId,
                feature: 'study-plan',
                test: 'true'
              },
              customer_notify: true,
              created_at: Math.floor(Date.now() / 1000),
              short_url: `https://rzp.io/i/${testIds.subscriptionId}`
            }
          }
        }
      };

    case 'subscription.activated':
      return {
        ...basePayload,
        contains: ['subscription'],
        payload: {
          subscription: {
            entity: {
              id: testIds.subscriptionId,
              entity: 'subscription',
              plan_id: process.env.RAZORPAY_PLAN_MONTHLY_INR || 'plan_test_monthly',
              customer_id: testIds.customerId,
              status: 'active',
              current_start: Math.floor(Date.now() / 1000),
              current_end: Math.floor(Date.now() / 1000) + 2592000, // +30 days
              quantity: 1,
              notes: {
                firebaseUID: testIds.userId,
                feature: 'study-plan',
                test: 'true'
              },
              paid_count: 1,
              customer_notify: true,
              created_at: Math.floor(Date.now() / 1000) - 60
            }
          }
        }
      };

    case 'payment.captured':
      return {
        ...basePayload,
        contains: ['payment'],
        payload: {
          payment: {
            entity: {
              id: testIds.paymentId,
              entity: 'payment',
              amount: 49900, // ₹499 in paise
              currency: 'INR',
              status: 'captured',
              subscription_id: testIds.subscriptionId,
              method: 'card',
              captured: true,
              description: 'Test Subscription Payment',
              customer_id: testIds.customerId,
              email: 'test@example.com',
              contact: '+919999999999',
              notes: {
                subscription_id: testIds.subscriptionId,
                firebaseUID: testIds.userId,
                test: 'true'
              },
              created_at: Math.floor(Date.now() / 1000)
            }
          }
        }
      };

    case 'payment.failed':
      return {
        ...basePayload,
        contains: ['payment'],
        payload: {
          payment: {
            entity: {
              id: testIds.paymentId,
              entity: 'payment',
              amount: 49900,
              currency: 'INR',
              status: 'failed',
              subscription_id: testIds.subscriptionId,
              method: 'card',
              captured: false,
              description: 'Test Subscription Payment',
              customer_id: testIds.customerId,
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Test payment failure',
              notes: {
                subscription_id: testIds.subscriptionId,
                firebaseUID: testIds.userId,
                test: 'true'
              },
              created_at: Math.floor(Date.now() / 1000)
            }
          }
        }
      };

    case 'subscription.cancelled':
      return {
        ...basePayload,
        contains: ['subscription'],
        payload: {
          subscription: {
            entity: {
              id: testIds.subscriptionId,
              entity: 'subscription',
              plan_id: process.env.RAZORPAY_PLAN_MONTHLY_INR || 'plan_test_monthly',
              customer_id: testIds.customerId,
              status: 'cancelled',
              ended_at: Math.floor(Date.now() / 1000),
              quantity: 1,
              notes: {
                firebaseUID: testIds.userId,
                cancellation_reason: 'test_cancellation',
                test: 'true'
              },
              paid_count: 1,
              created_at: Math.floor(Date.now() / 1000) - 86400
            }
          }
        }
      };

    default:
      return basePayload;
  }
}

// Simulate a complete subscription lifecycle
async function testSubscriptionLifecycle() {
  log('\n' + '='.repeat(50), 'bright');
  log('🔄 TESTING COMPLETE SUBSCRIPTION LIFECYCLE', 'bright');
  log('='.repeat(50), 'bright');

  const testIds = generateTestIds();
  log(`\nTest IDs:`, 'magenta');
  log(`  Subscription: ${testIds.subscriptionId}`, 'blue');
  log(`  Customer: ${testIds.customerId}`, 'blue');
  log(`  User: ${testIds.userId}`, 'blue');

  const lifecycle = [
    { event: 'subscription.created', delay: 0 },
    { event: 'payment.captured', delay: 1000 },
    { event: 'subscription.activated', delay: 1000 },
    { event: 'subscription.cancelled', delay: 2000 }
  ];

  const results = [];

  for (const step of lifecycle) {
    if (step.delay > 0) {
      log(`\n⏳ Waiting ${step.delay}ms...`, 'cyan');
      await new Promise(resolve => setTimeout(resolve, step.delay));
    }

    const payload = createDynamicPayload(step.event, testIds);
    const success = await testWebhookEvent(step.event, payload);
    results.push({ event: step.event, success });
  }

  return results;
}

// Test error scenarios
async function testErrorScenarios() {
  log('\n' + '='.repeat(50), 'bright');
  log('⚠️  TESTING ERROR SCENARIOS', 'bright');
  log('='.repeat(50), 'bright');

  const scenarios = [
    {
      name: 'Invalid Signature',
      test: async () => {
        log('\n🔐 Testing invalid signature...', 'cyan');
        const payload = createDynamicPayload('subscription.activated', generateTestIds());
        const payloadString = JSON.stringify(payload);

        const options = {
          hostname: 'localhost',
          port: 3000,
          path: '/api/razorpay/webhook',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-razorpay-signature': 'invalid_signature_123',
            'Content-Length': Buffer.byteLength(payloadString)
          }
        };

        return new Promise((resolve) => {
          const req = http.request(options, (res) => {
            if (res.statusCode === 401 || res.statusCode === 400) {
              log('✅ Invalid signature correctly rejected', 'green');
              resolve(true);
            } else {
              log(`❌ Invalid signature not rejected (status: ${res.statusCode})`, 'red');
              resolve(false);
            }
          });
          req.on('error', () => resolve(false));
          req.write(payloadString);
          req.end();
        });
      }
    },
    {
      name: 'Missing Signature',
      test: async () => {
        log('\n🔐 Testing missing signature...', 'cyan');
        const payload = createDynamicPayload('subscription.activated', generateTestIds());
        const payloadString = JSON.stringify(payload);

        const options = {
          hostname: 'localhost',
          port: 3000,
          path: '/api/razorpay/webhook',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payloadString)
          }
        };

        return new Promise((resolve) => {
          const req = http.request(options, (res) => {
            if (res.statusCode === 401 || res.statusCode === 400) {
              log('✅ Missing signature correctly rejected', 'green');
              resolve(true);
            } else {
              log(`❌ Missing signature not rejected (status: ${res.statusCode})`, 'red');
              resolve(false);
            }
          });
          req.on('error', () => resolve(false));
          req.write(payloadString);
          req.end();
        });
      }
    },
    {
      name: 'Malformed Payload',
      test: async () => {
        log('\n📦 Testing malformed payload...', 'cyan');
        const malformedPayload = 'not a json payload';
        const signature = generateWebhookSignature(
          malformedPayload,
          process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret'
        );

        const options = {
          hostname: 'localhost',
          port: 3000,
          path: '/api/razorpay/webhook',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-razorpay-signature': signature,
            'Content-Length': Buffer.byteLength(malformedPayload)
          }
        };

        return new Promise((resolve) => {
          const req = http.request(options, (res) => {
            if (res.statusCode === 400) {
              log('✅ Malformed payload correctly rejected', 'green');
              resolve(true);
            } else {
              log(`❌ Malformed payload not rejected (status: ${res.statusCode})`, 'red');
              resolve(false);
            }
          });
          req.on('error', () => resolve(false));
          req.write(malformedPayload);
          req.end();
        });
      }
    }
  ];

  const results = [];
  for (const scenario of scenarios) {
    const success = await scenario.test();
    results.push({ name: scenario.name, success });
  }

  return results;
}

// Main test runner
async function runWebhookTests() {
  log('\n' + '='.repeat(50), 'bright');
  log('🔔 RAZORPAY WEBHOOK TEST SUITE', 'bright');
  log('='.repeat(50), 'bright');

  // Check server health
  log('\n📡 Checking server health...', 'cyan');
  try {
    await new Promise((resolve, reject) => {
      http.get('http://localhost:3000/api/razorpay/webhook', (res) => {
        // 405 means the endpoint exists but GET is not allowed (which is expected)
        if (res.statusCode === 405 || res.statusCode === 401 || res.statusCode === 200) {
          log('✅ Server is running', 'green');
          resolve();
        } else if (res.statusCode === 404) {
          reject(new Error('Webhook endpoint not found'));
        } else {
          log(`⚠️  Server returned status ${res.statusCode}, continuing anyway...`, 'yellow');
          resolve();
        }
      }).on('error', reject);
    });
  } catch (error) {
    log('❌ Server is not running. Please start with: npm run dev', 'red');
    process.exit(1);
  }

  // Check webhook secret configuration
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    log('\n⚠️  RAZORPAY_WEBHOOK_SECRET not configured', 'yellow');
    log('Using default test secret. Configure in .env.local for production testing.', 'yellow');
  }

  // Test individual webhook events
  log('\n' + '='.repeat(50), 'bright');
  log('📬 TESTING INDIVIDUAL WEBHOOK EVENTS', 'bright');
  log('='.repeat(50), 'bright');

  const individualResults = [];
  const events = [
    'subscription.created',
    'subscription.activated',
    'payment.captured',
    'payment.failed',
    'subscription.cancelled'
  ];

  for (const event of events) {
    const testIds = generateTestIds();
    const payload = createDynamicPayload(event, testIds);
    const success = await testWebhookEvent(event, payload);
    individualResults.push({ event, success });

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Test subscription lifecycle
  const lifecycleResults = await testSubscriptionLifecycle();

  // Test error scenarios
  const errorResults = await testErrorScenarios();

  // Summary
  log('\n' + '='.repeat(50), 'bright');
  log('📊 WEBHOOK TEST RESULTS SUMMARY', 'bright');
  log('='.repeat(50), 'bright');

  log('\n📬 Individual Events:', 'cyan');
  individualResults.forEach(({ event, success }) => {
    const icon = success ? '✅' : '❌';
    const color = success ? 'green' : 'red';
    log(`  ${icon} ${event}`, color);
  });

  log('\n🔄 Lifecycle Events:', 'cyan');
  lifecycleResults.forEach(({ event, success }) => {
    const icon = success ? '✅' : '❌';
    const color = success ? 'green' : 'red';
    log(`  ${icon} ${event}`, color);
  });

  log('\n⚠️  Error Handling:', 'cyan');
  errorResults.forEach(({ name, success }) => {
    const icon = success ? '✅' : '❌';
    const color = success ? 'green' : 'red';
    log(`  ${icon} ${name}`, color);
  });

  const totalTests = individualResults.length + lifecycleResults.length + errorResults.length;
  const passedTests = [
    ...individualResults,
    ...lifecycleResults,
    ...errorResults
  ].filter(r => r.success).length;

  log('\n' + '='.repeat(50), 'bright');
  if (passedTests === totalTests) {
    log(`🎉 All webhook tests passed! (${passedTests}/${totalTests})`, 'green');
  } else {
    log(`⚠️  Some tests failed (${passedTests}/${totalTests})`, 'yellow');
  }

  log('\nNext steps:', 'cyan');
  log('1. Check server logs for webhook processing details', 'blue');
  log('2. Verify data in Firestore collections', 'blue');
  log('3. Test with real Razorpay test mode webhooks', 'blue');
  log('4. Set up ngrok for external webhook testing', 'blue');

  log('\nFor more details, see: docs/TESTING.md', 'cyan');
}

// Run tests
runWebhookTests().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});