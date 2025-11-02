#!/usr/bin/env node

/**
 * Get Firebase ID Token from Custom Token
 *
 * This script exchanges a custom token for an ID token that can be used for API authentication
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Exchange custom token for ID token using Firebase Auth REST API
async function exchangeCustomTokenForIdToken(customToken) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY not found in environment');
  }

  try {
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
      {
        token: customToken,
        returnSecureToken: true
      }
    );

    return {
      idToken: response.data.idToken,
      refreshToken: response.data.refreshToken,
      expiresIn: response.data.expiresIn
    };
  } catch (error) {
    if (error.response) {
      throw new Error(`Firebase Auth Error: ${error.response.data.error.message}`);
    }
    throw error;
  }
}

// Get ID token using saved custom token
async function getIdToken() {
  const credentialsPath = path.join(__dirname, '.test-credentials.json');

  try {
    // Load saved credentials
    if (!fs.existsSync(credentialsPath)) {
      log('❌ Test credentials not found', 'red');
      log('   Run "npm run firebase:test-user create" first', 'yellow');
      return null;
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

    log('🔄 Exchanging custom token for ID token...', 'cyan');
    const tokenData = await exchangeCustomTokenForIdToken(credentials.customToken);

    // Save the ID token
    credentials.idToken = tokenData.idToken;
    credentials.refreshToken = tokenData.refreshToken;
    credentials.expiresIn = tokenData.expiresIn;
    credentials.tokenUpdatedAt = new Date().toISOString();

    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));

    log('✅ ID token obtained successfully', 'green');
    log(`   Token: ${tokenData.idToken.substring(0, 50)}...`, 'blue');
    log(`   Expires in: ${tokenData.expiresIn} seconds`, 'blue');

    return tokenData.idToken;
  } catch (error) {
    log(`❌ Failed to get ID token: ${error.message}`, 'red');
    return null;
  }
}

// Refresh ID token if expired
async function refreshIdToken(refreshToken) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  try {
    const response = await axios.post(
      `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }
    );

    return {
      idToken: response.data.id_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
}

// Get valid ID token (refresh if needed)
async function getValidIdToken() {
  const credentialsPath = path.join(__dirname, '.test-credentials.json');

  try {
    if (!fs.existsSync(credentialsPath)) {
      log('❌ Test credentials not found', 'red');
      return null;
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

    // Check if we have an ID token and if it's still valid
    if (credentials.idToken && credentials.tokenUpdatedAt) {
      const tokenAge = Date.now() - new Date(credentials.tokenUpdatedAt).getTime();
      const expiresIn = (credentials.expiresIn || 3600) * 1000; // Convert to ms

      if (tokenAge < expiresIn - 60000) { // Still valid (with 1 minute buffer)
        log('✅ Using existing valid ID token', 'green');
        return credentials.idToken;
      }

      // Token expired, try to refresh
      if (credentials.refreshToken) {
        log('🔄 Refreshing expired ID token...', 'cyan');
        const tokenData = await refreshIdToken(credentials.refreshToken);

        // Save the new token
        credentials.idToken = tokenData.idToken;
        credentials.refreshToken = tokenData.refreshToken;
        credentials.expiresIn = tokenData.expiresIn;
        credentials.tokenUpdatedAt = new Date().toISOString();

        fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));

        log('✅ Token refreshed successfully', 'green');
        return tokenData.idToken;
      }
    }

    // No valid token, get a new one
    return await getIdToken();
  } catch (error) {
    log(`❌ Error getting valid token: ${error.message}`, 'red');
    return null;
  }
}

// Export for use in other scripts
module.exports = {
  getIdToken,
  getValidIdToken,
  exchangeCustomTokenForIdToken
};

// Run if called directly
if (require.main === module) {
  getIdToken().then(token => {
    if (token) {
      log('\n💡 Use this ID token for API authentication', 'cyan');
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
}