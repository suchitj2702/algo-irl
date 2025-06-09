import { LRUCache } from 'lru-cache';

interface AbuseTracker {
  codeExecutions: number;
  companyCreations: number;
  problemGenerations: number;
  suspiciousActivities: number;
  firstSeen: number;
  lastSeen: number;
  blocked: boolean;
  blockedUntil?: number;
}

export class AbusePreventionService {
  private userTracking: LRUCache<string, AbuseTracker>;
  private blacklist: Set<string> = new Set();
  
  constructor() {
    this.userTracking = new LRUCache({
      max: 100000, // Track up to 100k unique users
      ttl: 24 * 60 * 60 * 1000, // 24 hour TTL
    });
  }
  
  async trackActivity(
    fingerprint: string,
    activityType: keyof Pick<AbuseTracker, 'codeExecutions' | 'companyCreations' | 'problemGenerations' | 'suspiciousActivities'>
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check blacklist first
    if (this.blacklist.has(fingerprint)) {
      return { allowed: false, reason: 'User has been permanently blocked' };
    }
    
    const now = Date.now();
    const tracker = this.userTracking.get(fingerprint) || {
      codeExecutions: 0,
      companyCreations: 0,
      problemGenerations: 0,
      suspiciousActivities: 0,
      firstSeen: now,
      lastSeen: now,
      blocked: false,
    };
    
    // Check if user is temporarily blocked
    if (tracker.blocked && tracker.blockedUntil && tracker.blockedUntil > now) {
      return { allowed: false, reason: `Temporarily blocked until ${new Date(tracker.blockedUntil).toISOString()}` };
    }
    
    // Update activity
    tracker[activityType]++;
    tracker.lastSeen = now;
    
    // Check for abuse patterns
    const hoursSinceFirstSeen = (now - tracker.firstSeen) / (1000 * 60 * 60);
    
    // Suspicious patterns that warrant blocking
    if (
      tracker.codeExecutions > 100 && hoursSinceFirstSeen < 1 || // 100+ executions in first hour
      tracker.companyCreations > 20 && hoursSinceFirstSeen < 24 || // 20+ companies in first day
      tracker.suspiciousActivities > 5 // Multiple suspicious activities
    ) {
      tracker.blocked = true;
      tracker.blockedUntil = now + (24 * 60 * 60 * 1000); // 24 hour block
      this.userTracking.set(fingerprint, tracker);
      
      // Log for manual review
      console.warn('Suspicious user blocked:', {
        fingerprint,
        tracker,
        reason: 'Abuse pattern detected'
      });
      
      return { allowed: false, reason: 'Suspicious activity detected. Access temporarily restricted.' };
    }
    
    this.userTracking.set(fingerprint, tracker);
    return { allowed: true };
  }
  
  reportSuspiciousActivity(fingerprint: string, reason: string): void {
    this.trackActivity(fingerprint, 'suspiciousActivities');
    console.warn('Suspicious activity reported:', { fingerprint, reason });
  }
  
  permanentlyBlock(fingerprint: string): void {
    this.blacklist.add(fingerprint);
  }
} 