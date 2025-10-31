import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import {
  verifyWebhookSignature,
  upsertSubscriptionRecord,
  type RazorpaySubscription,
} from '@algo-irl/lib/razorpay/razorpayClient';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';

interface RazorpayWebhookEvent {
  id: string;
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    subscription?: {
      entity: RazorpaySubscription;
    };
    payment?: {
      entity: {
        id: string;
        entity: 'payment';
        amount: number;
        currency: string;
        status: string;
        order_id: string | null;
        invoice_id: string | null;
        subscription_id?: string | null;
        method: string;
        description?: string;
        captured: boolean;
        email?: string;
        contact?: string;
        customer_id?: string;
        notes: Record<string, string>;
        created_at: number;
      };
    };
  };
  created_at: number;
}

interface WebhookEventProcessingState {
  by: string;
  lockedAt: Timestamp;
}

interface StoredWebhookEventDoc {
  event: RazorpayWebhookEvent;
  receivedAt: Timestamp;
  lastReceivedAt?: Timestamp;
  processed: boolean;
  processedAt?: Timestamp;
  processing?: WebhookEventProcessingState;
  attemptCount?: number;
  lastError?: string;
  lastErrorAt?: Timestamp;
  lastProcessorId?: string;
}

const WEBHOOK_EVENTS_COLLECTION = 'webhook_events';
const PROCESSING_LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

async function claimWebhookEventProcessing(
  event: RazorpayWebhookEvent,
  processorId: string
): Promise<'claimed' | 'duplicate' | 'in_progress'> {
  const db = adminDb();
  const eventRef = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(event.id);
  const now = Timestamp.now();

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(eventRef);

    if (!snapshot.exists) {
      tx.set(eventRef, {
        event,
        receivedAt: now,
        lastReceivedAt: now,
        processed: false,
        attemptCount: 1,
        processing: {
          by: processorId,
          lockedAt: now,
        },
      });
      return 'claimed';
    }

    const data = snapshot.data() as StoredWebhookEventDoc;

    if (data.processed) {
      return 'duplicate';
    }

    if (data.processing) {
      const { lockedAt } = data.processing;
      if (
        lockedAt &&
        now.toMillis() - lockedAt.toMillis() < PROCESSING_LOCK_TTL_MS
      ) {
        return 'in_progress';
      }
    }

    tx.set(
      eventRef,
      {
        event,
        lastReceivedAt: now,
        processed: false,
        processing: {
          by: processorId,
          lockedAt: now,
        },
        attemptCount: FieldValue.increment(1),
      },
      { merge: true }
    );

    return 'claimed';
  });
}

async function markWebhookEventProcessed(
  eventId: string,
  processorId: string
): Promise<void> {
  const db = adminDb();
  const eventRef = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId);
  await eventRef.set(
    {
      processed: true,
      processedAt: Timestamp.now(),
      processing: FieldValue.delete(),
      lastError: FieldValue.delete(),
      lastErrorAt: FieldValue.delete(),
      lastProcessorId: processorId,
    },
    { merge: true }
  );
}

async function recordWebhookEventFailure(
  eventId: string,
  error: unknown,
  processorId: string
): Promise<void> {
  const db = adminDb();
  const eventRef = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId);

  await eventRef.set(
    {
      processing: FieldValue.delete(),
      lastError: serializeError(error),
      lastErrorAt: Timestamp.now(),
      lastProcessorId: processorId,
    },
    { merge: true }
  );
}

/**
 * Find Firebase UID from Razorpay customer ID
 */
async function findUidByCustomerId(customerId: string): Promise<string | null> {
  const db = adminDb();
  const usersSnapshot = await db
    .collection('users')
    .where('razorpayCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return null;
  }

  return usersSnapshot.docs[0].id;
}

/**
 * Find Firebase UID from subscription ID
 */
async function findUidBySubscriptionId(subscriptionId: string): Promise<string | null> {
  const db = adminDb();

  // Search across all customer subcollections for this subscription ID
  const customersSnapshot = await db.collection('customers').get();

  for (const customerDoc of customersSnapshot.docs) {
    const subscriptionDoc = await customerDoc.ref
      .collection('subscriptions')
      .doc(subscriptionId)
      .get();

    if (subscriptionDoc.exists) {
      return customerDoc.id; // This is the UID
    }
  }

  return null;
}

