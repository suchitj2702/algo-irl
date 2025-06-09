interface SecurityEvent {
  type: 'rate_limit' | 'suspicious_code' | 'abuse_pattern' | 'honeypot_triggered' | 'invalid_signature';
  fingerprint: string;
  details: Record<string, unknown>;
  timestamp: number;
}

export class SecurityMonitor {
  private events: SecurityEvent[] = [];
  
  logEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now()
    };
    
    this.events.push(fullEvent);
    
    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Send to logging service (e.g., Sentry, LogRocket, Datadog)
      console.log('Security Event:', fullEvent);
    }
    
    // Keep only last 10000 events in memory
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }
  }
  
  getRecentEvents(minutes: number = 60): SecurityEvent[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.events.filter(e => e.timestamp > cutoff);
  }
} 