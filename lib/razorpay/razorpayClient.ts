import Razorpay from 'razorpay';
import crypto from 'crypto';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// Razorpay Types
export interface RazorpayCustomer {
  id: string;
  entity: 'customer';
  name?: string;
  email?: string;
  contact?: string;
  gstin?: string | null;
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpaySubscription {
  id: string;
  entity: 'subscription';
  plan_id: string;
  customer_id: string;
  status: 'created' | 'authenticated' | 'active' | 'pending' | 'halted' | 'cancelled' | 'completed' | 'expired' | 'paused';
  current_start?: number | null;
  current_end?: number | null;
  ended_at?: number | null;
  quantity: number;
  notes: Record<string, string>;
  charge_at?: number | null;
  start_at?: number | null;
  end_at?: number | null;
  auth_attempts: number;
  total_count: number;
  paid_count: number;
  customer_notify: number;
  created_at: number;
  expire_by?: number | null;
  short_url?: string;
  has_scheduled_changes: boolean;
  change_scheduled_at?: number | null;
  source?: string;
  payment_method?: string;
  offer_id?: string | null;
  remaining_count?: number;
}

export interface RazorpayPlan {
  id: string;
  entity: 'plan';
  interval: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  item: {
    id: string;
    active: boolean;
    name: string;
    description?: string;
    amount: number;
    unit_amount?: number;
    currency: string;
    type: 'plan';
    unit?: string;
    tax_inclusive: boolean;
    hsn_code?: string;
    sac_code?: string;
    tax_rate?: number;
    tax_id?: string;
    tax_group_id?: string;
    created_at: number;
    updated_at: number;
  };
  notes: Record<string, string>;
  created_at: number;
}

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'none';

export interface SubscriptionStatusResult {
  status: SubscriptionStatus;
  currentPeriodEnd: number | null;
  cancelAt: number | null;
  tier: string | null;
}

// Singleton Razorpay instance
let razorpayInstance: Razorpay | null = null;

function getRazorpayClient(): Razorpay {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error(
        'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables are required'
      );
    }

    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayInstance;
}

export async function checkRazorpayHealth(): Promise<
  { healthy: true } | { healthy: false; error: unknown }
> {
  try {
    const razorpay = getRazorpayClient();
    await razorpay.plans.all({ count: 1 });
    return { healthy: true };
  } catch (error) {
    return { healthy: false, error };
  }
}

/**
 * Verify Razorpay webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[Razorpay] Webhook signature verification failed:', error);
    return false;
  }
}

/**
 * Verify a Razorpay payment signature using the configured key secret.
 */
export function verifyPaymentSignature(message: string, signature: string): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    console.error('[Razorpay] Missing RAZORPAY_KEY_SECRET for payment verification');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(message)
      .digest('hex');

    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch (error) {
    console.error('[Razorpay] Payment signature verification failed:', error);
    return false;
  }
}

/**
 * Create or get Razorpay customer for a Firebase user
 */
