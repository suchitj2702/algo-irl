jest.mock('razorpay', () => {
  const mockPlansAll = jest.fn();
  const mockSubscriptionsCreate = jest.fn();
  const mockSubscriptionsCancel = jest.fn();
  const mockSubscriptionsFetch = jest.fn();
  const mockCustomersCreate = jest.fn();

  const RazorpayMock = jest.fn(() => ({
    plans: { all: mockPlansAll },
    subscriptions: {
      create: mockSubscriptionsCreate,
      cancel: mockSubscriptionsCancel,
      fetch: mockSubscriptionsFetch,
    },
    customers: {
      create: mockCustomersCreate,
    },
  }));

  (RazorpayMock as unknown as { __mock: Record<string, jest.Mock> }).__mock = {
    mockPlansAll,
    mockSubscriptionsCreate,
    mockSubscriptionsCancel,
    mockSubscriptionsFetch,
    mockCustomersCreate,
  };

  return RazorpayMock;
});

jest.mock('@algo-irl/lib/firebase/firebaseAdmin');
jest.mock('firebase-admin/firestore');

import crypto from 'crypto';
import Razorpay from 'razorpay';

import {
  checkRazorpayHealth,
  verifyWebhookSignature,
  verifyPaymentSignature,
  syncRazorpayCustomer,
  createRazorpaySubscription,
  cancelRazorpaySubscription,
  fetchRazorpaySubscription,
  upsertSubscriptionRecord,
  getSubscriptionStatus,
  type RazorpaySubscription,
} from '@algo-irl/lib/razorpay/razorpayClient';
import responses from '@/tests/fixtures/razorpay-responses.json';
import webhookEvents from '@/tests/fixtures/webhook-events.json';
import {
  createMockFirestore,
  MockFieldValue,
  MockTimestamp,
} from '@/tests/utils/mockFirestore';

const firebaseAdminMock = jest.requireMock('@algo-irl/lib/firebase/firebaseAdmin') as {
  adminDb: jest.Mock;
  __setMockDb: (db: ReturnType<typeof createMockFirestore>) => void;
};

const { FieldValue, Timestamp, __resetFirestoreMocks } = jest.requireMock(
  'firebase-admin/firestore'
) as {
  FieldValue: typeof MockFieldValue;
  Timestamp: typeof MockTimestamp;
  __resetFirestoreMocks: () => void;
};

const razorpayMockHelpers = (Razorpay as unknown as { __mock: Record<string, jest.Mock> }).__mock;

function setAdminDb(db: ReturnType<typeof createMockFirestore>) {
  firebaseAdminMock.__setMockDb(db);
  firebaseAdminMock.adminDb.mockReturnValue(db);
}

