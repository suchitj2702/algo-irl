import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import {
  verifyWebhookSignature,
  upsertSubscriptionRecord,
  type RazorpaySubscription,
} from '@algo-irl/lib/razorpay/razorpayClient';

interface RazorpayWebhookEvent {
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

    // Handle different event types
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

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Razorpay Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
