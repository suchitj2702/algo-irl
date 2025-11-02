import crypto from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';

type SecurityEventSeverity = 'low' | 'medium' | 'high';

interface SecurityEventPayload {
  type: string;
  data: Record<string, unknown>;
  timestamp: FieldValue | Timestamp;
  severity: SecurityEventSeverity;
}

interface ExpectedPlanAmount {
  amount: number;
  currency: string;
}

export class PaymentSecurityManager {
  private static instance: PaymentSecurityManager | null = null;

  private readonly expectedAmounts: Record<string, ExpectedPlanAmount> = {
    plan_monthly_study_plan_inr: { amount: 49_900, currency: 'INR' },
  };

  private constructor() {}

  static getInstance(): PaymentSecurityManager {
    if (!this.instance) {
      this.instance = new PaymentSecurityManager();
    }
    return this.instance;
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[PaymentSecurity] Webhook secret not configured');
      return false;
    }

    try {
      const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (error) {
      console.error('[PaymentSecurity] Failed to verify webhook signature', error);
      return false;
    }
  }

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error('[PaymentSecurity] Razorpay secret not configured');
      return false;
    }

    try {
      const text = `${orderId}|${paymentId}`;
      const expectedSignature = crypto.createHmac('sha256', secret).update(text).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (error) {
      console.error('[PaymentSecurity] Failed to verify payment signature', error);
      return false;
    }
  }

  encryptData(data: string): { encrypted: string; iv: string } {
    const algorithm = 'aes-256-gcm';
    const rawKey = process.env.ENCRYPTION_KEY;

    if (!rawKey) {
      throw new Error('[PaymentSecurity] ENCRYPTION_KEY is not configured');
    }

    const key = Buffer.from(rawKey, 'hex');
    if (key.length !== 32) {
      throw new Error('[PaymentSecurity] ENCRYPTION_KEY must be 256 bits (64 hex chars)');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encrypted: `${encrypted}:${authTag.toString('hex')}`,
      iv: iv.toString('hex'),
    };
  }

  decryptData(encryptedData: string, iv: string): string {
    const algorithm = 'aes-256-gcm';
    const rawKey = process.env.ENCRYPTION_KEY;

    if (!rawKey) {
      throw new Error('[PaymentSecurity] ENCRYPTION_KEY is not configured');
    }

    const key = Buffer.from(rawKey, 'hex');
    if (key.length !== 32) {
      throw new Error('[PaymentSecurity] ENCRYPTION_KEY must be 256 bits (64 hex chars)');
    }

    const [cipherText, authTagHex] = encryptedData.split(':');
    if (!cipherText || !authTagHex) {
      throw new Error('[PaymentSecurity] Invalid encrypted data format');
    }

    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(cipherText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async validatePaymentAmount(amount: number, currency: string, planId: string): Promise<boolean> {
    const expected = this.expectedAmounts[planId];

    if (!expected) {
      console.error('[PaymentSecurity] Unknown plan ID:', planId);
      await this.logSecurityEvent('unknown_plan_id', { planId });
      return false;
    }

    const variance = expected.amount * 0.01;
    const matchesCurrency = currency === expected.currency;
    const withinVariance = Math.abs(amount - expected.amount) <= variance;

    if (!matchesCurrency || !withinVariance) {
      console.error('[PaymentSecurity] Payment amount mismatch', {
        expected: expected.amount,
        received: amount,
        currency,
        planId,
      });

      await this.logSecurityEvent('payment_amount_mismatch', {
        expected: expected.amount,
        received: amount,
        currency,
        planId,
      });

      return false;
    }

    return true;
  }

  async detectSuspiciousActivity(userId: string): Promise<boolean> {
    const db = adminDb();
    const oneHourAgo = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);

    const paymentsSnapshot = await db
      .collection('customers')
      .doc(userId)
      .collection('payments')
      .where('createdAt', '>', oneHourAgo)
      .get();

    if (paymentsSnapshot.size > 10) {
      await this.logSecurityEvent('excessive_payment_attempts', {
        userId,
        attemptCount: paymentsSnapshot.size,
      });
      return true;
    }

    const subscriptionChangesSnapshot = await db
      .collection('audit_logs')
      .where('userId', '==', userId)
      .where('action', 'in', ['subscription.created', 'subscription.cancelled'])
      .where('timestamp', '>', oneHourAgo)
      .get();

    if (subscriptionChangesSnapshot.size > 3) {
      await this.logSecurityEvent('rapid_subscription_changes', {
        userId,
        changeCount: subscriptionChangesSnapshot.size,
      });
      return true;
    }

    return false;
  }

  sanitizePaymentInput<T extends Record<string, unknown>>(input: T): Partial<T> {
    const sanitized: Partial<T> = {};
    const allowedFields: Array<keyof T> = ['planId', 'returnUrl', 'metadata', 'customerNotify'] as Array<
      keyof T
    >;

    for (const field of allowedFields) {
      if (!(field in input)) {
        continue;
      }

      const value = input[field];
      if (typeof value === 'string') {
        sanitized[field] = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<[^>]+>/g, '').trim() as T[keyof T];
      } else {
        sanitized[field] = value;
      }
    }

    return sanitized;
  }

  private async logSecurityEvent(eventType: string, data: Record<string, unknown>): Promise<void> {
    try {
      const db = adminDb();
      const doc: SecurityEventPayload = {
        type: eventType,
        data,
        timestamp: FieldValue.serverTimestamp(),
        severity: this.getEventSeverity(eventType),
      };

      await db.collection('security_events').add(doc);

      if (doc.severity === 'high') {
        await this.alertOpsTeam(eventType, data);
      }
    } catch (error) {
      console.error('[PaymentSecurity] Failed to log security event', error);
    }
  }

  private getEventSeverity(eventType: string): SecurityEventSeverity {
    const highSeverityEvents = new Set([
      'payment_amount_mismatch',
      'excessive_payment_attempts',
      'invalid_webhook_signature',
    ]);

    const mediumSeverityEvents = new Set(['rapid_subscription_changes', 'rate_limit_exceeded']);

    if (highSeverityEvents.has(eventType)) {
      return 'high';
    }

    if (mediumSeverityEvents.has(eventType)) {
      return 'medium';
    }

    return 'low';
  }

  private async alertOpsTeam(eventType: string, data: Record<string, unknown>): Promise<void> {
    console.error(`[PaymentSecurity] SECURITY ALERT: ${eventType}`, data);
  }
}

export const paymentSecurity = PaymentSecurityManager.getInstance();
