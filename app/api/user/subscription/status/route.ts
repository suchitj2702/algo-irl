import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@algo-irl/lib/auth/verifyFirebaseToken';
import { getSubscriptionStatus } from '@algo-irl/lib/subscription/subscriptionService';

const CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=60',
};

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const status = await getSubscriptionStatus(user.uid);
    const { status: subscriptionStatus, currentPeriodEnd, cancelAt } = status;

    return NextResponse.json(
      {
        status: subscriptionStatus,
        currentPeriodEnd,
        cancelAt,
      },
      {
        headers: CACHE_HEADERS,
      }
    );
  } catch (error) {
    console.error('[API][SubscriptionStatus][GET] Failed to fetch subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
