import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import {
  upsertSubscriptionRecord,
  type RazorpaySubscription,
} from '@algo-irl/lib/razorpay/razorpayClient';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export interface RazorpayWebhookEvent {
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
      entity: PaymentEntity;
    };
  };
  created_at: number;
}

export interface PaymentEntity {
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

export function serializeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export async function claimWebhookEventProcessing(
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
        processing: { by: processorId, lockedAt: now },
      });
      return 'claimed';
    }

    const data = snapshot.data() as StoredWebhookEventDoc;

    if (data.processed) return 'duplicate';

    if (data.processing) {
      const { lockedAt } = data.processing;
      if (lockedAt && now.toMillis() - lockedAt.toMillis() < PROCESSING_LOCK_TTL_MS) {
        return 'in_progress';
      }
    }

    tx.set(
      eventRef,
      {
        event,
        lastReceivedAt: now,
        processed: false,
        processing: { by: processorId, lockedAt: now },
        attemptCount: FieldValue.increment(1),
      },
      { merge: true }
    );

    return 'claimed';
  });
}

export async function markWebhookEventProcessed(
  eventId: string,
  processorId: string
): Promise<void> {
  const db = adminDb();
  await db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId).set(
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

export async function recordWebhookEventFailure(
  eventId: string,
  error: unknown,
  processorId: string
): Promise<void> {
  const db = adminDb();
  await db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId).set(
    {
      processing: FieldValue.delete(),
      lastError: serializeError(error),
      lastErrorAt: Timestamp.now(),
      lastProcessorId: processorId,
    },
    { merge: true }
  );
}

async function findUidByCustomerId(customerId: string): Promise<string | null> {
  const db = adminDb();
  const usersSnapshot = await db
    .collection('users')
    .where('razorpayCustomerId', '==', customerId)
    .limit(1)
    .get();

  return usersSnapshot.empty ? null : usersSnapshot.docs[0].id;
}

async function findUidBySubscriptionId(subscriptionId: string): Promise<string | null> {
  const db = adminDb();
  const customersSnapshot = await db.collection('customers').get();

  for (const customerDoc of customersSnapshot.docs) {
    const subscriptionDoc = await customerDoc.ref
      .collection('subscriptions')
      .doc(subscriptionId)
      .get();

    if (subscriptionDoc.exists) return customerDoc.id;
  }

  return null;
}

export async function handleSubscriptionEvent(
  eventName: string,
  subscription: RazorpaySubscription,
  lookup: 'by_customer_id' | 'by_subscription_id'
): Promise<void> {
  const uid = lookup === 'by_customer_id'
    ? await findUidByCustomerId(subscription.customer_id)
    : await findUidBySubscriptionId(subscription.id);

  if (!uid) {
    const identifier = lookup === 'by_customer_id'
      ? `Razorpay customer ID: ${subscription.customer_id}`
      : `subscription ID: ${subscription.id}`;
    console.error(`[Razorpay Webhook] Cannot find user with ${identifier}`);
    return;
  }

  await upsertSubscriptionRecord(uid, subscription);
  console.log(`[Razorpay Webhook] ${eventName} for user ${uid}: ${subscription.id}`);
}

export async function handlePaymentEvent(
  eventName: string,
  payment: PaymentEntity | undefined
): Promise<void> {
  if (!payment) return;

  console.log(`[Razorpay Webhook] ${eventName}: ${payment.id}`);

  if (payment.customer_id) {
    const uid = await findUidByCustomerId(payment.customer_id);
    if (uid) {
      const db = adminDb();
      await db
        .collection('customers')
        .doc(uid)
        .collection('payments')
        .doc(payment.id)
        .set({ ...payment, updatedAt: new Date() }, { merge: true });
    }
  }
}
