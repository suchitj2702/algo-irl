jest.mock('@algo-irl/lib/auth/verifyFirebaseToken', () => ({
  requireUser: jest.fn(),
}));

jest.mock('@algo-irl/lib/firebase/remoteConfig', () => ({
  isPaymentsEnabled: jest.fn(),
  isUserInRollout: jest.fn(),
}));

jest.mock('@algo-irl/lib/razorpay/razorpayClient', () => ({
  syncRazorpayCustomer: jest.fn(),
  createRazorpaySubscription: jest.fn(),
}));

jest.mock('@algo-irl/lib/firebase/firebaseAdmin');
jest.mock('firebase-admin/firestore');

import { NextRequest } from 'next/server';
import responses from '@/tests/fixtures/razorpay-responses.json';
import { POST } from '@/app/api/billing/create-subscription/route';
import { createMockFirestore } from '@/tests/utils/mockFirestore';

const firebaseAdminMock = jest.requireMock('@algo-irl/lib/firebase/firebaseAdmin') as {
  adminDb: jest.Mock;
  __setMockDb: (db: ReturnType<typeof createMockFirestore>) => void;
};

const { __resetFirestoreMocks } = jest.requireMock('firebase-admin/firestore') as {
  __resetFirestoreMocks: () => void;
};

const { requireUser } = jest.requireMock('@algo-irl/lib/auth/verifyFirebaseToken') as {
  requireUser: jest.Mock;
};

const {
  isPaymentsEnabled,
  isUserInRollout,
} = jest.requireMock('@algo-irl/lib/firebase/remoteConfig') as {
  isPaymentsEnabled: jest.Mock;
  isUserInRollout: jest.Mock;
};

const {
  syncRazorpayCustomer,
  createRazorpaySubscription,
} = jest.requireMock('@algo-irl/lib/razorpay/razorpayClient') as {
  syncRazorpayCustomer: jest.Mock;
  createRazorpaySubscription: jest.Mock;
};

function setAdminDb(db: ReturnType<typeof createMockFirestore>) {
  firebaseAdminMock.__setMockDb(db);
  firebaseAdminMock.adminDb.mockReturnValue(db);
}

describe('POST /api/billing/create-subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetFirestoreMocks();

    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
    process.env.RAZORPAY_PLAN_MONTHLY_INR = 'plan_test_monthly_inr';
    delete process.env.RAZORPAY_PLAN_MONTHLY_USD;
    delete process.env.RAZORPAY_PLAN_YEARLY_INR;
    delete process.env.RAZORPAY_PLAN_YEARLY_USD;

    requireUser.mockResolvedValue({
      user: {
        uid: 'user_test_123',
        email: 'test@example.com',
      },
    });

    isPaymentsEnabled.mockResolvedValue(true);
    isUserInRollout.mockResolvedValue(true);
  });

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.RAZORPAY_PLAN_MONTHLY_INR;
  });

  it('returns 400 when planId is missing', async () => {
    const request = new NextRequest('http://localhost/api/billing/create-subscription', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({}),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('planId is required');
  });

  it('returns 400 for invalid plan IDs', async () => {
    const request = new NextRequest('http://localhost/api/billing/create-subscription', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ planId: 'plan_invalid' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid planId');
  });

  it('creates a subscription and records payment intent', async () => {
    const db = createMockFirestore();
    setAdminDb(db);

    syncRazorpayCustomer.mockResolvedValue('cust_test_123');
    createRazorpaySubscription.mockResolvedValue(responses.subscription);

    const request = new NextRequest('http://localhost/api/billing/create-subscription', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        planId: 'plan_test_monthly_inr',
        returnUrl: '/return',
        metadata: {
          source: 'upgrade-modal',
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      subscriptionId: responses.subscription.id,
      status: responses.subscription.status,
      planId: responses.subscription.plan_id,
      callbackUrl: expect.stringContaining('payment-status'),
    });

    expect(syncRazorpayCustomer).toHaveBeenCalledWith({
      uid: 'user_test_123',
      email: 'test@example.com',
    });

    expect(createRazorpaySubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust_test_123',
        planId: 'plan_test_monthly_inr',
        customerNotify: 1,
        notes: expect.objectContaining({
          firebase_uid: 'user_test_123',
          source: 'upgrade-modal',
          return_url: '/return',
        }),
      })
    );

    const storedIntent = db._store.get(`payment_intents/${responses.subscription.id}`);
    expect(storedIntent).toMatchObject({
      subscriptionId: responses.subscription.id,
      userId: 'user_test_123',
      planId: 'plan_test_monthly_inr',
      status: 'pending',
    });
  });

  it('rejects unauthenticated requests', async () => {
    requireUser.mockRejectedValueOnce(new Error('Unauthorized'));

    const request = new NextRequest('http://localhost/api/billing/create-subscription', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ planId: 'plan_test_monthly_inr' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Unauthorized');
  });

  it('validates return URLs and rejects external redirects', async () => {
    const db = createMockFirestore();
    setAdminDb(db);

    const request = new NextRequest('http://localhost/api/billing/create-subscription', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        planId: 'plan_test_monthly_inr',
        returnUrl: 'https://malicious.example.com/steal',
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Invalid return URL');
  });
});
