import { NextRequest } from 'next/server';
import { requireUser } from '@algo-irl/lib/auth/verifyFirebaseToken';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import { verifyPaymentSignature } from '@algo-irl/lib/razorpay/razorpayClient';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { apiError, apiSuccess } from '@/lib/shared/apiResponse';

interface VerifyPaymentRequest {
  paymentId: string;
  subscriptionId: string;
  signature?: string;
}

function toMillis(value: unknown): number | null {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const db = adminDb();

    const body = (await request.json()) as Partial<VerifyPaymentRequest>;
    const paymentId = body?.paymentId;
    const subscriptionId = body?.subscriptionId;
    const signature = body?.signature;

    if (!paymentId || !subscriptionId) {
      return apiError(400, 'Payment ID and Subscription ID required');
    }

    if (signature) {
      const message = `${subscriptionId}|${paymentId}`;
      const isValidSignature = verifyPaymentSignature(message, signature);

      if (!isValidSignature) {
        console.error('[API][Billing][VerifyPayment] Invalid payment signature', {
          userId: user.uid,
          paymentId,
          subscriptionId,
        });

        return apiError(400, 'Invalid payment signature');
      }
    }

    const paymentDocRef = db
      .collection('customers')
      .doc(user.uid)
      .collection('payments')
      .doc(paymentId);

    const paymentDoc = await paymentDocRef.get();

    if (!paymentDoc.exists) {
      return apiSuccess({
        verified: false,
        status: 'pending',
        message: 'Payment is being processed',
      });
    }

    const paymentData = paymentDoc.data() ?? {};

    const subscriptionDocRef = db
      .collection('customers')
      .doc(user.uid)
      .collection('subscriptions')
      .doc(subscriptionId);

    const subscriptionDoc = await subscriptionDocRef.get();

    if (!subscriptionDoc.exists) {
      return apiSuccess({
        verified: false,
        status: 'pending',
        message: 'Subscription activation in progress',
      });
    }

    const subscriptionData = subscriptionDoc.data() ?? {};

    await db
      .collection('payment_intents')
      .doc(subscriptionId)
      .set(
        {
          status: 'completed',
          paymentId,
          completedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return apiSuccess({
      verified: true,
      status: 'success',
      subscription: {
        id: subscriptionId,
        status: subscriptionData.statusMapped ?? subscriptionData.status ?? null,
        planId: subscriptionData.planId ?? null,
        currentPeriodEnd: toMillis(subscriptionData.currentPeriodEnd),
      },
      payment: {
        id: paymentId,
        amount: paymentData.amount ?? null,
        currency: paymentData.currency ?? null,
        status: paymentData.status ?? null,
      },
    });
  } catch (error) {
    console.error('[API][Billing][VerifyPayment] Error:', error);
    return apiError(500, 'Failed to verify payment');
  }
}