export async function syncRazorpayCustomer(params: {
  uid: string;
  email?: string | null;
  name?: string | null;
  contact?: string | null;
}): Promise<string> {
  const { uid, email, name, contact } = params;
  const db = adminDb();
  const userRef = db.collection('users').doc(uid);

  // Check if customer already exists
  const userSnapshot = await userRef.get();
  const existingCustomerId = userSnapshot.exists
    ? (userSnapshot.get('razorpayCustomerId') as string | undefined)
    : undefined;

  if (existingCustomerId) {
    return existingCustomerId;
  }

  // Create new Razorpay customer
  const razorpay = getRazorpayClient();
  const customer = await razorpay.customers.create({
    name: name || undefined,
    email: email || undefined,
    contact: contact || undefined,
    notes: {
      firebaseUID: uid,
    },
  });

  // Store customer ID in Firestore
  await userRef.set(
    {
      razorpayCustomerId: customer.id,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return customer.id;
}

/**
 * Create a Razorpay subscription
 */
export async function createRazorpaySubscription(params: {
  customerId: string;
  planId: string;
  totalCount?: number;
  customerNotify?: 0 | 1;
  notes?: Record<string, string | undefined | null>;
  notifyInfo?: {
    notify_email?: string;
    notify_phone?: string;
  };
}): Promise<RazorpaySubscription> {
  const {
    customerId,
    planId,
    totalCount = 0, // 0 means infinite
    customerNotify = 1,
    notes = {},
    notifyInfo,
  } = params;

  const sanitizedNotes = Object.entries(notes).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value !== undefined && value !== null) {
      acc[key] = String(value);
    }
    return acc;
  }, {});

  const razorpay = getRazorpayClient();

  const subscriptionPayload: Record<string, unknown> = {
    plan_id: planId,
    customer_id: customerId,
    total_count: totalCount,
    customer_notify: customerNotify,
    notes: sanitizedNotes,
  };

  if (notifyInfo) {
    subscriptionPayload.notify_info = notifyInfo;
  }

  const subscription = await razorpay.subscriptions.create(subscriptionPayload);

  return subscription as unknown as RazorpaySubscription;
}

/**
 * Cancel a Razorpay subscription
 */
export async function cancelRazorpaySubscription(
  subscriptionId: string,
  cancelAtCycleEnd: boolean = false
): Promise<RazorpaySubscription> {
  const razorpay = getRazorpayClient();

  const subscription = await razorpay.subscriptions.cancel(
    subscriptionId,
    cancelAtCycleEnd
  );

  return subscription as unknown as RazorpaySubscription;
}

/**
 * Fetch a Razorpay subscription by ID
 */
export async function fetchRazorpaySubscription(
  subscriptionId: string
): Promise<RazorpaySubscription> {
  const razorpay = getRazorpayClient();
  const subscription = await razorpay.subscriptions.fetch(subscriptionId);
  return subscription as unknown as RazorpaySubscription;
}

/**
 * Map Razorpay subscription status to our internal status
 */
function mapRazorpayStatus(
  status: RazorpaySubscription['status']
): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'authenticated':
      return 'active';
    case 'pending':
    case 'halted':
      return 'past_due';
    case 'cancelled':
    case 'completed':
    case 'expired':
      return 'canceled';
    case 'created':
    case 'paused':
    default:
      return 'none';
  }
}

/**
 * Convert Unix timestamp to Firestore Timestamp
 */
function toTimestamp(seconds?: number | null): Timestamp | null {
  if (!seconds || Number.isNaN(seconds)) {
    return null;
  }
  return Timestamp.fromMillis(seconds * 1000);
}

/**
 * Convert Firestore Timestamp to Unix seconds
 */
function toUnixSeconds(value: unknown): number | null {
  if (!value && value !== 0) {
    return null;
  }

  if (value instanceof Timestamp) {
    return Math.floor(value.toMillis() / 1000);
  }

  if (typeof value === 'number' && !Number.isNaN(value)) {
    // Handle millisecond timestamps if provided
    return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }

  return null;
}

/**
 * Derive tier name from plan ID
 */
function deriveTier(planId: string): string | null {
  // Extract tier from plan ID convention like "plan_monthly_study_plan_inr"
  if (planId.includes('monthly')) {
    return 'monthly';
  }
  if (planId.includes('yearly')) {
    return 'yearly';
  }
  return planId;
}

/**
 * Upsert subscription record to Firestore (called by webhook handler)
 */
