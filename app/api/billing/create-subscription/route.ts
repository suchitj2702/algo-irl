import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@algo-irl/lib/auth/verifyFirebaseToken';
import {
  syncRazorpayCustomer,
  createRazorpaySubscription,
} from '@algo-irl/lib/razorpay/razorpayClient';
import { isPaymentsEnabled, isUserInRollout } from '@algo-irl/lib/firebase/remoteConfig';

interface CreateSubscriptionRequest {
  planId: string;
  totalCount?: number;
  customerNotify?: 0 | 1;
}

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const { user } = await requireUser(request);

    // Check if payments are enabled via Remote Config
    const paymentsEnabled = await isPaymentsEnabled();
    if (!paymentsEnabled) {
      return NextResponse.json(
        { error: 'Payments are currently disabled. Please try again later.' },
        { status: 503 } // Service Unavailable
      );
    }

    // Check if user is in the rollout (percentage-based or whitelist)
    const userInRollout = await isUserInRollout(user.uid, user.email);
    if (!userInRollout) {
      return NextResponse.json(
        { error: 'Payments are not available for your account yet. Please check back later.' },
        { status: 403 } // Forbidden
      );
    }

    // Parse request body
    const body: CreateSubscriptionRequest = await request.json();
    const { planId, totalCount = 0, customerNotify = 1 } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      );
    }

    // Validate plan ID against environment variables
    const validPlanIds = [
      process.env.RAZORPAY_PLAN_MONTHLY_INR,
      process.env.RAZORPAY_PLAN_MONTHLY_USD,
      process.env.RAZORPAY_PLAN_YEARLY_INR,
      process.env.RAZORPAY_PLAN_YEARLY_USD,
    ].filter(Boolean);

    if (!validPlanIds.includes(planId)) {
      return NextResponse.json(
        { error: 'Invalid planId' },
        { status: 400 }
      );
    }

    // Create or get Razorpay customer
    const customerId = await syncRazorpayCustomer({
      uid: user.uid,
      email: user.email,
    });

    // Create Razorpay subscription
    const subscription = await createRazorpaySubscription({
      customerId,
      planId,
      totalCount,
      customerNotify,
      notes: {
        firebaseUID: user.uid,
        email: user.email || '',
      },
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      shortUrl: subscription.short_url,
      currentStart: subscription.current_start,
      currentEnd: subscription.current_end,
      planId: subscription.plan_id,
    }, { status: 201 });

  } catch (error) {
    console.error('[API][Billing][CreateSubscription] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to create subscription';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
