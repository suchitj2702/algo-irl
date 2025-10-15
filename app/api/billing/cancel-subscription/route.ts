import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@algo-irl/lib/auth/verifyFirebaseToken';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import { cancelRazorpaySubscription } from '@algo-irl/lib/razorpay/razorpayClient';
import { isPaymentsEnabled } from '@algo-irl/lib/firebase/remoteConfig';

interface CancelSubscriptionRequest {
  subscriptionId: string;
  cancelAtCycleEnd?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const { user } = await requireUser(request);

    // Check if payments are enabled via Remote Config
    const paymentsEnabled = await isPaymentsEnabled();
    if (!paymentsEnabled) {
      return NextResponse.json(
        { error: 'Payment operations are currently disabled. Please try again later.' },
        { status: 503 } // Service Unavailable
      );
    }

    // Parse request body
    const body: CancelSubscriptionRequest = await request.json();
    const { subscriptionId, cancelAtCycleEnd = false } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'subscriptionId is required' },
        { status: 400 }
      );
    }

    // Verify that the subscription belongs to this user
    const db = adminDb();
    const subscriptionDoc = await db
      .collection('customers')
      .doc(user.uid)
      .collection('subscriptions')
      .doc(subscriptionId)
      .get();

    if (!subscriptionDoc.exists) {
      return NextResponse.json(
        { error: 'Subscription not found or does not belong to this user' },
        { status: 404 }
      );
    }

    // Cancel the subscription in Razorpay
    const cancelledSubscription = await cancelRazorpaySubscription(
      subscriptionId,
      cancelAtCycleEnd
    );

    // Update local record (webhook will also update this, but we do it immediately for consistency)
    await subscriptionDoc.ref.set(
      {
        status: cancelledSubscription.status,
        statusMapped: 'canceled',
        ended_at: cancelledSubscription.ended_at,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({
      subscriptionId: cancelledSubscription.id,
      status: cancelledSubscription.status,
      endedAt: cancelledSubscription.ended_at,
      message: cancelAtCycleEnd
        ? 'Subscription will be cancelled at the end of the current billing cycle'
        : 'Subscription cancelled immediately',
    }, { status: 200 });

  } catch (error) {
    console.error('[API][Billing][CancelSubscription] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to cancel subscription';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
