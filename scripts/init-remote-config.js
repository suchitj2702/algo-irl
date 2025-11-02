/**
 * Initialize Firestore Remote Config Document
 *
 * This script creates the remote_config/payment_settings document
 * with default values for payment feature flags.
 *
 * Run with: node scripts/init-remote-config.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
function initializeAdmin() {
  // Try different credential methods
  try {
    // Method 1: Check for service account key file
    const serviceAccountPath = path.join(__dirname, '../service-account-key.json');
    if (require('fs').existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Initialized with service account key file');
      return;
    }
  } catch (error) {
    // Continue to next method
  }

  try {
    // Method 2: Use default credentials (Google Cloud environment)
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    console.log('✅ Initialized with application default credentials');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    console.log('\nPlease ensure one of the following:');
    console.log('1. You have a service-account-key.json file in the project root');
    console.log('2. GOOGLE_APPLICATION_CREDENTIALS environment variable is set');
    console.log('3. You are running in a Google Cloud environment');
    process.exit(1);
  }
}

async function initializeRemoteConfig() {
  const db = admin.firestore();

  const defaultConfig = {
    // Core payment flags
    paymentsEnabled: true,  // Enable for development testing
    razorpayCheckoutEnabled: true,  // Enable Razorpay
    requireSubscription: false,  // Don't require subscription initially

    // Rollout configuration
    paymentsRolloutPercentage: 100,  // Allow all users in dev
    paymentsAllowedEmails: [],  // Add specific emails if needed

    // Pricing
    monthlyPriceInr: 799,
    showAnnualPlan: false,

    // Free tier limits
    maxFreeStudyPlans: 3,
    requireAuthForStudyPlans: false,

    // Maintenance mode (disabled by default)
    maintenanceMode: false,
    maintenanceMessage: 'We are currently performing maintenance. Please try again later.',

    // Metadata
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'system-init'
  };

  try {
    // Check if document already exists
    const docRef = db.collection('remote_config').doc('payment_settings');
    const doc = await docRef.get();

    if (doc.exists) {
      console.log('⚠️  Document already exists. Current configuration:');
      console.log(JSON.stringify(doc.data(), null, 2));

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question('\nDo you want to overwrite it? (yes/no): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Cancelled. No changes made.');
        return;
      }
    }

    // Create or update the document
    await docRef.set(defaultConfig);
    console.log('✅ Successfully initialized remote_config/payment_settings');
    console.log('\nConfiguration set to:');
    console.log(JSON.stringify(defaultConfig, null, 2));

    // Also create experiments document if it doesn't exist
    const experimentsRef = db.collection('remote_config').doc('experiments');
    const experimentsDoc = await experimentsRef.get();

    if (!experimentsDoc.exists) {
      await experimentsRef.set({
        // Empty experiments map initially
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Created empty experiments document');
    }

  } catch (error) {
    console.error('❌ Failed to initialize remote config:', error);
    process.exit(1);
  }
}

// Run the initialization
async function main() {
  console.log('🚀 Initializing Firebase Remote Config in Firestore...\n');

  initializeAdmin();
  await initializeRemoteConfig();

  console.log('\n✨ Done! Your API routes should now work without indexedDB errors.');
  console.log('\nYou can modify the configuration by:');
  console.log('1. Updating the document directly in Firebase Console');
  console.log('2. Using the RemoteConfigService.updatePaymentFlags() method');
  console.log('3. Running this script again to reset to defaults');

  process.exit(0);
}

main().catch(console.error);