# Enhanced Security System - Setup Guide

## 🔒 Security Features Implemented

The application now has a comprehensive, multi-layered security system with the following components:

### 1. **Abuse Prevention Service** (`lib/security/abuse-prevention.ts`)
- **User Activity Tracking**: Monitors code executions, company creations, and problem generations
- **Automatic Blocking**: Temporarily blocks users showing suspicious patterns
- **Permanent Blacklisting**: Ability to permanently block malicious users
- **Thresholds**:
  - 100+ code executions in first hour → 24h block
  - 20+ company creations in first day → 24h block
  - 5+ suspicious activities → 24h block

### 2. **Honeypot Detection** (`lib/security/honeypot.ts`)
- **Bot Detection**: Hidden form fields that bots typically fill
- **Automatic Response**: Returns fake success to confuse bots
- **Integration**: Works with enhanced middleware for POST requests

### 3. **Request Signing** (`lib/security/request-signing.ts`)
- **HMAC Verification**: Cryptographic request validation
- **Timestamp Validation**: Prevents replay attacks (5-minute window)
- **High-Security Endpoints**: Optional for sensitive operations

### 4. **Input Sanitization** (`lib/security/input-sanitization.ts`)
- **XSS Prevention**: Removes HTML/script tags and dangerous patterns
- **Company Name Sanitization**: Allows only safe business characters
- **Injection Protection**: Filters common attack vectors

### 5. **Security Monitoring** (`lib/security/monitoring.ts`)
- **Event Logging**: Tracks all security events
- **Real-time Analysis**: Monitors recent activity patterns
- **Production Integration**: Ready for external logging services

### 6. **Enhanced Middleware** (`lib/security/enhanced-middleware.ts`)
- **Unified Security**: Combines all security features
- **Configurable Options**: Per-endpoint security settings
- **Rate Limiting**: Multiple tiers based on endpoint sensitivity

## 🛠️ Integration Status

### ✅ **Fully Integrated Routes:**
- `POST /api/execute-code` - Code execution with full security
- `POST /api/companies/initialize` - Company creation with abuse prevention

### 🔧 **Security Configuration:**

#### **Execute Code Route:**
```typescript
{
  rateLimiterType: 'codeExecution',    // 10 requests/minute
  checkHoneypotField: true,            // Bot detection enabled
  requireSignature: false              // Set to true for production
}
```

#### **Company Creation Route:**
```typescript
{
  rateLimiterType: 'companyCreation',  // 5 requests/hour
  checkHoneypotField: true,            // Bot detection enabled
  requireSignature: false              // Optional for high security
}
```

## 🚀 Environment Variables Required

Add these to your `.env.local` and production environment:

```bash
# Security Configuration
REQUEST_SIGNATURE_SECRET=your-super-secure-random-string-here

# Firebase Admin SDK (REQUIRED for server-side operations)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id",...}

# Optional: External Monitoring
RATE_LIMIT_REDIS_URL=redis://your-redis-url
SECURITY_MONITORING_ENDPOINT=https://your-logging-service
```

### 🔧 **IMPORTANT: Firebase Admin Setup**

The enhanced security system requires Firebase Admin SDK credentials to bypass Firestore rules for server operations:

1. **Generate Service Account Key:**
   - Go to [Firebase Console](https://console.firebase.google.com) → Your Project
   - Project Settings → Service Accounts → Generate new private key
   - Download the JSON file

2. **Add to Environment:**
   ```bash
   # Copy the entire JSON content to .env.local
   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"algoirl",...}
   ```

3. **Alternative for Production (Recommended):**
   ```bash
   # Use file path instead
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   ```

**⚠️ Without proper Firebase Admin credentials, company creation and code submissions will fail with permission errors.**

## 📊 Security Monitoring

### **Real-time Event Tracking:**
- Rate limit violations
- Suspicious code patterns
- Abuse pattern detection
- Honeypot triggers
- Invalid signature attempts

### **Access Monitoring Dashboard:**
```typescript
import { securityMonitor } from '@/lib/security/enhanced-middleware';

// Get recent security events
const recentEvents = securityMonitor.getRecentEvents(60); // Last 60 minutes
```

## 🔧 Additional Route Integration

To add enhanced security to other routes, use this pattern:

```typescript
import { enhancedSecurityMiddleware } from '@/lib/security/enhanced-middleware';

export async function POST(request: NextRequest) {
  return enhancedSecurityMiddleware(request, async (req) => {
    // Your route logic here
    return NextResponse.json({ success: true });
  }, {
    rateLimiterType: 'general',     // or 'codeExecution', 'companyCreation', 'problemGeneration'
    checkHoneypotField: true,       // Enable bot detection
    requireSignature: false         // Enable for high-security endpoints
  });
}
```

## 🛡️ Security Layers Summary

1. **Firestore Rules**: Database-level access control
2. **Rate Limiting**: Request frequency control per user fingerprint
3. **Abuse Prevention**: Behavioral pattern analysis and blocking
4. **Input Sanitization**: XSS and injection prevention
5. **Honeypot Detection**: Automated bot filtering
6. **Request Signing**: Cryptographic request validation
7. **CORS Protection**: Origin-based access control
8. **Security Monitoring**: Real-time threat detection

## 📈 Production Recommendations

### **Immediate Actions:**
1. Set strong `REQUEST_SIGNATURE_SECRET`
2. Enable request signing for `/api/execute-code`
3. Configure external monitoring service
4. Set up Redis for distributed rate limiting

### **Monitoring Setup:**
1. Integrate with Sentry/DataDog for security events
2. Set up alerts for abuse pattern detection
3. Monitor rate limit violations
4. Track honeypot triggers

### **Performance Optimization:**
1. Use Redis for rate limiting in production
2. Implement distributed abuse tracking
3. Cache security decisions
4. Optimize fingerprint generation

## 🔍 Testing Security Features

### **Rate Limiting Test:**
```bash
# Test rate limits
for i in {1..15}; do curl -X POST http://localhost:3000/api/execute-code; done
```

### **Honeypot Test:**
```bash
# Test bot detection
curl -X POST http://localhost:3000/api/execute-code \
  -H "x-hp-field: email" \
  -d '{"code":"test","language":"javascript","email":"bot@test.com"}'
```

### **Abuse Prevention Test:**
```bash
# Trigger abuse detection (run multiple times rapidly)
curl -X POST http://localhost:3000/api/companies/initialize \
  -d '{"companyName":"TestCompany"}'
```

## 🚨 Security Incident Response

### **Automatic Responses:**
- **Rate Limit Exceeded**: 429 status with retry headers
- **Abuse Detected**: 403 status with temporary block
- **Bot Detected**: 200 status with fake success (confuses bots)
- **Invalid Signature**: 401 status with authentication error

### **Manual Actions:**
```typescript
import { abuseService } from '@/lib/security/enhanced-middleware';

// Permanently block a user
abuseService.permanentlyBlock(fingerprint);

// Report suspicious activity
abuseService.reportSuspiciousActivity(fingerprint, 'Manual review flagged');
```

Your security system is now production-ready with comprehensive protection against common web application threats! 