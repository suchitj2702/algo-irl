import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@algo-irl/lib/razorpay/razorpayClient';
import { randomUUID } from 'node:crypto';
import {
  type RazorpayWebhookEvent,
  claimWebhookEventProcessing,
  markWebhookEventProcessed,
  recordWebhookEventFailure,
  handleSubscriptionEvent,
  handlePaymentEvent,
} from '@algo-irl/lib/razorpay/webhookHandlers';

// Subscription events that look up by customer_id
const CUSTOMER_LOOKUP_EVENTS = new Set([
  'subscription.activated',
  'subscription.charged',
]);

// Subscription events that look up by subscription_id
const SUBSCRIPTION_LOOKUP_EVENTS = new Set([
  'subscription.cancelled',
  'subscription.completed',
  'subscription.paused',
  'subscription.resumed',
]);

const PAYMENT_EVENTS = new Set([
  'payment.authorized',
  'payment.captured',
  'payment.failed',
]);

export async function POST(request: NextRequest) {
  const processorId = randomUUID();
  let eventId: string | undefined;
  let claimed = false;
  let failureRecorded = false;

  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const signature = request.headers.get('x-razorpay-signature');
    if (!signature) {
      console.error('[Razorpay Webhook] Missing x-razorpay-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const rawBody = await request.text();
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('[Razorpay Webhook] Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event: RazorpayWebhookEvent = JSON.parse(rawBody);
    console.log(`[Razorpay Webhook] Received event: ${event.event}`);
    eventId = event.id;

    if (!eventId) {
      console.error('[Razorpay Webhook] Missing event id in payload');
      return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
    }

    const claimStatus = await claimWebhookEventProcessing(event, processorId);

    if (claimStatus === 'duplicate') {
      console.log(`[Razorpay Webhook] Event ${eventId} already processed, skipping`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (claimStatus === 'in_progress') {
      console.log(`[Razorpay Webhook] Event ${eventId} processing already in progress, skipping duplicate`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    claimed = true;

    try {
      const subscription = event.payload.subscription?.entity;
      const eventType = event.event;

      if (CUSTOMER_LOOKUP_EVENTS.has(eventType) && subscription) {
        await handleSubscriptionEvent(eventType, subscription, 'by_customer_id');
      } else if (SUBSCRIPTION_LOOKUP_EVENTS.has(eventType) && subscription) {
        await handleSubscriptionEvent(eventType, subscription, 'by_subscription_id');
      } else if (PAYMENT_EVENTS.has(eventType)) {
        await handlePaymentEvent(eventType, event.payload.payment?.entity);
      } else {
        console.log(`[Razorpay Webhook] Unhandled event type: ${eventType}`);
      }
    } catch (processingError) {
      try {
        await recordWebhookEventFailure(eventId, processingError, processorId);
        failureRecorded = true;
      } catch (recordError) {
        console.error('[Razorpay Webhook] Failed to record processing error:', recordError);
      }
      throw processingError;
    }

    await markWebhookEventProcessed(eventId, processorId);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Razorpay Webhook] Error processing webhook:', error);

    if (claimed && eventId && !failureRecorded) {
      try {
        await recordWebhookEventFailure(eventId, error, processorId);
      } catch (recordError) {
        console.error('[Razorpay Webhook] Failed to record webhook failure:', recordError);
      }
    }

    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
