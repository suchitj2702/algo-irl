import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@algo-irl/lib/auth/verifyFirebaseToken';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import { verifyPaymentSignature } from '@algo-irl/lib/razorpay/razorpayClient';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

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
      return NextResponse.json(
        { error: 'Payment ID and Subscription ID required' },
        { status: 400 }
      );
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

        return NextResponse.json(
          { error: 'Invalid payment signature' },
          { status: 400 }
        );
      }
    }

    const paymentDocRef = db
      .collection('customers')
      .doc(user.uid)
      .collection('payments')
      .doc(paymentId);

    const paymentDoc = await paymentDocRef.get();

    if (!paymentDoc.exists) {
      return NextResponse.json({
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
      return NextResponse.json({
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

    return NextResponse.json({
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

    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
