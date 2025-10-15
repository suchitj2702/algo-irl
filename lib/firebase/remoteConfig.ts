import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getRemoteConfig,
  fetchAndActivate,
  getValue,
  type RemoteConfig,
} from 'firebase/remote-config';

/**
 * Feature Flags Structure
 * Managed via Firebase Remote Config
 */
export interface FeatureFlags {
  // Payment feature flags
  payments_enabled: boolean;
  razorpay_checkout_enabled: boolean;
  show_pricing_page: boolean;
  require_subscription: boolean;

  // Rollout controls
  payments_rollout_percentage: number; // 0-100
  payments_allowed_emails: string[]; // Whitelist specific users

  // Pricing configuration
  monthly_price_inr: number;
  monthly_price_usd: number;
  show_annual_plan: boolean;

  // Feature access
  max_free_study_plans: number;
  require_auth_for_study_plans: boolean;
}

// Singleton instances
let firebaseApp: FirebaseApp | null = null;
let remoteConfig: RemoteConfig | null = null;

/**
 * Initialize Firebase app for Remote Config
 * Uses client SDK (not Admin SDK - it doesn't support Remote Config)
 */
function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      firebaseApp = existingApps[0];
    } else {
      const config = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };

      // Validate required fields
      if (!config.projectId) {
        throw new Error('Firebase project ID is required for Remote Config');
      }

      firebaseApp = initializeApp(config);
    }
  }
  return firebaseApp;
}

/**
 * Get Remote Config instance
 */
function getRemoteConfigInstance(): RemoteConfig {
  if (!remoteConfig) {
    const app = getFirebaseApp();
    remoteConfig = getRemoteConfig(app);

    // Set config settings
    remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // 1 hour in production
    // For development, you can use shorter interval: 300000 (5 minutes)

    // Set default values (fallback if fetch fails)
    remoteConfig.defaultConfig = {
      payments_enabled: false,
      razorpay_checkout_enabled: false,
      show_pricing_page: false,
      require_subscription: false,
      payments_rollout_percentage: 0,
      payments_allowed_emails: JSON.stringify([]),
      monthly_price_inr: 799,
      monthly_price_usd: 9.99,
      show_annual_plan: false,
      max_free_study_plans: 1,
      require_auth_for_study_plans: false,
    };
  }
  return remoteConfig;
}

/**
 * Fetch and activate latest config from Firebase
 * Call this on server startup or periodically
 */
export async function refreshRemoteConfig(): Promise<boolean> {
  try {
    const config = getRemoteConfigInstance();
    const activated = await fetchAndActivate(config);
    console.log('[RemoteConfig] Config refreshed:', activated ? 'new config' : 'using cached');
    return activated;
  } catch (error) {
    console.error('[RemoteConfig] Failed to fetch config:', error);
    return false;
  }
}

/**
 * Get all feature flags
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const config = getRemoteConfigInstance();

    // Ensure we have the latest config
    await fetchAndActivate(config);

    // Parse allowed emails from JSON string
    let allowedEmails: string[] = [];
    try {
      const emailsValue = getValue(config, 'payments_allowed_emails').asString();
      allowedEmails = emailsValue ? JSON.parse(emailsValue) : [];
    } catch (e) {
      console.warn('[RemoteConfig] Failed to parse payments_allowed_emails:', e);
    }

    return {
      payments_enabled: getValue(config, 'payments_enabled').asBoolean(),
      razorpay_checkout_enabled: getValue(config, 'razorpay_checkout_enabled').asBoolean(),
      show_pricing_page: getValue(config, 'show_pricing_page').asBoolean(),
      require_subscription: getValue(config, 'require_subscription').asBoolean(),
      payments_rollout_percentage: getValue(config, 'payments_rollout_percentage').asNumber(),
      payments_allowed_emails: allowedEmails,
      monthly_price_inr: getValue(config, 'monthly_price_inr').asNumber(),
      monthly_price_usd: getValue(config, 'monthly_price_usd').asNumber(),
      show_annual_plan: getValue(config, 'show_annual_plan').asBoolean(),
      max_free_study_plans: getValue(config, 'max_free_study_plans').asNumber(),
      require_auth_for_study_plans: getValue(config, 'require_auth_for_study_plans').asBoolean(),
    };
  } catch (error) {
    console.error('[RemoteConfig] Failed to get feature flags:', error);
    // Return safe defaults
    return {
      payments_enabled: false,
      razorpay_checkout_enabled: false,
      show_pricing_page: false,
      require_subscription: false,
      payments_rollout_percentage: 0,
      payments_allowed_emails: [],
      monthly_price_inr: 799,
      monthly_price_usd: 9.99,
      show_annual_plan: false,
      max_free_study_plans: 1,
      require_auth_for_study_plans: false,
    };
  }
}

/**
 * Check if payments are enabled globally
 */
export async function isPaymentsEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.payments_enabled;
}

/**
 * Check if Razorpay checkout is enabled
 */
export async function isRazorpayCheckoutEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.razorpay_checkout_enabled;
}

/**
 * Check if user is in the rollout
 * Implements percentage-based and email whitelist rollout
 */
export async function isUserInRollout(uid: string, email?: string | null): Promise<boolean> {
  const flags = await getFeatureFlags();

  // If payments not enabled globally, no one is in rollout
  if (!flags.payments_enabled) {
    return false;
  }

  // Check email whitelist first (takes precedence)
  if (email && flags.payments_allowed_emails.includes(email)) {
    return true;
  }

  // Check rollout percentage
  if (flags.payments_rollout_percentage >= 100) {
    return true;
  }

  if (flags.payments_rollout_percentage <= 0) {
    return false;
  }

  // Use consistent hashing based on UID for deterministic rollout
  // This ensures the same user always gets the same result
  const hash = hashString(uid);
  const userPercentage = hash % 100;

  return userPercentage < flags.payments_rollout_percentage;
}

/**
 * Simple hash function for consistent user bucketing
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Check if subscription is required for premium features
 */
export async function isSubscriptionRequired(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.require_subscription;
}

/**
 * Get pricing configuration
 */
export async function getPricing(): Promise<{
  monthlyPriceINR: number;
  monthlyPriceUSD: number;
  showAnnualPlan: boolean;
}> {
  const flags = await getFeatureFlags();
  return {
    monthlyPriceINR: flags.monthly_price_inr,
    monthlyPriceUSD: flags.monthly_price_usd,
    showAnnualPlan: flags.show_annual_plan,
  };
}

/**
 * Get free tier limits
 */
export async function getFreeTierLimits(): Promise<{
  maxStudyPlans: number;
  requireAuthForStudyPlans: boolean;
}> {
  const flags = await getFeatureFlags();
  return {
    maxStudyPlans: flags.max_free_study_plans,
    requireAuthForStudyPlans: flags.require_auth_for_study_plans,
  };
}