/**
 * Handle subscription.activated event
 */
async function handleSubscriptionActivated(
  subscription: RazorpaySubscription
): Promise<void> {
  const uid = await findUidByCustomerId(subscription.customer_id);

  if (!uid) {
    console.error(
      `[Razorpay Webhook] Cannot find user with Razorpay customer ID: ${subscription.customer_id}`
    );
    return;
  }

  await upsertSubscriptionRecord(uid, subscription);
  console.log(`[Razorpay Webhook] Subscription activated for user ${uid}: ${subscription.id}`);
}

/**
 * Handle subscription.charged event
 */
async function handleSubscriptionCharged(
  subscription: RazorpaySubscription
): Promise<void> {
  const uid = await findUidByCustomerId(subscription.customer_id);

  if (!uid) {
    console.error(
      `[Razorpay Webhook] Cannot find user with Razorpay customer ID: ${subscription.customer_id}`
    );
    return;
  }

  await upsertSubscriptionRecord(uid, subscription);
  console.log(`[Razorpay Webhook] Subscription charged for user ${uid}: ${subscription.id}`);
}

/**
 * Handle subscription.cancelled event
 */
async function handleSubscriptionCancelled(
  subscription: RazorpaySubscription
): Promise<void> {
  const uid = await findUidBySubscriptionId(subscription.id);

  if (!uid) {
    console.error(
      `[Razorpay Webhook] Cannot find user for subscription ID: ${subscription.id}`
    );
    return;
  }

  await upsertSubscriptionRecord(uid, subscription);
  console.log(`[Razorpay Webhook] Subscription cancelled for user ${uid}: ${subscription.id}`);
}

/**
 * Handle subscription.completed event
 */
async function handleSubscriptionCompleted(
  subscription: RazorpaySubscription
): Promise<void> {
  const uid = await findUidBySubscriptionId(subscription.id);

  if (!uid) {
    console.error(
      `[Razorpay Webhook] Cannot find user for subscription ID: ${subscription.id}`
    );
    return;
  }

  await upsertSubscriptionRecord(uid, subscription);
  console.log(`[Razorpay Webhook] Subscription completed for user ${uid}: ${subscription.id}`);
}

/**
 * Handle subscription.paused event
 */
async function handleSubscriptionPaused(
  subscription: RazorpaySubscription
): Promise<void> {
  const uid = await findUidBySubscriptionId(subscription.id);

  if (!uid) {
    console.error(
      `[Razorpay Webhook] Cannot find user for subscription ID: ${subscription.id}`
    );
    return;
  }

  await upsertSubscriptionRecord(uid, subscription);
  console.log(`[Razorpay Webhook] Subscription paused for user ${uid}: ${subscription.id}`);
}

/**
 * Handle subscription.resumed event
 */
async function handleSubscriptionResumed(
  subscription: RazorpaySubscription
): Promise<void> {
  const uid = await findUidBySubscriptionId(subscription.id);

  if (!uid) {
    console.error(
      `[Razorpay Webhook] Cannot find user for subscription ID: ${subscription.id}`
    );
    return;
  }

  await upsertSubscriptionRecord(uid, subscription);
  console.log(`[Razorpay Webhook] Subscription resumed for user ${uid}: ${subscription.id}`);
}

/**
 * Handle payment.authorized event
 */
async function handlePaymentAuthorized(payment: RazorpayWebhookEvent['payload']['payment']): Promise<void> {
  if (!payment) return;

  console.log(`[Razorpay Webhook] Payment authorized: ${payment.entity.id}`);

  // Optional: Store payment record if needed
  // This is useful for tracking payment history
  if (payment.entity.customer_id) {
    const uid = await findUidByCustomerId(payment.entity.customer_id);
    if (uid) {
      const db = adminDb();
      await db
        .collection('customers')
        .doc(uid)
        .collection('payments')
        .doc(payment.entity.id)
        .set({
          ...payment.entity,
          updatedAt: new Date(),
        }, { merge: true });
    }
  }
}

/**
 * Handle payment.captured event
 */
