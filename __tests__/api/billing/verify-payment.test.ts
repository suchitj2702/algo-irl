jest.mock('@algo-irl/lib/auth/verifyFirebaseToken', () => ({
  requireUser: jest.fn(),
}));

jest.mock('@algo-irl/lib/razorpay/razorpayClient', () => ({
  verifyPaymentSignature: jest.fn(),
}));

jest.mock('@algo-irl/lib/firebase/firebaseAdmin');
jest.mock('firebase-admin/firestore');

import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/billing/verify-payment/route';
import { createMockFirestore, MockTimestamp } from '@/tests/utils/mockFirestore';

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

const { verifyPaymentSignature } = jest.requireMock('@algo-irl/lib/razorpay/razorpayClient') as {
  verifyPaymentSignature: jest.Mock;
};

function setAdminDb(db: ReturnType<typeof createMockFirestore>) {
  firebaseAdminMock.__setMockDb(db);
  firebaseAdminMock.adminDb.mockReturnValue(db);
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: jest.fn(async () => body),
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe('POST /api/billing/verify-payment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetFirestoreMocks();

    requireUser.mockResolvedValue({
      user: {
        uid: 'user_test_123',
      },
    });
  });

  it('returns 400 when identifiers are missing', async () => {
    const request = makeRequest({});
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Payment ID and Subscription ID required');
  });

  it('returns 400 when payment signature is invalid', async () => {
    verifyPaymentSignature.mockReturnValue(false);

    const request = makeRequest({
      paymentId: 'pay_test',
      subscriptionId: 'sub_test',
      signature: 'invalid',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid payment signature');
    expect(verifyPaymentSignature).toHaveBeenCalledWith('sub_test|pay_test', 'invalid');
  });

  it('returns verification details when payment and subscription exist', async () => {
    const paymentSnapshot = {
      amount: 9900,
      currency: 'INR',
      status: 'captured',
    };

    const subscriptionSnapshot = {
      statusMapped: 'active',
      planId: 'plan_test_monthly_inr',
      currentPeriodEnd: MockTimestamp.fromMillis(1700000000000),
    };

    const db = createMockFirestore({
      'customers/user_test_123/payments/pay_test': paymentSnapshot,
      'customers/user_test_123/subscriptions/sub_test': subscriptionSnapshot,
    });

    setAdminDb(db);
    verifyPaymentSignature.mockReturnValue(true);

    const request = makeRequest({
      paymentId: 'pay_test',
      subscriptionId: 'sub_test',
      signature: 'valid',
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toMatchObject({
      verified: true,
      status: 'success',
      subscription: {
        id: 'sub_test',
        status: 'active',
        planId: 'plan_test_monthly_inr',
        currentPeriodEnd: 1700000000000,
      },
      payment: {
        id: 'pay_test',
        amount: 9900,
        currency: 'INR',
        status: 'captured',
      },
    });

    const intentDoc = db._store.get('payment_intents/sub_test');
    expect(intentDoc).toMatchObject({
      status: 'completed',
      paymentId: 'pay_test',
    });
  });
});