describe('razorpayClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetFirestoreMocks();
    Object.values(razorpayMockHelpers).forEach((fn) => fn.mockReset());

    process.env.RAZORPAY_KEY_ID = 'test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';
  });

  afterAll(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  });

  it('verifies webhook signatures using HMAC SHA256', () => {
    const payload = JSON.stringify({ event: 'test' });
    const secret = 'webhook_secret';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
    expect(verifyWebhookSignature(payload, 'invalid_signature', secret)).toBe(false);

    consoleSpy.mockRestore();
  });

  it('verifies payment signatures when key secret is present', () => {
    const message = 'subscription_id|payment_id';
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
      .update(message)
      .digest('hex');

    expect(verifyPaymentSignature(message, signature)).toBe(true);
    expect(verifyPaymentSignature(message, 'invalid')).toBe(false);
  });

  it('returns false for payment signatures when key secret is missing', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.RAZORPAY_KEY_SECRET;

    expect(verifyPaymentSignature('subscription|payment', 'signature')).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Razorpay] Missing RAZORPAY_KEY_SECRET for payment verification'
    );

    consoleSpy.mockRestore();
  });

  it('reuses existing Razorpay customers stored in Firestore', async () => {
    const db = createMockFirestore({
      'users/user_existing': {
        razorpayCustomerId: 'cust_existing',
      },
    });
    setAdminDb(db);

    expect(firebaseAdminMock.adminDb()).toBe(db);

    const result = await syncRazorpayCustomer({
      uid: 'user_existing',
      email: 'existing@example.com',
    });

    expect(result).toBe('cust_existing');
    expect(razorpayMockHelpers.mockCustomersCreate).not.toHaveBeenCalled();
  });

  it('creates new Razorpay customers when absent in Firestore', async () => {
    const db = createMockFirestore();
    setAdminDb(db);

    razorpayMockHelpers.mockCustomersCreate.mockResolvedValue(responses.customer);

    const result = await syncRazorpayCustomer({
      uid: 'user_new',
      email: 'new@example.com',
      name: 'New User',
    });

    expect(result).toBe(responses.customer.id);
    expect(razorpayMockHelpers.mockCustomersCreate).toHaveBeenCalledWith({
      name: 'New User',
      email: 'new@example.com',
      contact: undefined,
      notes: {
        firebaseUID: 'user_new',
      },
    });
    expect(
      db._store.get('users/user_new')
    ).toMatchObject({ razorpayCustomerId: responses.customer.id });
  });

  it('creates Razorpay subscriptions with sanitized notes', async () => {
    razorpayMockHelpers.mockSubscriptionsCreate.mockResolvedValue(responses.subscription);

    const result = await createRazorpaySubscription({
      customerId: 'cust_test_123',
      planId: 'plan_test_monthly_inr',
      notes: {
        feature: 'study-plan',
        nullable: null,
        undefinedValue: undefined,
      },
      notifyInfo: {
        notify_email: 'test@example.com',
      },
    });

    expect(razorpayMockHelpers.mockSubscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: {
          feature: 'study-plan',
        },
        notify_info: {
          notify_email: 'test@example.com',
        },
      })
    );
    expect(result.id).toBe(responses.subscription.id);
  });

  it('cancels and fetches Razorpay subscriptions via SDK', async () => {
    razorpayMockHelpers.mockSubscriptionsCancel.mockResolvedValue(responses.subscription);
    razorpayMockHelpers.mockSubscriptionsFetch.mockResolvedValue(responses.subscription);

    const canceled = await cancelRazorpaySubscription('sub_test_123', true);
    const fetched = await fetchRazorpaySubscription('sub_test_123');

    expect(canceled.id).toBe(responses.subscription.id);
    expect(fetched.id).toBe(responses.subscription.id);
    expect(razorpayMockHelpers.mockSubscriptionsCancel).toHaveBeenCalledWith(
      'sub_test_123',
      true
    );
    expect(razorpayMockHelpers.mockSubscriptionsFetch).toHaveBeenCalledWith('sub_test_123');
  });

  it('upserts subscription records and updates user tier', async () => {
    const subscription = webhookEvents.subscriptionActivated.payload.subscription
      .entity as unknown as RazorpaySubscription;
    const db = createMockFirestore();
    setAdminDb(db);

    const result = await upsertSubscriptionRecord('user_test_123', subscription);

    expect(result).toEqual({
      status: 'active',
      currentPeriodEnd: subscription.current_end,
      cancelAt: subscription.ended_at,
      tier: 'monthly',
    });

    const subscriptionDoc =
      db._store.get(`customers/user_test_123/subscriptions/${subscription.id}`);
    expect(subscriptionDoc).toMatchObject({
      status: subscription.status,
      tier: 'monthly',
      statusMapped: 'active',
    });

    const userDoc = db._store.get('users/user_test_123');
    expect(userDoc).toMatchObject({
      tier: 'premium',
      subscriptionStatus: 'active',
      subscriptionTier: 'monthly',
    });
    expect(FieldValue.serverTimestamp).toHaveBeenCalled();
  });

  it('prefers user document subscription data when available', async () => {
    const db = createMockFirestore({
      'users/user_status': {
        subscriptionStatus: 'active',
        subscriptionCurrentPeriodEnd: 1699990000,
        subscriptionCancelAt: null,
        subscriptionTier: 'yearly',
      },
    });
    setAdminDb(db);

    const result = await getSubscriptionStatus('user_status');

    expect(result).toEqual({
      status: 'active',
      currentPeriodEnd: 1699990000,
      cancelAt: null,
      tier: 'yearly',
    });
  });

  it('derives subscription status from subcollection when user doc has no data', async () => {
    const currentPeriodEnd = MockTimestamp.fromMillis(1699990000 * 1000);
    const db = createMockFirestore({
      'customers/user_sub/subscriptions/sub_active': {
        statusMapped: 'active',
        currentPeriodEnd,
        cancelAt: null,
        tier: 'monthly',
      },
    });
    setAdminDb(db);

    const result = await getSubscriptionStatus('user_sub');

    expect(result.status).toBe('active');
    expect(result.tier).toBe('monthly');
  });

  it('reports healthy Razorpay connectivity', async () => {
    razorpayMockHelpers.mockPlansAll.mockResolvedValue({ items: [] });

    const result = await checkRazorpayHealth();

    expect(result).toEqual({ healthy: true });
    expect(razorpayMockHelpers.mockPlansAll).toHaveBeenCalledWith({ count: 1 });
  });

  it('captures Razorpay connectivity failures', async () => {
    const error = new Error('network failure');
    razorpayMockHelpers.mockPlansAll.mockRejectedValue(error);

    const result = await checkRazorpayHealth();

    expect(result).toEqual({ healthy: false, error });
  });
});
