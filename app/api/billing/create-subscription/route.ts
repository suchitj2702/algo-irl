import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@algo-irl/lib/auth/verifyFirebaseToken';
import {
  syncRazorpayCustomer,
  createRazorpaySubscription,
} from '@algo-irl/lib/razorpay/razorpayClient';
import { isPaymentsEnabled, isUserInRollout } from '@algo-irl/lib/firebase/remoteConfig';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

interface CreateSubscriptionRequest {
  planId: string;
  totalCount?: number;
  customerNotify?: 0 | 1;
  returnUrl?: string;
  metadata?: {
    source?: 'landing' | 'study-plan' | 'upgrade-modal';
    feature?: string;
    userId?: string;
    timestamp?: number;
  };
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
    const { planId, totalCount, customerNotify = 1 } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      );
    }

    const appUrlString = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrlString) {
      console.error('[API][Billing][CreateSubscription] Missing NEXT_PUBLIC_APP_URL environment variable');
      return NextResponse.json(
        { error: 'Payment configuration is invalid. Please contact support.' },
        { status: 500 }
      );
    }

    const appUrl = new URL(appUrlString);

    if (body.returnUrl) {
      try {
        const candidateUrl = new URL(body.returnUrl, appUrl);
        if (candidateUrl.origin !== appUrl.origin) {
          return NextResponse.json(
            { error: 'Invalid return URL' },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid return URL format' },
          { status: 400 }
        );
      }
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

    const db = adminDb();

    console.log('Subscription creation attempt:', {
      userId: user.uid,
      planId,
      source: body.metadata?.source,
      timestamp: new Date().toISOString(),
    });

    const recentAttempts = await db
      .collection('payment_intents')
      .where('userId', '==', user.uid)
      .where('createdAt', '>', new Date(Date.now() - 60_000))
      .get();

    if (recentAttempts.size >= 3) {
      return NextResponse.json(
        { error: 'Too many payment attempts. Please wait a minute.' },
        { status: 429 }
      );
    }

    // Create or get Razorpay customer
    const razorpayCustomerId = await syncRazorpayCustomer({
      uid: user.uid,
      email: user.email,
    });

    const subscriptionNotes = {
      firebase_uid: user.uid,
      user_email: user.email || '',
      return_url: body.returnUrl || '/my-study-plans',
      source: body.metadata?.source || 'unknown',
      feature: body.metadata?.feature,
      created_at: new Date().toISOString(),
    };

    // Create Razorpay subscription
    const subscription = await createRazorpaySubscription({
      customerId: razorpayCustomerId,
      planId,
      totalCount: totalCount ?? 120,
      customerNotify,
      notes: subscriptionNotes,
      notifyInfo: user.email
        ? {
            notify_email: user.email,
          }
        : undefined,
    });

    await db
      .collection('payment_intents')
      .doc(subscription.id)
      .set({
        subscriptionId: subscription.id,
        userId: user.uid,
        planId,
        status: 'pending',
        returnUrl: body.returnUrl ?? null,
        metadata: body.metadata ?? null,
        createdAt: FieldValue.serverTimestamp(),
        shortUrl: subscription.short_url ?? null,
      });

    return NextResponse.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      shortUrl: subscription.short_url,
      currentStart: subscription.current_start,
      currentEnd: subscription.current_end,
      planId: subscription.plan_id,
      returnUrl: body.returnUrl,
      callbackUrl: new URL(
        `/payment-status?subscription_id=${subscription.id}`,
        appUrl
      ).toString(),
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
