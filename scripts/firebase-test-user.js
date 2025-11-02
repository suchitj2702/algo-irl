#!/usr/bin/env node

/**
 * Firebase Test User Management
 *
 * This script creates and manages test users for Razorpay integration testing.
 * It uses Firebase Admin SDK to create users and generate auth tokens.
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Initialize Firebase Admin
function initializeAdmin() {
  if (admin.apps.length === 0) {
    try {
      // First try to use service account key from env
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'algoirl'
        });
        log('✅ Firebase Admin initialized with environment key', 'green');
      } else {
        // Try to use service account file
        const serviceAccountPath = path.join(__dirname, '../service-account-key.json');
        if (fs.existsSync(serviceAccountPath)) {
          const serviceAccount = require(serviceAccountPath);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'algoirl'
          });
          log('✅ Firebase Admin initialized with service account file', 'green');
        } else {
          throw new Error('No Firebase service account credentials found');
        }
      }
    } catch (error) {
      log(`❌ Failed to initialize Firebase Admin: ${error.message}`, 'red');
      log('Please ensure FIREBASE_SERVICE_ACCOUNT_KEY is set in .env.local', 'yellow');
      process.exit(1);
    }
  }
  return admin;
}

// Test user configuration
const TEST_USER_CONFIG = {
  email: 'razorpay.test@algoirl.ai',
  password: 'Test@123456!',
  displayName: 'Razorpay Test User',
  uid: 'razorpay_test_user_001',
  emailVerified: true,
  customClaims: {
    role: 'test_user',
    test_account: true
  }
};

// Create or get test user
async function createOrGetTestUser() {
  const auth = admin.auth();

  try {
    // Try to get existing user
    const user = await auth.getUser(TEST_USER_CONFIG.uid);
    log(`✅ Test user already exists: ${user.email}`, 'green');
    return user;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      // Create new test user
      log('📝 Creating new test user...', 'cyan');

      try {
        const user = await auth.createUser({
          uid: TEST_USER_CONFIG.uid,
          email: TEST_USER_CONFIG.email,
          password: TEST_USER_CONFIG.password,
          displayName: TEST_USER_CONFIG.displayName,
          emailVerified: TEST_USER_CONFIG.emailVerified
        });

        // Set custom claims
        await auth.setCustomUserClaims(TEST_USER_CONFIG.uid, TEST_USER_CONFIG.customClaims);

        log(`✅ Test user created: ${user.email}`, 'green');
        log(`   UID: ${user.uid}`, 'blue');
        log(`   Password: ${TEST_USER_CONFIG.password}`, 'blue');

        return user;
      } catch (createError) {
        log(`❌ Failed to create test user: ${createError.message}`, 'red');
        throw createError;
      }
    } else {
      throw error;
    }
  }
}

// Generate custom token for test user
async function generateCustomToken(uid = TEST_USER_CONFIG.uid) {
  const auth = admin.auth();

  try {
    const customToken = await auth.createCustomToken(uid, {
      test_account: true,
      created_at: Date.now()
    });

    log('✅ Custom token generated', 'green');
    return customToken;
  } catch (error) {
    log(`❌ Failed to generate custom token: ${error.message}`, 'red');
    throw error;
  }
}

// Delete test user
async function deleteTestUser() {
  const auth = admin.auth();

  try {
    await auth.deleteUser(TEST_USER_CONFIG.uid);
    log('✅ Test user deleted', 'green');
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      log('ℹ️  Test user does not exist', 'cyan');
    } else {
      log(`❌ Failed to delete test user: ${error.message}`, 'red');
    }
  }
}

// Create Firestore test data for user
async function createFirestoreTestData(uid = TEST_USER_CONFIG.uid) {
  const db = admin.firestore();

  try {
    // Create user document
    await db.collection('users').doc(uid).set({
      email: TEST_USER_CONFIG.email,
      displayName: TEST_USER_CONFIG.displayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      tier: 'free',
      subscriptionStatus: 'none',
      testAccount: true,
      razorpayCustomerId: `cust_test_${uid}`
    }, { merge: true });

    log('✅ Firestore test data created', 'green');
  } catch (error) {
    log(`❌ Failed to create Firestore data: ${error.message}`, 'red');
  }
}

// Save test credentials to file for other scripts
async function saveTestCredentials(customToken) {
  const credentials = {
    uid: TEST_USER_CONFIG.uid,
    email: TEST_USER_CONFIG.email,
    password: TEST_USER_CONFIG.password,
    customToken: customToken,
    createdAt: new Date().toISOString()
  };

  const credentialsPath = path.join(__dirname, '.test-credentials.json');

  try {
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    log(`✅ Test credentials saved to ${credentialsPath}`, 'green');
  } catch (error) {
    log(`⚠️  Failed to save credentials: ${error.message}`, 'yellow');
  }

  return credentials;
}

// Load saved test credentials
function loadTestCredentials() {
  const credentialsPath = path.join(__dirname, '.test-credentials.json');

  try {
    if (fs.existsSync(credentialsPath)) {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      return credentials;
    }
  } catch (error) {
    log(`⚠️  Failed to load credentials: ${error.message}`, 'yellow');
  }

  return null;
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'create';

  log('\n🔐 Firebase Test User Manager', 'bright');
  log('================================\n', 'bright');

  // Initialize Firebase Admin
  initializeAdmin();

  switch (command) {
    case 'create':
      // Create test user and generate token
      const user = await createOrGetTestUser();
      await createFirestoreTestData(user.uid);
      const token = await generateCustomToken(user.uid);
      const credentials = await saveTestCredentials(token);

      log('\n📋 Test User Credentials:', 'cyan');
      log(`   Email: ${credentials.email}`, 'blue');
      log(`   Password: ${credentials.password}`, 'blue');
      log(`   UID: ${credentials.uid}`, 'blue');
      log(`   Token: ${credentials.customToken.substring(0, 50)}...`, 'blue');

      log('\n💡 Usage:', 'cyan');
      log('   Use the custom token for API authentication in tests', 'yellow');
      log('   The token is saved in scripts/.test-credentials.json', 'yellow');
      break;

    case 'delete':
      // Delete test user
      await deleteTestUser();

      // Remove credentials file
      const credentialsPath = path.join(__dirname, '.test-credentials.json');
      if (fs.existsSync(credentialsPath)) {
        fs.unlinkSync(credentialsPath);
        log('✅ Credentials file removed', 'green');
      }
      break;

    case 'token':
      // Generate new token for existing user
      const existingUser = await createOrGetTestUser();
      const newToken = await generateCustomToken(existingUser.uid);
      await saveTestCredentials(newToken);

      log('\n📋 New Token Generated:', 'cyan');
      log(`   ${newToken.substring(0, 50)}...`, 'blue');
      break;

    case 'info':
      // Display saved credentials
      const saved = loadTestCredentials();
      if (saved) {
        log('\n📋 Saved Test Credentials:', 'cyan');
        log(`   Email: ${saved.email}`, 'blue');
        log(`   UID: ${saved.uid}`, 'blue');
        log(`   Created: ${saved.createdAt}`, 'blue');
        log(`   Token: ${saved.customToken.substring(0, 50)}...`, 'blue');
      } else {
        log('❌ No saved credentials found', 'red');
        log('   Run "npm run firebase:test-user create" first', 'yellow');
      }
      break;

    default:
      log('Usage:', 'cyan');
      log('  node firebase-test-user.js create  - Create test user and generate token', 'blue');
      log('  node firebase-test-user.js delete  - Delete test user', 'blue');
      log('  node firebase-test-user.js token   - Generate new token', 'blue');
      log('  node firebase-test-user.js info    - Show saved credentials', 'blue');
  }

  process.exit(0);
}

// Export functions for use in other scripts
module.exports = {
  initializeAdmin,
  createOrGetTestUser,
  generateCustomToken,
  loadTestCredentials,
  TEST_USER_CONFIG
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  });
}