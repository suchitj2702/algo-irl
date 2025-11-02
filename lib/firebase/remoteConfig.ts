/**
 * Remote Config Wrapper for Server-Side Usage
 *
 * This module provides a backward-compatible API that wraps RemoteConfigService
 * for use in Next.js API routes and other server-side code.
 *
 * Previously, this file used Firebase Client SDK which caused "indexedDB is not defined"
 * errors in server environments. Now it uses the server-safe RemoteConfigService
 * that stores configuration in Firestore via Admin SDK.
 */

import { RemoteConfigService } from './remoteConfigService';

/**
 * Feature Flags Structure
 * Managed via Firestore (remote_config/payment_settings document)
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

  // Feature access
  max_free_study_plans: number;
  require_auth_for_study_plans: boolean;
}

// Get singleton instance of RemoteConfigService
const configService = RemoteConfigService.getInstance();

/**
 * Fetch and activate latest config from Firestore
 * This clears the cache and forces a fresh fetch
 */
export async function refreshRemoteConfig(): Promise<boolean> {
  try {
    // Clear cache to force refresh
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (configService as any).clearCache();
    await configService.getPaymentFlags();
    console.log('[RemoteConfig] Config refreshed from Firestore');
    return true;
  } catch (error) {
    console.error('[RemoteConfig] Failed to refresh config:', error);
    return false;
  }
}

/**
 * Get all feature flags
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const flags = await configService.getPaymentFlags();

    // Map from RemoteConfigService format to our FeatureFlags format
    // Note: RemoteConfigService uses camelCase, we use snake_case for backward compatibility
    return {
      payments_enabled: flags.paymentsEnabled,
      razorpay_checkout_enabled: flags.razorpayCheckoutEnabled,
      show_pricing_page: flags.paymentsEnabled, // Derive from paymentsEnabled
      require_subscription: flags.requireSubscription,
      payments_rollout_percentage: flags.paymentsRolloutPercentage,
      payments_allowed_emails: flags.paymentsAllowedEmails,
      monthly_price_inr: flags.monthlyPriceInr,
      monthly_price_usd: flags.monthlyPriceInr / 80, // Convert from INR (approximate)
      max_free_study_plans: flags.maxFreeStudyPlans,
      require_auth_for_study_plans: flags.requireAuthForStudyPlans,
    };
  } catch (error) {
    console.error('[RemoteConfig] Failed to get feature flags:', error);
    // Return safe defaults - check environment variables for server-side usage
    return {
      payments_enabled: process.env.FEATURE_PAYMENTS_ENABLED === 'true' || false,
      razorpay_checkout_enabled: process.env.FEATURE_PAYMENTS_ENABLED === 'true' || false,
      show_pricing_page: false,
      require_subscription: process.env.FEATURE_REQUIRE_SUBSCRIPTION === 'true' || false,
      payments_rollout_percentage: 100, // Allow all users in test mode
      payments_allowed_emails: [],
      monthly_price_inr: 799,
      monthly_price_usd: 9.99,
      max_free_study_plans: 1,
      require_auth_for_study_plans: false,
    };
  }
}

/**
 * Check if payments are enabled globally
 */
export async function isPaymentsEnabled(): Promise<boolean> {
  try {
    const flags = await configService.getPaymentFlags();
    return flags.paymentsEnabled;
  } catch (error) {
    console.error('[RemoteConfig] Failed to check payments enabled:', error);
    return process.env.FEATURE_PAYMENTS_ENABLED === 'true' || false;
  }
}

/**
 * Check if Razorpay checkout is enabled
 */
export async function isRazorpayCheckoutEnabled(): Promise<boolean> {
  try {
    const flags = await configService.getPaymentFlags();
    return flags.razorpayCheckoutEnabled;
  } catch (error) {
    console.error('[RemoteConfig] Failed to check Razorpay enabled:', error);
    return process.env.FEATURE_PAYMENTS_ENABLED === 'true' || false;
  }
}

/**
 * Check if user is in the rollout
 * Implements percentage-based and email whitelist rollout
 */
export async function isUserInRollout(uid: string, email?: string | null): Promise<boolean> {
  try {
    return await configService.isUserInRollout(uid, email || undefined);
  } catch (error) {
    console.error('[RemoteConfig] Failed to check user rollout:', error);
    // In case of error, check environment variable
    if (process.env.FEATURE_PAYMENTS_ENABLED === 'true') {
      return true; // Enable for all in development/test
    }
    return false;
  }
}

/**
 * Check if subscription is required for premium features
 */
export async function isSubscriptionRequired(): Promise<boolean> {
  try {
    const flags = await configService.getPaymentFlags();
    return flags.requireSubscription;
  } catch (error) {
    console.error('[RemoteConfig] Failed to check subscription required:', error);
    return process.env.FEATURE_REQUIRE_SUBSCRIPTION === 'true' || false;
  }
}

/**
 * Get pricing configuration
 */
export async function getPricing(): Promise<{
  monthlyPriceINR: number;
  monthlyPriceUSD: number;
}> {
  try {
    const flags = await configService.getPaymentFlags();
    return {
      monthlyPriceINR: flags.monthlyPriceInr,
      monthlyPriceUSD: flags.monthlyPriceInr / 80, // Convert from INR (approximate)
    };
  } catch (error) {
    console.error('[RemoteConfig] Failed to get pricing:', error);
    return {
      monthlyPriceINR: 799,
      monthlyPriceUSD: 9.99,
    };
  }
}

/**
 * Get free tier limits
 */
export async function getFreeTierLimits(): Promise<{
  maxStudyPlans: number;
  requireAuthForStudyPlans: boolean;
}> {
  try {
    const flags = await configService.getPaymentFlags();
    return {
      maxStudyPlans: flags.maxFreeStudyPlans,
      requireAuthForStudyPlans: flags.requireAuthForStudyPlans,
    };
  } catch (error) {
    console.error('[RemoteConfig] Failed to get free tier limits:', error);
    return {
      maxStudyPlans: 1,
      requireAuthForStudyPlans: false,
    };
  }
}