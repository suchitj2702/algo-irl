import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { adminDb, adminApp } from '@algo-irl/lib/firebase/firebaseAdmin';

interface PaymentFeatureFlags {
  paymentsEnabled: boolean;
  razorpayCheckoutEnabled: boolean;
  requireSubscription: boolean;
  paymentsRolloutPercentage: number;
  paymentsAllowedEmails: string[];
  monthlyPriceInr: number;
  showAnnualPlan: boolean;
  maxFreeStudyPlans: number;
  requireAuthForStudyPlans: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

interface ExperimentVariant {
  name: string;
  percentage: number;
}

interface ExperimentConfig {
  enabled: boolean;
  variants: ExperimentVariant[];
}

type ExperimentsMap = Record<string, ExperimentConfig>;

interface CachedValue<T> {
  value: T;
  expiry: number;
}

export class RemoteConfigService {
  private static instance: RemoteConfigService | null = null;
  private readonly cache = new Map<string, CachedValue<unknown>>();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private constructor() {}

  static getInstance(): RemoteConfigService {
    if (!this.instance) {
      this.instance = new RemoteConfigService();
    }
    return this.instance;
  }

  async getPaymentFlags(): Promise<PaymentFeatureFlags> {
    const cacheKey = 'payment_flags';
    const cached = this.getFromCache<PaymentFeatureFlags>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const db = adminDb();
      const doc = await db.collection('remote_config').doc('payment_settings').get();
      const data = doc.exists ? (doc.data() as PaymentFeatureFlags) : this.getDefaultFlags();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('[RemoteConfigService] Failed to fetch payment flags:', error);
      return this.getDefaultFlags();
    }
  }

  async updatePaymentFlags(
    flags: Partial<PaymentFeatureFlags>,
    adminId: string
  ): Promise<void> {
    if (!(await this.validateAdminUser(adminId))) {
      throw new Error('Unauthorized: Admin access required');
    }

    await this.logConfigChange(adminId, flags);

    const db = adminDb();
    await db
      .collection('remote_config')
      .doc('payment_settings')
      .set(
        {
          ...flags,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: adminId,
        },
        { merge: true }
      );

    this.clearCache('payment_flags');
    await this.notifyConfigUpdate();
  }

  async isUserInRollout(userId: string, email?: string): Promise<boolean> {
    const flags = await this.getPaymentFlags();

    if (!flags.paymentsEnabled) {
      return false;
    }

    if (email && flags.paymentsAllowedEmails.includes(email)) {
      return true;
    }

    if (flags.paymentsRolloutPercentage <= 0) {
      return false;
    }

    if (flags.paymentsRolloutPercentage >= 100) {
      return true;
    }

    return this.getUserBucket(userId) < flags.paymentsRolloutPercentage;
  }

  async getUserConfig(userId: string, email?: string): Promise<Record<string, unknown>> {
    const flags = await this.getPaymentFlags();
    const inRollout = await this.isUserInRollout(userId, email);

    return {
      paymentsEnabled: flags.paymentsEnabled && inRollout,
      razorpayCheckoutEnabled: flags.razorpayCheckoutEnabled && inRollout,
      requireSubscription: flags.requireSubscription,
      monthlyPriceInr: flags.monthlyPriceInr,
      showAnnualPlan: flags.showAnnualPlan,
      maxFreeStudyPlans: flags.maxFreeStudyPlans,
      requireAuthForStudyPlans: flags.requireAuthForStudyPlans,
      maintenanceMode: flags.maintenanceMode,
      maintenanceMessage: flags.maintenanceMessage,
    };
  }

  async getExperimentVariant(userId: string, experimentId: string): Promise<string> {
    const experiments = await this.getExperiments();
    const experiment = experiments[experimentId];

    if (!experiment || !experiment.enabled || experiment.variants.length === 0) {
      return 'control';
    }

    const bucket = this.getUserBucket(`${userId}:${experimentId}`);
    let cumulative = 0;

    for (const variant of experiment.variants) {
      cumulative += variant.percentage;
      if (bucket < cumulative) {
        return variant.name;
      }
    }

    return 'control';
  }

  private async getExperiments(): Promise<ExperimentsMap> {
    const cacheKey = 'experiments';
    const cached = this.getFromCache<ExperimentsMap>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const db = adminDb();
      const doc = await db.collection('remote_config').doc('experiments').get();
      const data = doc.exists ? (doc.data() as ExperimentsMap) : {};
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('[RemoteConfigService] Failed to fetch experiments:', error);
      return {};
    }
  }

  private getUserBucket(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 100;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }
    return cached.value as T;
  }

  private setCache<T>(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.CACHE_TTL,
    });
  }

  private clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  private getDefaultFlags(): PaymentFeatureFlags {
    return {
      paymentsEnabled: false,
      razorpayCheckoutEnabled: false,
      requireSubscription: false,
      paymentsRolloutPercentage: 0,
      paymentsAllowedEmails: [],
      monthlyPriceInr: 499,
      showAnnualPlan: false,
      maxFreeStudyPlans: 3,
      requireAuthForStudyPlans: false,
      maintenanceMode: false,
      maintenanceMessage: 'We are currently performing maintenance. Please try again later.',
    };
  }

  private async validateAdminUser(userId: string): Promise<boolean> {
    try {
      const auth = getAuth(adminApp());
      const user = await auth.getUser(userId);
      return user.customClaims?.admin === true;
    } catch (error) {
      console.error('[RemoteConfigService] Failed to validate admin user:', error);
      return false;
    }
  }

  private async logConfigChange(adminId: string, changes: Partial<PaymentFeatureFlags>): Promise<void> {
    try {
      const db = adminDb();
      await db.collection('audit_logs').add({
        type: 'remote_config_change',
        adminId,
        changes,
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('[RemoteConfigService] Failed to log config change:', error);
    }
  }

  private async notifyConfigUpdate(): Promise<void> {
    console.log('[RemoteConfigService] Config updated. Clients refresh on next request.');
  }
}

export const remoteConfig = RemoteConfigService.getInstance();
