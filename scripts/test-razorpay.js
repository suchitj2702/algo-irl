#!/usr/bin/env node

/**
 * Razorpay Integration Test Script
 *
 * This script tests the Razorpay integration by:
 * 1. Creating a test subscription
 * 2. Simulating payment completion
 * 3. Verifying the payment
 * 4. Testing webhook processing
 *
 * Usage: npm run razorpay:test
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Import test configuration
const {
  RAZORPAY_TEST_CONFIG,
  createTestSubscriptionRequest,
  createPaymentVerificationRequest,
  generateWebhookSignature
} = require('../tests/setup/razorpay-test-config');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper function for colored console output
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }

    req.end();
  });
}

// Test 1: Check server health
async function testServerHealth() {
  log('\n📡 Testing Server Health...', 'cyan');

  try {
    // Check if the billing API endpoint is accessible (401 is expected without auth)
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/billing/create-subscription',
      method: 'GET'
    });

    if (response.statusCode === 401 || response.statusCode === 405 || response.statusCode === 200) {
      log('✅ Server is healthy (API endpoints are accessible)', 'green');
      return true;
    } else if (response.statusCode === 404) {
      log('❌ API endpoints not found. Check your API routes', 'red');
      return false;
    } else {
      log(`⚠️  Server returned unexpected status ${response.statusCode}`, 'yellow');
      return true; // Continue anyway
    }
  } catch (error) {
    log('❌ Server is not running. Please start with: npm run dev', 'red');
    return false;
  }
}

// Test 2: Create a test subscription
async function testCreateSubscription() {
  log('\n💳 Testing Subscription Creation...', 'cyan');

  // Load test user credentials and get ID token
  let authToken;
  try {
    const fs = require('fs');
    const path = require('path');
    const credentialsPath = path.join(__dirname, '.test-credentials.json');

    if (fs.existsSync(credentialsPath)) {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

      // Use ID token if available, otherwise fall back to custom token
      if (credentials.idToken) {
        authToken = 'Bearer ' + credentials.idToken;
        log('✅ Using Firebase test user ID token', 'green');
      } else if (credentials.customToken) {
        // Try to get ID token
        const { getValidIdToken } = require('./get-firebase-token');
        const idToken = await getValidIdToken();
        if (idToken) {
          authToken = 'Bearer ' + idToken;
          log('✅ Obtained Firebase ID token', 'green');
        } else {
          authToken = 'Bearer ' + credentials.customToken;
          log('⚠️  Using custom token (may not work)', 'yellow');
        }
      } else {
        authToken = 'Bearer test_firebase_token_' + Date.now();
        log('⚠️  No valid token found, using mock', 'yellow');
      }
    } else {
      // Fallback to mock token
      authToken = 'Bearer test_firebase_token_' + Date.now();
      log('⚠️  Test credentials not found, using mock token', 'yellow');
    }
  } catch (error) {
    authToken = 'Bearer test_firebase_token_' + Date.now();
    log('⚠️  Could not load test credentials, using mock token', 'yellow');
  }

  const requestData = createTestSubscriptionRequest(RAZORPAY_TEST_CONFIG.PLANS.MONTHLY_INR);

  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/billing/create-subscription',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken
      }
    }, requestData);

    if (response.statusCode === 200 && response.body.subscriptionId) {
      log(`✅ Subscription created: ${response.body.subscriptionId}`, 'green');
      log(`   Payment URL: ${response.body.shortUrl}`, 'blue');
      return response.body;
    } else if (response.statusCode === 401) {
      log('⚠️  Authentication failed. Check Firebase test user setup.', 'yellow');
      return null;
    } else {
      log(`❌ Failed to create subscription: ${JSON.stringify(response.body)}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Error creating subscription: ${error.message}`, 'red');
    return null;
  }
}

// Test 3: Simulate webhook event
async function testWebhook(eventType = 'subscription.activated') {
  log(`\n🔔 Testing Webhook (${eventType})...`, 'cyan');

  const webhookPayload = {
    id: `evt_test_${Date.now()}`, // Add event ID
    entity: 'event',
    account_id: 'acc_test',
    event: eventType,
    contains: [eventType.split('.')[0]],
    payload: {
      [eventType.split('.')[0]]: {
        entity: {
          id: `${eventType.split('.')[0]}_test_${Date.now()}`,
          status: eventType.split('.')[1] || 'active',
          plan_id: RAZORPAY_TEST_CONFIG.PLANS.MONTHLY_INR,
          customer_id: 'cust_test_123',
          amount: 49900,
          currency: 'INR',
          notes: {
            firebaseUID: 'test_user_123'
          }
        }
      }
    },
    created_at: Math.floor(Date.now() / 1000)
  };

  const payloadString = JSON.stringify(webhookPayload);
  const signature = generateWebhookSignature(
    payloadString,
    process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret'
  );

  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/razorpay/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature
      }
    }, payloadString);

    if (response.statusCode === 200) {
      log(`✅ Webhook processed successfully`, 'green');
      return true;
    } else {
      log(`⚠️  Webhook returned status ${response.statusCode}: ${JSON.stringify(response.body)}`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Error processing webhook: ${error.message}`, 'red');
    return false;
  }
}

// Test 4: Verify payment signature
async function testPaymentVerification() {
  log('\n🔐 Testing Payment Verification...', 'cyan');

  // Load test user credentials and get ID token
  let authToken;
  try {
    const fs = require('fs');
    const path = require('path');
    const credentialsPath = path.join(__dirname, '.test-credentials.json');

    if (fs.existsSync(credentialsPath)) {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

      // Use ID token if available
      if (credentials.idToken) {
        authToken = 'Bearer ' + credentials.idToken;
        log('✅ Using Firebase test user ID token', 'green');
      } else if (credentials.customToken) {
        // Try to get ID token
        const { getValidIdToken } = require('./get-firebase-token');
        const idToken = await getValidIdToken();
        if (idToken) {
          authToken = 'Bearer ' + idToken;
          log('✅ Obtained Firebase ID token', 'green');
        } else {
          authToken = 'Bearer test_firebase_token_' + Date.now();
          log('⚠️  Could not get ID token, using mock', 'yellow');
        }
      } else {
        authToken = 'Bearer test_firebase_token_' + Date.now();
        log('⚠️  No valid token found, using mock', 'yellow');
      }
    } else {
      authToken = 'Bearer test_firebase_token_' + Date.now();
      log('⚠️  Test credentials not found, using mock token', 'yellow');
    }
  } catch (error) {
    authToken = 'Bearer test_firebase_token_' + Date.now();
    log('⚠️  Could not load test credentials, using mock token', 'yellow');
  }
  const paymentId = 'pay_test_' + Date.now();
  const subscriptionId = 'sub_test_' + Date.now();

  // Generate test signature
  const message = paymentId + '|' + subscriptionId;
  const signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'test_secret')
    .update(message)
    .digest('hex');

  const verificationData = createPaymentVerificationRequest(
    paymentId,
    subscriptionId,
    signature
  );

  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/billing/verify-payment',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken
      }
    }, verificationData);

    if (response.statusCode === 200) {
      log('✅ Payment verification endpoint working', 'green');
      return true;
    } else if (response.statusCode === 401) {
      log('⚠️  Authentication required for payment verification', 'yellow');
      return false;
    } else {
      log(`⚠️  Payment verification returned: ${JSON.stringify(response.body)}`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Error verifying payment: ${error.message}`, 'red');
    return false;
  }
}

// Test 5: Check environment variables
function checkEnvironment() {
  log('\n🔧 Checking Environment Configuration...', 'cyan');

  const required = [
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'RAZORPAY_PLAN_MONTHLY_INR'
  ];

  const missing = [];
  const configured = [];

  required.forEach(key => {
    if (process.env[key]) {
      configured.push(key);
    } else {
      missing.push(key);
    }
  });

  if (configured.length > 0) {
    log(`✅ Configured: ${configured.join(', ')}`, 'green');
  }

  if (missing.length > 0) {
    log(`❌ Missing: ${missing.join(', ')}`, 'red');
    log('   Please add these to your .env.local file', 'yellow');
    return false;
  }

  // Check if using test credentials
  if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_')) {
    log('⚠️  WARNING: Not using test credentials! Use rzp_test_* keys for testing', 'yellow');
  }

  return missing.length === 0;
}

// Main test runner
async function runTests() {
  log('\n' + '='.repeat(50), 'bright');
  log('🚀 RAZORPAY INTEGRATION TEST SUITE', 'bright');
  log('='.repeat(50), 'bright');

  const results = {
    environment: false,
    server: false,
    subscription: false,
    webhook: false,
    verification: false
  };

  // Check environment
  results.environment = checkEnvironment();
  if (!results.environment) {
    log('\n⚠️  Please configure your environment variables first', 'yellow');
    log('Copy .env.local.example to .env.local and add your test credentials', 'yellow');
    return;
  }

  // Check server health
  results.server = await testServerHealth();
  if (!results.server) {
    log('\n⚠️  Please start the development server with: npm run dev', 'yellow');
    return;
  }

  // Run integration tests
  const subscription = await testCreateSubscription();
  results.subscription = subscription !== null;

  // Test webhooks
  results.webhook = await testWebhook('subscription.activated');
  await testWebhook('payment.captured');
  await testWebhook('subscription.cancelled');

  // Test payment verification
  results.verification = await testPaymentVerification();

  // Summary
  log('\n' + '='.repeat(50), 'bright');
  log('📊 TEST RESULTS SUMMARY', 'bright');
  log('='.repeat(50), 'bright');

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌';
    const color = passed ? 'green' : 'red';
    log(`${status} ${test.charAt(0).toUpperCase() + test.slice(1)}`, color);
  });

  log('\n' + '='.repeat(50), 'bright');

  if (passedTests === totalTests) {
    log(`🎉 All tests passed! (${passedTests}/${totalTests})`, 'green');
    log('\nNext steps:', 'cyan');
    log('1. Open the payment URL in a browser', 'blue');
    log('2. Use test card: 4111 1111 1111 1111', 'blue');
    log('3. Check webhook processing in server logs', 'blue');
    log('4. Verify data in Firestore', 'blue');
  } else {
    log(`⚠️  Some tests failed (${passedTests}/${totalTests})`, 'yellow');
    log('\nTroubleshooting:', 'cyan');
    log('1. Check .env.local configuration', 'blue');
    log('2. Ensure server is running (npm run dev)', 'blue');
    log('3. Verify Razorpay test credentials', 'blue');
    log('4. Check server logs for errors', 'blue');
  }

  log('\nFor detailed testing guide, see: docs/TESTING.md', 'cyan');
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});