async function handlePaymentCaptured(payment: RazorpayWebhookEvent['payload']['payment']): Promise<void> {
  if (!payment) return;

  console.log(`[Razorpay Webhook] Payment captured: ${payment.entity.id}`);

  // Update payment record
  if (payment.entity.customer_id) {
    const uid = await findUidByCustomerId(payment.entity.customer_id);
    if (uid) {
      const db = adminDb();
      await db
        .collection('customers')
        .doc(uid)
        .collection('payments')
        .doc(payment.entity.id)
        .set({
          ...payment.entity,
          updatedAt: new Date(),
        }, { merge: true });
    }
  }
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(payment: RazorpayWebhookEvent['payload']['payment']): Promise<void> {
  if (!payment) return;

  console.log(`[Razorpay Webhook] Payment failed: ${payment.entity.id}`);

  // Update payment record
  if (payment.entity.customer_id) {
    const uid = await findUidByCustomerId(payment.entity.customer_id);
    if (uid) {
      const db = adminDb();
      await db
        .collection('customers')
        .doc(uid)
        .collection('payments')
        .doc(payment.entity.id)
        .set({
          ...payment.entity,
          updatedAt: new Date(),
        }, { merge: true });
    }
  }
}

/**
 * Main webhook handler
 */
export async function POST(request: NextRequest) {
  const processorId = randomUUID();
  let eventId: string | undefined;
  let claimed = false;
  let failureRecorded = false;

  try {
    // Get webhook secret from environment
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    const signature = request.headers.get('x-razorpay-signature');
    if (!signature) {
      console.error('[Razorpay Webhook] Missing x-razorpay-signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    const rawBody = await request.text();
    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      console.error('[Razorpay Webhook] Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse webhook event
    const event: RazorpayWebhookEvent = JSON.parse(rawBody);
    console.log(`[Razorpay Webhook] Received event: ${event.event}`);
    eventId = event.id;

    if (!eventId) {
      console.error('[Razorpay Webhook] Missing event id in payload');
      return NextResponse.json(
        { error: 'Missing event id' },
        { status: 400 }
      );
    }

    const claimStatus = await claimWebhookEventProcessing(event, processorId);

    if (claimStatus === 'duplicate') {
      console.log(`[Razorpay Webhook] Event ${eventId} already processed, skipping`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (claimStatus === 'in_progress') {
      console.log(
        `[Razorpay Webhook] Event ${eventId} processing already in progress, skipping duplicate`
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    claimed = true;

    // Handle different event types
    try {
      switch (event.event) {
        case 'subscription.activated':
          if (event.payload.subscription) {
            await handleSubscriptionActivated(event.payload.subscription.entity);
          }
          break;

        case 'subscription.charged':
          if (event.payload.subscription) {
            await handleSubscriptionCharged(event.payload.subscription.entity);
          }
          break;

        case 'subscription.cancelled':
          if (event.payload.subscription) {
            await handleSubscriptionCancelled(event.payload.subscription.entity);
          }
          break;

        case 'subscription.completed':
          if (event.payload.subscription) {
            await handleSubscriptionCompleted(event.payload.subscription.entity);
          }
          break;

        case 'subscription.paused':
          if (event.payload.subscription) {
            await handleSubscriptionPaused(event.payload.subscription.entity);
          }
          break;

        case 'subscription.resumed':
          if (event.payload.subscription) {
            await handleSubscriptionResumed(event.payload.subscription.entity);
          }
          break;

        case 'payment.authorized':
          await handlePaymentAuthorized(event.payload.payment);
          break;

        case 'payment.captured':
          await handlePaymentCaptured(event.payload.payment);
          break;

        case 'payment.failed':
          await handlePaymentFailed(event.payload.payment);
          break;

        default:
          console.log(`[Razorpay Webhook] Unhandled event type: ${event.event}`);
      }
    } catch (processingError) {
      try {
        await recordWebhookEventFailure(eventId, processingError, processorId);
        failureRecorded = true;
      } catch (recordError) {
        console.error('[Razorpay Webhook] Failed to record processing error:', recordError);
      }
      throw processingError;
    }

    await markWebhookEventProcessed(eventId, processorId);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Razorpay Webhook] Error processing webhook:', error);

    if (claimed && eventId && !failureRecorded) {
      try {
        await recordWebhookEventFailure(eventId, error, processorId);
      } catch (recordError) {
        console.error('[Razorpay Webhook] Failed to record webhook failure:', recordError);
      }
    }

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