export async function upsertSubscriptionRecord(
  uid: string,
  subscription: RazorpaySubscription
): Promise<SubscriptionStatusResult> {
  const db = adminDb();
  const subscriptionsCollection = db
    .collection('customers')
    .doc(uid)
    .collection('subscriptions');
  const docRef = subscriptionsCollection.doc(subscription.id);

  const tier = deriveTier(subscription.plan_id);
  const mappedStatus = mapRazorpayStatus(subscription.status);
  const currentPeriodEndTimestamp = toTimestamp(subscription.current_end);
  const cancelAtTimestamp = toTimestamp(subscription.ended_at);

  await docRef.set(
    {
      id: subscription.id,
      customerId: subscription.customer_id,
      status: subscription.status,
      statusMapped: mappedStatus,
      tier,
      planId: subscription.plan_id,
      currentPeriodEnd: currentPeriodEndTimestamp,
      cancelAt: cancelAtTimestamp,
      data: subscription,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  // Update user document with subscription status and tier
  const userRef = db.collection('users').doc(uid);

  // Compute tier: 'premium' if active, 'free' otherwise
  const userTier: 'free' | 'premium' = mappedStatus === 'active' ? 'premium' : 'free';

  const userUpdate: Record<string, unknown> = {
    tier: userTier, // ← NEW: 'free' | 'premium' for Firestore rules
    subscriptionStatus: mappedStatus,
    subscriptionTier: tier, // Plan name like "monthly"
    subscriptionCurrentPeriodEnd: currentPeriodEndTimestamp,
    subscriptionCancelAt: cancelAtTimestamp,
    razorpayCustomerId: subscription.customer_id,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await userRef.set(userUpdate, { merge: true });

  return {
    status: mappedStatus,
    currentPeriodEnd: toUnixSeconds(currentPeriodEndTimestamp),
    cancelAt: toUnixSeconds(cancelAtTimestamp),
    tier,
  };
}

/**
 * Compute subscription status from Firestore subscriptions collection
 */
async function computeStatusFromSubscriptions(
  uid: string
): Promise<SubscriptionStatusResult> {
  const db = adminDb();
  const subscriptionsSnapshot = await db
    .collection('customers')
    .doc(uid)
    .collection('subscriptions')
    .get();

  if (subscriptionsSnapshot.empty) {
    return {
      status: 'none',
      currentPeriodEnd: null,
      cancelAt: null,
      tier: null,
    };
  }

  const priority: Record<SubscriptionStatus, number> = {
    active: 3,
    past_due: 2,
    canceled: 1,
    none: 0,
  };

  let resolved: SubscriptionStatusResult = {
    status: 'none',
    currentPeriodEnd: null,
    cancelAt: null,
    tier: null,
  };

  subscriptionsSnapshot.forEach((doc) => {
    const data = doc.data();
    const candidateStatus = mapRazorpayStatus(
      (data.statusMapped ?? data.status) as RazorpaySubscription['status']
    );

    if (priority[candidateStatus] >= priority[resolved.status]) {
      resolved = {
        status: candidateStatus,
        currentPeriodEnd: toUnixSeconds(data.currentPeriodEnd),
        cancelAt: toUnixSeconds(data.cancelAt),
        tier: typeof data.tier === 'string' ? data.tier : resolved.tier,
      };
    }
  });

  return resolved;
}

/**
 * Get subscription status for a user
 */
export async function getSubscriptionStatus(
  uid: string
): Promise<SubscriptionStatusResult> {
  const db = adminDb();
  const userRef = db.collection('users').doc(uid);
  const userSnapshot = await userRef.get();

  if (userSnapshot.exists) {
    const data = userSnapshot.data() ?? {};
    const rawStatus = data.subscriptionStatus as RazorpaySubscription['status'] | undefined;
    const status = rawStatus ? mapRazorpayStatus(rawStatus) : 'none';
    const currentPeriodEnd = toUnixSeconds(data.subscriptionCurrentPeriodEnd);
    const cancelAt = toUnixSeconds(data.subscriptionCancelAt);
    const tier = typeof data.subscriptionTier === 'string' ? data.subscriptionTier : null;

    // If user doc has subscription info, return it
    if (status !== 'none' || currentPeriodEnd || cancelAt || tier) {
      return {
        status,
        currentPeriodEnd,
        cancelAt,
        tier,
      };
    }
  }

  // Fall back to computing from subscriptions collection
  return computeStatusFromSubscriptions(uid);
}
