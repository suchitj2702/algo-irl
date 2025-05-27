# Backend API Deployment Guide for Vercel

## Overview
This guide covers deploying the algo-irl backend API service to Vercel for production use with a separate frontend application.

**Important**: This backend only exposes 4 specific API endpoints:
- `POST /api/execute-code`
- `GET /api/execute-code/status/{submissionId}`
- `POST /api/problem/prepare`
- `POST /api/companies/initialize`

All other API routes are blocked and will return 404 errors.

## Pre-Deployment Checklist

### 1. Environment Variables Required
Ensure you have the following environment variables ready:

#### Firebase Configuration (Public - can be exposed to frontend)
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

#### AI Service API Keys (Secret - server-side only)
```
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key
```

#### Judge0 Code Execution Service (Secret)
```
JUDGE0_API_KEY=your_judge0_api_key
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_CALLBACK_URL=https://your-backend-domain.vercel.app/api/execute-code/judge0-callback
```

#### Code Execution Configuration
```
CODE_EXECUTION_TIMEOUT=25000
CODE_EXECUTION_MEMORY_LIMIT=128
CODE_EXECUTION_MAX_OUTPUT_SIZE=10000
CODE_EXECUTION_ENABLE_NETWORK=false
CODE_EXECUTION_MAX_TEST_CASES=10
```

### 2. Repository Setup
Ensure your code is pushed to a Git repository (GitHub, GitLab, or Bitbucket).

## Deployment Steps

### Step 1: Deploy to Vercel

#### Option A: Vercel Dashboard (Recommended)
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `.` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

#### Option B: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from project directory
cd /path/to/your/project
vercel --prod
```

### Step 2: Configure Environment Variables

1. In your Vercel project dashboard, go to **Settings** → **Environment Variables**
2. Add each environment variable:
   - **Name**: Variable name (e.g., `OPENAI_API_KEY`)
   - **Value**: Your actual value
   - **Environment**: Select "Production" and "Preview"
3. Click "Save" for each variable

### Step 3: Configure Custom Domain (Optional)

1. In project dashboard, go to **Settings** → **Domains**
2. Add your custom domain (e.g., `api.yourdomain.com`)
3. Configure DNS records as instructed by Vercel
4. Update `JUDGE0_CALLBACK_URL` to use your custom domain

### Step 4: Test Deployment

Test only the exposed endpoints:

1. **Code Execution Test**: 
   ```bash
   curl -X POST https://your-backend-domain.vercel.app/api/execute-code \
     -H "Content-Type: application/json" \
     -d '{"code":"console.log(\"test\")","language":"javascript","testCases":[{"stdin":"","expectedStdout":"test\n"}],"boilerplateCode":"console.log(\"test\")"}'
   ```

2. **Status Check Test**: 
   ```bash
   curl https://your-backend-domain.vercel.app/api/execute-code/status/{submissionId}
   ```

3. **Company Initialize Test**: 
   ```bash
   curl -X POST https://your-backend-domain.vercel.app/api/companies/initialize \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

4. **Problem Prepare Test**: 
   ```bash
   curl -X POST https://your-backend-domain.vercel.app/api/problem/prepare \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

5. **Verify Blocked Endpoints**: 
   ```bash
   curl https://your-backend-domain.vercel.app/api/problem
   # Should return: {"error":"API endpoint not available"}
   ```

## Post-Deployment Configuration

### 1. Update Frontend Configuration
Update your frontend application to use only the exposed endpoints:

```javascript
// In your frontend app
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-domain.vercel.app'
  : 'http://localhost:3000';

// Available endpoints only:
const ENDPOINTS = {
  EXECUTE_CODE: `${API_BASE_URL}/api/execute-code`,
  CHECK_STATUS: `${API_BASE_URL}/api/execute-code/status`,
  INITIALIZE_COMPANIES: `${API_BASE_URL}/api/companies/initialize`,
  PREPARE_PROBLEM: `${API_BASE_URL}/api/problem/prepare`
};
```

### 2. Security Features

#### Endpoint Restriction
- **Middleware Protection**: All non-exposed API routes return 404 errors
- **CORS Restriction**: CORS headers only applied to exposed endpoints
- **Function Configuration**: Only exposed endpoints have Vercel function configurations

#### Blocked Endpoints
Any request to endpoints other than the 4 exposed ones will receive:
```json
{
  "error": "API endpoint not available"
}
```

### 3. Monitor and Optimize

#### Function Configuration
The `vercel.json` is configured with:
- **Code Execution**: 1024MB memory, 30s timeout
- **Other Exposed APIs**: 512MB memory, 10s timeout
- **Blocked APIs**: No function configuration (will use defaults if somehow accessed)

#### Performance Monitoring
- Monitor only the 4 exposed endpoints
- Set up alerts for the specific endpoints
- Track usage patterns for the restricted API surface

## Troubleshooting

### Common Issues

1. **Endpoint Not Available Errors**
   - Verify you're calling one of the 4 exposed endpoints
   - Check the exact endpoint path matches the allowed list
   - Ensure you're using the correct HTTP method

2. **CORS Errors on Exposed Endpoints**
   - Verify middleware.ts is properly configured
   - Check that the endpoint is in the allowed list
   - Ensure the request is going to the correct domain

3. **Environment Variables Not Working**
   - Verify variables are set in Vercel dashboard
   - Check variable names match exactly (case-sensitive)
   - Redeploy after adding new environment variables

### Logs and Debugging
- View function logs only for the 4 exposed endpoints
- Blocked endpoints won't generate function logs
- Use Vercel dashboard to monitor the specific functions

## API Usage Examples

After deployment, your frontend can only use these endpoints:

```javascript
// Example: Execute code
const response = await fetch('https://your-backend-domain.vercel.app/api/execute-code', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    code: 'console.log("Hello World");',
    language: 'javascript',
    testCases: [{ stdin: '', expectedStdout: 'Hello World\n' }],
    boilerplateCode: 'console.log("Hello World");'
  })
});

// Example: Check status
const statusResponse = await fetch(`https://your-backend-domain.vercel.app/api/execute-code/status/${submissionId}`);

// Example: Initialize companies
const companyResponse = await fetch('https://your-backend-domain.vercel.app/api/companies/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(companyData)
});

// Example: Prepare problem
const problemResponse = await fetch('https://your-backend-domain.vercel.app/api/problem/prepare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(problemData)
});
```

Your restricted backend API is now ready for production use! 🚀

## Security Benefits

- **Reduced Attack Surface**: Only 4 endpoints are accessible
- **Clear API Contract**: Frontend knows exactly which endpoints are available
- **Protection of Internal APIs**: All other endpoints are completely blocked
- **Simplified Monitoring**: Focus monitoring on only the exposed endpoints 