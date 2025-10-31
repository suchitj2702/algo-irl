import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import { checkRazorpayHealth } from '@algo-irl/lib/razorpay/razorpayClient';

interface HealthMetrics {
  recentWebhooks: number;
  failedWebhooks: number;
  avgProcessingTime: number;
  razorpayHealthy: boolean;
  firestoreHealthy: boolean;
}

function calculateHealthScore(metrics: HealthMetrics): number {
  let score = 100;

  if (!metrics.razorpayHealthy) {
    score -= 30;
  }
  if (!metrics.firestoreHealthy) {
    score -= 30;
  }
  if (metrics.failedWebhooks > 0) {
    score -= Math.min(20, metrics.failedWebhooks * 5);
  }
  if (metrics.avgProcessingTime > 5000) {
    score -= 10;
  }
  if (metrics.recentWebhooks === 0) {
    score -= 10;
  }

  return Math.max(0, score);
}

export async function GET(request: NextRequest) {
  const db = adminDb();

  try {
    const now = Date.now();
    const oneHourAgo = Timestamp.fromMillis(now - 60 * 60 * 1000);

    const eventsCollection = db.collection('webhook_events');

    const [recentWebhooksSnapshot, failedWebhooksSnapshot] = await Promise.all([
      eventsCollection.where('receivedAt', '>', oneHourAgo).get(),
      eventsCollection.where('processed', '==', false).where('receivedAt', '>', oneHourAgo).get(),
    ]);

    const processingTimes: number[] = [];
    recentWebhooksSnapshot.forEach((doc) => {
      const data = doc.data();
      const receivedAt = data.receivedAt;
      const processedAt = data.processedAt;

      if (receivedAt instanceof Timestamp && processedAt instanceof Timestamp) {
        processingTimes.push(processedAt.toMillis() - receivedAt.toMillis());
      }
    });

    const avgProcessingTime =
      processingTimes.length > 0
        ? processingTimes.reduce((total, current) => total + current, 0) / processingTimes.length
        : 0;

    const { healthy: razorpayHealthy, error: razorpayError } = await checkRazorpayHealth();
    if (!razorpayHealthy && razorpayError) {
      console.error('[Razorpay Webhook Health] Razorpay health check failed:', razorpayError);
    }

    let firestoreHealthy = false;
    try {
      await db
        .collection('health')
        .doc('check')
        .set(
          {
            timestamp: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      firestoreHealthy = true;
    } catch (firestoreError) {
      console.error('[Razorpay Webhook Health] Firestore health check failed:', firestoreError);
    }

    const metrics: HealthMetrics = {
      recentWebhooks: recentWebhooksSnapshot.size,
      failedWebhooks: failedWebhooksSnapshot.size,
      avgProcessingTime,
      razorpayHealthy,
      firestoreHealthy,
    };

    const healthScore = calculateHealthScore(metrics);
    const status = healthScore > 80 ? 'healthy' : healthScore > 50 ? 'degraded' : 'unhealthy';

    return NextResponse.json({
      status,
      healthScore,
      metrics: {
        webhooksLastHour: metrics.recentWebhooks,
        failedWebhooks: metrics.failedWebhooks,
        avgProcessingTimeMs: Math.round(metrics.avgProcessingTime),
        razorpayStatus: metrics.razorpayHealthy ? 'connected' : 'disconnected',
        firestoreStatus: metrics.firestoreHealthy ? 'connected' : 'disconnected',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Razorpay Webhook Health] Health check error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const db = adminDb();

  try {
    const thirtyDaysAgo = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const oldEventsSnapshot = await db
      .collection('webhook_events')
      .where('receivedAt', '<', thirtyDaysAgo)
      .limit(100)
      .get();

    if (oldEventsSnapshot.empty) {
      return NextResponse.json({
        deleted: 0,
        message: 'No old webhook events to delete',
      });
    }

    const batch = db.batch();
    oldEventsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return NextResponse.json({
      deleted: oldEventsSnapshot.size,
      message: `Deleted ${oldEventsSnapshot.size} old webhook events`,
    });
  } catch (error) {
    console.error('[Razorpay Webhook Health] Cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}
