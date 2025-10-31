jest.mock('@algo-irl/lib/firebase/firebaseAdmin');
jest.mock('firebase-admin/firestore');

import crypto from 'crypto';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/razorpay/webhook/route';
import { verifyWebhookSignature } from '@algo-irl/lib/razorpay/razorpayClient';
import { createMockFirestore } from '@/tests/utils/mockFirestore';

const firebaseAdminMock = jest.requireMock('@algo-irl/lib/firebase/firebaseAdmin') as {
  adminDb: jest.Mock;
  __setMockDb: (db: ReturnType<typeof createMockFirestore>) => void;
};

const { __resetFirestoreMocks } = jest.requireMock('firebase-admin/firestore') as {
  __resetFirestoreMocks: () => void;
};

function setAdminDb(db: ReturnType<typeof createMockFirestore>) {
  firebaseAdminMock.__setMockDb(db);
  firebaseAdminMock.adminDb.mockReturnValue(db);
}

function signedRequest(payload: unknown, secret: string): NextRequest {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  if (!verifyWebhookSignature(body, signature, secret)) {
    throw new Error('Failed to generate valid signature for payload');
  }
  return new NextRequest('http://localhost/api/razorpay/webhook', {
    method: 'POST',
    headers: {
      'x-razorpay-signature': signature,
      'content-type': 'application/json',
    },
    body,
  });
}

describe('POST /api/razorpay/webhook', () => {
  const webhookSecret = 'test_webhook_secret';

  beforeEach(() => {
    jest.clearAllMocks();
    __resetFirestoreMocks();
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
  });

  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  it('processes subscription.activated events and updates Firestore', async () => {
    const db = createMockFirestore({
      'users/user_test_123': {
        razorpayCustomerId: 'cust_123',
      },
    });
    setAdminDb(db);

    const event = {
      id: 'evt_subscription_activated',
      entity: 'event',
      account_id: 'acc_test',
      event: 'subscription.activated',
      contains: ['subscription'],
      payload: {
        subscription: {
          entity: {
            id: 'sub_123',
            customer_id: 'cust_123',
            status: 'active',
            plan_id: 'plan_monthly_study_plan_inr',
            current_end: 1702592000,
            current_start: 1700000000,
            notes: {},
          },
        },
      },
      created_at: 1700000100,
    };

    const request = signedRequest(event, webhookSecret);
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });

    const subscriptionDoc = db._store.get('customers/user_test_123/subscriptions/sub_123');
    expect(subscriptionDoc).toMatchObject({
      id: 'sub_123',
      customerId: 'cust_123',
      status: 'active',
      statusMapped: 'active',
      planId: 'plan_monthly_study_plan_inr',
    });

    const userDoc = db._store.get('users/user_test_123');
    expect(userDoc).toMatchObject({
      razorpayCustomerId: 'cust_123',
      subscriptionStatus: 'active',
      subscriptionTier: 'monthly',
    });

    const storedEvent = db._store.get('webhook_events/evt_subscription_activated');
    expect(storedEvent).toMatchObject({
      processed: true,
      lastProcessorId: expect.any(String),
    });
  });

  it('rejects requests with invalid signatures', async () => {
    const request = new NextRequest('http://localhost/api/razorpay/webhook', {
      method: 'POST',
      headers: {
        'x-razorpay-signature': 'invalid_signature',
      },
      body: JSON.stringify({
        id: 'evt_invalid',
        event: 'test',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid signature' });
  });

  it('handles duplicate events idempotently', async () => {
    const db = createMockFirestore({
      'users/user_test_123': {
        razorpayCustomerId: 'cust_123',
      },
    });
    setAdminDb(db);

    const event = {
      id: 'evt_duplicate',
      entity: 'event',
      account_id: 'acc_test',
      event: 'subscription.charged',
      contains: ['subscription'],
      payload: {
        subscription: {
          entity: {
            id: 'sub_123',
            customer_id: 'cust_123',
            status: 'active',
            plan_id: 'plan_monthly_study_plan_inr',
            current_end: 1702592000,
            current_start: 1700000000,
            notes: {},
          },
        },
      },
      created_at: 1700000200,
    };

    const request = signedRequest(event, webhookSecret);
    const firstResponse = await POST(request);
    expect(firstResponse.status).toBe(200);

    const duplicateResponse = await POST(signedRequest(event, webhookSecret));
    expect(duplicateResponse.status).toBe(200);
    await expect(duplicateResponse.json()).resolves.toEqual({ received: true });

    const eventDoc = db._store.get('webhook_events/evt_duplicate');
    expect(eventDoc).toMatchObject({ processed: true, attemptCount: 1 });
  });
});
