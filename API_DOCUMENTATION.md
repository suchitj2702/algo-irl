# API Documentation - Algo IRL Backend Service

## Table of Contents
1. [Overview](#overview)
2. [Authentication & Security](#authentication--security)
3. [API Endpoints](#api-endpoints)
   - [Problem Management](#problem-management)
   - [Code Execution](#code-execution)
   - [Company Management](#company-management)
   - [Study Plan Generation](#study-plan-generation)
   - [User Management](#user-management) (Auth Required)
   - [Subscription & Billing](#subscription--billing) (Auth Required)
   - [Webhooks](#webhooks)
   - [Issue Reporting](#issue-reporting)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

## Overview

The Algo IRL backend service is a comprehensive API for managing coding problems, executing code solutions, and transforming problems into company-specific scenarios. It leverages Firebase Firestore for data persistence, Judge0 for code execution, and multiple LLM services (OpenAI, Anthropic, Google Gemini) for intelligent content generation.

### Base URL
The API is designed to be deployed on Vercel/Next.js infrastructure with the base path: `/api/`

### Technology Stack
- **Runtime**: Node.js with Next.js 13+ App Router
- **Database**: Firebase Firestore
- **Code Execution**: Judge0 API
- **AI Services**: OpenAI, Anthropic Claude, Google Gemini
- **Deployment**: Vercel Edge Functions

### Key Features
- Problem management with LeetCode integration
- Real-time code execution
- AI-powered problem transformation to company- and role-specific scenarios
- Company profile management with AI-generated content
- Personalized study plan generation
- User study plan persistence and progress tracking
- Subscription billing via Razorpay
- Issue reporting via Sentry
- Security via CORS, input sanitization, IP blocking, and Vercel Firewall rate limiting

## Authentication & Security

### Security Layers

1. **CORS Configuration**: Flexible CORS headers with origin validation

2. **Input Sanitization**: All user inputs are sanitized to prevent XSS and injection attacks

3. **Rate Limiting**: Handled by Vercel Firewall at the infrastructure level

4. **Firebase Authentication**: Protected endpoints require valid Firebase ID tokens

### Access Control

API endpoints fall into three categories:

1. **Externally Accessible**: Available to frontend clients (e.g., `/api/problem/prepare`, `/api/execute-code`, `/api/companies`)
2. **Auth Required**: Require a valid Firebase ID token via `Authorization: Bearer <token>` header (e.g., `/api/user/*`, `/api/billing/*`)
3. **Internal Only**: Blocked from external access by middleware; only available to internal server-side calls (e.g., `/api/problem/filter`, `/api/problem/transform`, `/api/companies/initialize`)

## API Endpoints

### Problem Management

#### 1. Get All Problems (Internal Only)
```http
GET /api/problem
```

**Access:** Internal server-side only

**Response:**
```json
[
  {
    "id": "two-sum",
    "title": "Two Sum",
    "difficulty": "Easy",
    "categories": ["Array", "Hash Table"],
    "isBlind75": true
  }
]
```

#### 2. Get Problem by ID (Internal Only)
```http
GET /api/problem/{problemId}?language={language}
```

**Access:** Internal server-side only

**Parameters:**
- `problemId` (path): Problem identifier
- `language` (query, optional): Programming language for language-specific details

**Response:**
```json
{
  "id": "two-sum",
  "title": "Two Sum",
  "difficulty": "Easy",
  "categories": ["Array", "Hash Table"],
  "description": "Given an array of integers...",
  "constraints": ["2 <= nums.length <= 10^4"],
  "leetcodeLink": "https://leetcode.com/problems/two-sum/",
  "isBlind75": true,
  "testCases": [...],
  "languageSpecificDetails": {
    "python": {
      "solutionFunctionNameOrClassName": "Solution",
      "solutionStructureHint": "class with twoSum method",
      "boilerplateCodeWithPlaceholder": "...",
      "defaultUserCode": "...",
      "optimizedSolutionCode": "..."
    }
  }
}
```

#### 3. Get Blind 75 Problems (Internal Only)
```http
GET /api/problem/blind75
```

**Access:** Internal server-side only

**Response:** Array of simplified problem objects (same as Get All Problems)

#### 4. Get Problems by Difficulty (Internal Only)
```http
GET /api/problem/by-difficulty/{difficulty}
```

**Access:** Internal server-side only

**Parameters:**
- `difficulty` (path): One of "Easy", "Medium", or "Hard"

**Response:**
```json
["problem-id-1", "problem-id-2", ...]
```

#### 5. Filter Problems (Internal Only)
```http
GET /api/problem/filter?isBlind75={boolean}&difficulty={difficulty}
```

**Access:** Internal server-side only

**Parameters:**
- `isBlind75` (query, required): Filter for Blind 75 problems
- `difficulty` (query, optional): Problem difficulty

**Response:**
```json
{
  "problemId": "random-problem-id"
}
```

#### 6. Import Problems (Batch) - DEPRECATED

> **⚠️ This endpoint has been deprecated.**
> Use the new batch processing system instead:
> `scripts/batch-problem-generation/` - See [README](scripts/batch-problem-generation/README.md) for usage.

The new system offers:
- 50% cost savings via Claude Batch API
- Better scalability (handle thousands of problems)
- Improved monitoring and error handling
- Resumable batch jobs

---

#### 7. Transform Problem (Internal Only)
```http
POST /api/problem/transform
```

**Access:** Internal server-side only

**Request Body:**
```json
{
  "problemId": "two-sum",
  "companyId": "google",
  "roleFamily": "backend",
  "useCache": true
}
```

**Parameters:**
- `problemId` (required): Problem identifier
- `companyId` (required): Company identifier
- `roleFamily` (optional): Engineering role family for targeted transformation. One of `"backend"`, `"frontend"`, `"ml"`, `"infrastructure"`, `"security"`. If omitted, a random role is auto-selected.
- `useCache` (optional, default `true`): Whether to use cached transformations

**Response:**
```json
{
  "structuredScenario": {
    "title": "Find Matching Document Indices in Search Results",
    "background": "At Google, you're working on the search index team...",
    "problemStatement": "Given an array of document relevance scores...",
    "functionSignature": "def findMatchingDocumentIndices(scores: List[int], target: int) -> List[int]:",
    "constraints": [
      "2 <= scores.length <= 10^4",
      "-10^9 <= scores[i] <= 10^9"
    ],
    "examples": [
      {
        "input": "scores = [2, 7, 11, 15], target = 9",
        "output": "[0, 1]",
        "explanation": "scores[0] + scores[1] = 2 + 7 = 9"
      }
    ],
    "requirements": [
      "Return indices of two documents whose scores sum to target",
      "Each input has exactly one solution"
    ],
    "functionMapping": {
      "twoSum": "findMatchingDocumentIndices",
      "nums": "scores",
      "target": "target"
    }
  },
  "contextInfo": {
    "detectedAlgorithms": ["Hashing", "ArrayTraversal"],
    "detectedDataStructures": ["Array", "HashMap"],
    "relevanceScore": 12,
    "suggestedAnalogyPoints": [
      "Google search results list",
      "Document relevance scoring system"
    ]
  }
}
```

#### 8. Prepare Problem
```http
POST /api/problem/prepare
```

**Access:** Externally accessible

**Request Body:**
```json
{
  "problemId": "two-sum",
  "companyId": "google",
  "roleFamily": "backend",
  "difficulty": "Easy",
  "isBlind75": true
}
```

**Parameters:**
- `problemId` (conditionally required): Problem identifier. Either `problemId` **or** `difficulty` must be provided. When `difficulty` is provided without `problemId`, a random matching problem is selected.
- `companyId` (required): Company identifier
- `roleFamily` (optional): Engineering role family. One of `"backend"`, `"frontend"`, `"ml"`, `"infrastructure"`, `"security"`. If omitted, a random role is auto-selected.
- `difficulty` (conditionally required): One of `"Easy"`, `"Medium"`, `"Hard"`. Used to select a random problem if `problemId` is not provided.
- `isBlind75` (optional, default `false`): When `true`, restricts random problem selection to Blind 75 problems. Only relevant when using `difficulty` instead of `problemId`.

**Response:**
```json
{
  "problem": {
    "id": "two-sum",
    "title": "Find Matching Document Indices",
    "difficulty": "Easy",
    "background": "At Google, you're working on...",
    "problemStatement": "Given an array of document relevance scores...",
    "constraints": [...],
    "examples": [...],
    "requirements": [...],
    "testCases": [...],
    "leetcodeUrl": "https://leetcode.com/problems/two-sum/",
    "categories": ["Array", "Hash Table"],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)"
  },
  "codeDetails": {
    "functionName": "findMatchingDocumentIndices",
    "solutionStructureHint": "class with findMatchingDocumentIndices method",
    "defaultUserCode": "...",
    "boilerplateCode": "..."
  },
  "roleMetadata": {
    "roleFamily": "backend",
    "wasRoleAutoSelected": false,
    "contextInfo": {
      "detectedAlgorithms": ["Hashing", "ArrayTraversal"],
      "detectedDataStructures": ["Array", "HashMap"],
      "relevanceScore": 12,
      "suggestedAnalogyPoints": [
        "Google search results list",
        "Document relevance scoring system"
      ]
    }
  }
}
```

### Code Execution

#### 1. Submit Code for Execution
```http
POST /api/execute-code
```

**Security:** Protected endpoint with the following limits:
- Rate limiting: Handled by Vercel Firewall
- Maximum 150 test cases per submission
- Maximum execution time: 10 seconds per test case
- Maximum memory usage: 256 MB per test case

**Supported Languages:**
- `javascript` - Node.js 12.14.0
- `typescript` - TypeScript 3.7.4  
- `python` - Python 3.8.1
- `java` - OpenJDK 13.0.1
- `csharp` - C# Mono 6.6.0.161
- `cpp` - C++ GCC 9.2.0
- `go` - Go 1.13.5

**Request Body:**
```json
{
  "code": "def solution(nums, target):\n    return [0, 1]",
  "language": "python",
  "boilerplateCode": "# Test harness code...",
  "testCases": [
    {
      "stdin": "[2,7,11,15]\n9",
      "expectedStdout": "[0,1]",
      "explanation": "nums[0] + nums[1] = 2 + 7 = 9",
      "isSample": true,
      "maxCpuTimeLimit": 10,
      "maxMemoryLimit": 256
    }
  ]
}
```

**Response:**
```json
{
  "submissionId": "sub_123456",
  "message": "Code submitted successfully. Poll for results using the submissionId."
}
```

#### 2. Get Execution Status
```http
GET /api/execute-code/status/{submissionId}
```

**Parameters:**
- `submissionId` (path): Submission identifier from submit response

**Response (Processing):**
```json
{
  "status": "processing",
  "message": "Submission is still processing by Judge0."
}
```

**Response (Completed):**
```json
{
  "status": "completed",
  "results": {
    "passed": false,
    "testCasesPassed": 1,
    "testCasesTotal": 3,
    "executionTime": 45.2,
    "memoryUsage": 14.5,
    "error": null,
    "testResults": [
      {
        "testCase": {
          "stdin": "[2,7,11,15]\n9",
          "expectedStdout": "[0,1]"
        },
        "passed": true,
        "actualOutput": "[0,1]",
        "stdout": "[0,1]",
        "stderr": null,
        "status": "Accepted",
        "judge0StatusId": 3,
        "time": 0.042,
        "memory": 3024
      }
    ]
  }
}
```

**Response (Error):** *(HTTP 500)*
```json
{
  "status": "error",
  "results": {
    "passed": false,
    "testCasesPassed": 0,
    "testCasesTotal": 1,
    "executionTime": null,
    "memoryUsage": null,
    "error": "Compilation Error: 'solution' function not found",
    "testResults": [
      {
        "testCase": {...},
        "passed": false,
        "actualOutput": null,
        "stderr": "Error: 'solution' function not found or not callable",
        "compileOutput": "SyntaxError: Unexpected token",
        "status": "Compilation Error",
        "judge0StatusId": 6
      }
    ]
  }
}
```

#### 3. Judge0 Callback (Internal)
```http
POST /api/execute-code/judge0-callback?submissionId={submissionId}
```

**Note:** This endpoint is designed to be called by Judge0's callback mechanism and should be protected by IP whitelisting in production.

### Company Management

#### 1. Get All Companies
```http
GET /api/companies?limit={limit}
```

**Access:** Externally accessible

**Parameters:**
- `limit` (query, optional): Maximum number of companies to return. Must be a positive integer.

**Description:** Retrieves a list of all companies with basic information. Returns simplified company data suitable for listing and filtering on the client side.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "google",
      "name": "Google",
      "description": "A global technology leader...",
      "domain": "Technology",
      "products": ["Search", "Cloud", "Android"],
      "technologies": ["Python", "Go", "C++"],
      "logoUrl": "https://..."
    },
    {
      "id": "amazon",
      "name": "Amazon",
      "description": "E-commerce and cloud computing giant...",
      "domain": "Technology",
      "products": ["AWS", "Prime", "Kindle"],
      "technologies": ["Java", "Python", "C++"],
      "logoUrl": "https://..."
    }
  ]
}
```

**Error Response:**
```json
{
  "error": "Failed to fetch companies"
}
```

---

⚠️ **INTERNAL ONLY**: The following company management endpoints are for internal server-side use only. They are not accessible from external clients and are protected by middleware that blocks external access.

#### 2. Get Company by ID (Internal Only)
```http
GET /api/companies/{id}
```

**Access:** Internal server-side only

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "google",
    "name": "Google",
    "description": "A global technology leader...",
    "domain": "Technology",
    "products": ["Search", "Cloud", "Android"],
    "technologies": ["Python", "Go", "C++"],
    "interviewFocus": ["Algorithms", "System Design"],
    "logoUrl": "https://...",
    "createdAt": {...},
    "updatedAt": {...}
  }
}
```

#### 3. Initialize Tech Companies (Internal Only)
```http
GET /api/companies/initialize
```

**Access:** Internal server-side only

**Description:** Initializes the database with predefined tech companies

**Response:**
```json
{
  "success": true,
  "message": "Tech companies initialized successfully"
}
```

#### 4. Generate Company with AI (Internal Only)
```http
POST /api/companies/initialize
```

**Access:** Internal server-side only

**Description:** Generates comprehensive company data using AI (Claude Sonnet 4.5)

**Request Body:**
```json
{
  "companyName": "Acme Corp"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Company Acme Corp generated and saved successfully",
  "company": {
    "id": "acmecorp",
    "name": "Acme Corp",
    "description": "...",
    "domain": "Technology",
    "products": [...],
    "technologies": [...],
    "interviewFocus": [...],
    "engineeringChallenges": {...},
    "scaleMetrics": {...},
    "roleSpecificData": {...}
  }
}
```

**Note:** The new company generation uses Claude Sonnet 4.5 to generate rich, comprehensive company data including role-specific information for backend, ML, frontend, infrastructure, and security roles. Data is stored in the `companies-v2` Firestore collection.

### Study Plan Generation

#### 1. Generate Study Plan
```http
POST /api/study-plan/generate
```

**Access:** Externally accessible

**Description:** Generate a personalized study plan for interview preparation based on company, role, timeline, and preferences.

**Request Body:**
```json
{
  "companyId": "google",
  "roleFamily": "backend",
  "timeline": 30,
  "hoursPerDay": 2,
  "difficultyPreference": {
    "easy": true,
    "medium": true,
    "hard": false
  },
  "topicFocus": ["Array", "Dynamic Programming"]
}
```

**Parameters:**
- `companyId` (required): Company identifier
- `roleFamily` (required): One of `"backend"`, `"frontend"`, `"ml"`, `"infrastructure"`, `"security"`
- `timeline` (required): Number of days (1–90)
- `hoursPerDay` (required): Hours per day (0.5–8)
- `difficultyPreference` (optional): Object with `easy`, `medium`, `hard` boolean flags
- `topicFocus` (optional): Array of topic strings (max 5)

**Response:**
```json
{
  "company": { "id": "google", "name": "Google", ... },
  "roleFamily": "backend",
  "timeline": 30,
  "hoursPerDay": 2,
  "totalProblems": 25,
  "schedule": [...],
  "problems": [...]
}
```

#### 2. Generate Blind75 Study Plan
```http
POST /api/study-plan/generate-blind75
```

**Access:** Externally accessible

**Description:** Same as Generate Study Plan, but restricts the problem pool to only Blind 75 problems.

**Request/Response:** Same as Generate Study Plan above. The `onlyBlind75` flag is set internally.

---

### User Management

> **Authentication Required:** All user endpoints require a valid Firebase ID token via `Authorization: Bearer <token>` header.

#### 1. Get User Preferences
```http
GET /api/user/preferences
```

**Description:** Retrieve the authenticated user's UI preferences.

**Response:**
```json
{
  "preferences": { ... },
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

#### 2. Update User Preferences
```http
PUT /api/user/preferences
```

**Description:** Update the authenticated user's UI preferences. Merges with existing preferences.

**Request Body:** Preferences object (validated against `UserPreferencesSchema`)

**Response:**
```json
{
  "preferences": { ... },
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

#### 3. List User Study Plans
```http
GET /api/user/study-plans?limit={limit}&cursor={cursor}
```

**Description:** Retrieve the authenticated user's saved study plans with pagination.

**Parameters:**
- `limit` (query, optional): Number of plans to return (1–50, default 10)
- `cursor` (query, optional): Plan ID for cursor-based pagination

**Response:**
```json
{
  "data": [...],
  "nextCursor": "plan_id_or_null"
}
```

#### 4. Save Study Plan
```http
POST /api/user/study-plans
```

**Description:** Save a generated study plan to the authenticated user's collection.

**Request Body:** Study plan payload (validated against `StudyPlanCreatePayloadSchema`)

**Response (201):**
```json
{
  "id": "plan_123",
  "config": { ... },
  "response": { ... },
  "progress": {
    "status": "not_started",
    "completedProblems": 0,
    "totalProblems": 25,
    "currentDay": 0
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

#### 5. Get Study Plan by ID
```http
GET /api/user/study-plans/{planId}
```

**Description:** Retrieve a specific study plan by its ID.

**Response:** Full study plan object.

#### 6. Update Study Plan Progress
```http
PATCH /api/user/study-plans/{planId}
```

**Description:** Update progress on a specific study plan. Supports both general progress updates and per-problem progress tracking. Automatically calculates `completedProblems` count and updates `status` (`not_started` → `in_progress` → `completed`).

**Request Body (problem progress):**
```json
{
  "problemProgress": {
    "two-sum": {
      "status": "solved",
      "lastWorkedAt": "2025-01-15T10:30:00.000Z",
      "problemDetails": { ... },
      "codeDetails": { ... }
    }
  }
}
```

**Request Body (general progress):**
```json
{
  "status": "in_progress",
  "currentDay": 5,
  "note": "Halfway through week 1"
}
```

#### 7. Delete Study Plan
```http
DELETE /api/user/study-plans/{planId}
```

**Description:** Permanently delete a study plan.

**Response:**
```json
{ "success": true }
```

---

### Subscription & Billing

> **Authentication Required:** All billing endpoints require a valid Firebase ID token via `Authorization: Bearer <token>` header.

#### 1. Get Subscription Status
```http
GET /api/user/subscription/status
```

**Description:** Get the authenticated user's current subscription status.

**Response:**
```json
{
  "status": "active",
  "currentPeriodEnd": 1705312800000,
  "cancelAt": null
}
```

**Note:** Response includes `Cache-Control: private, max-age=60` header.

#### 2. Create Subscription
```http
POST /api/billing/create-subscription
```

**Description:** Create a Razorpay subscription for the authenticated user. Requires payments to be enabled via Firebase Remote Config and user to be in the rollout.

**Request Body:**
```json
{
  "planId": "plan_xyz",
  "totalCount": 120,
  "customerNotify": 1,
  "returnUrl": "/my-study-plans",
  "metadata": {
    "source": "landing",
    "feature": "study-plans"
  }
}
```

**Parameters:**
- `planId` (required): Razorpay plan ID (must match configured plan)
- `totalCount` (optional, default 120): Total billing cycles
- `customerNotify` (optional, default 1): Whether Razorpay notifies the customer (0 or 1)
- `returnUrl` (optional): Redirect URL after payment (must be same origin)
- `metadata` (optional): Source tracking metadata

**Response (201):**
```json
{
  "subscriptionId": "sub_xyz",
  "status": "created",
  "shortUrl": "https://rzp.io/...",
  "currentStart": null,
  "currentEnd": null,
  "planId": "plan_xyz",
  "returnUrl": "/my-study-plans",
  "callbackUrl": "https://app.example.com/payment-status?subscription_id=sub_xyz"
}
```

#### 3. Verify Payment
```http
POST /api/billing/verify-payment
```

**Description:** Verify a Razorpay payment after checkout completion. Optionally validates the Razorpay signature.

**Request Body:**
```json
{
  "paymentId": "pay_xyz",
  "subscriptionId": "sub_xyz",
  "signature": "optional_razorpay_signature"
}
```

**Response:**
```json
{
  "verified": true,
  "status": "success",
  "subscription": {
    "id": "sub_xyz",
    "status": "active",
    "planId": "plan_xyz",
    "currentPeriodEnd": 1705312800000
  },
  "payment": {
    "id": "pay_xyz",
    "amount": 79900,
    "currency": "INR",
    "status": "captured"
  }
}
```

#### 4. Manage Subscription
```http
GET /api/billing/manage-subscription?action={action}&limit={limit}
```

**Description:** Query subscription details, payment history, or upcoming invoices.

**Parameters:**
- `action` (required): One of `"details"`, `"history"`, `"upcoming"`
- `limit` (optional, for `history`): Number of payments to return (1–50, default 10)

**Response (action=details):**
```json
{
  "hasSubscription": true,
  "subscription": {
    "id": "sub_xyz",
    "status": "active",
    "planId": "plan_xyz",
    "planName": "Monthly Subscription - INR",
    "currentPeriodStart": "...",
    "currentPeriodEnd": "...",
    "cancelAt": null,
    "daysRemaining": 22,
    "isExpiring": false,
    "amount": 79900,
    "currency": "INR"
  }
}
```

#### 5. Cancel Subscription
```http
POST /api/billing/cancel-subscription
```

**Description:** Cancel a Razorpay subscription. Can cancel immediately or at the end of the current billing cycle.

**Request Body:**
```json
{
  "subscriptionId": "sub_xyz",
  "cancelAtCycleEnd": true
}
```

**Parameters:**
- `subscriptionId` (required): Razorpay subscription ID (must belong to authenticated user)
- `cancelAtCycleEnd` (optional, default `false`): If `true`, subscription remains active until the end of the current billing cycle

**Response:**
```json
{
  "subscriptionId": "sub_xyz",
  "status": "cancelled",
  "endedAt": 1705312800,
  "message": "Subscription will be cancelled at the end of the current billing cycle"
}
```

---

### Webhooks

#### 1. Razorpay Webhook
```http
POST /api/razorpay/webhook
```

**Access:** Externally accessible (signature-verified)

**Description:** Receives Razorpay webhook events. Validates the `x-razorpay-signature` header against the configured webhook secret. Implements idempotent processing with claim-based deduplication.

**Handled Events:**
- `subscription.activated`, `subscription.charged` — Lookup by customer ID
- `subscription.cancelled`, `subscription.completed`, `subscription.paused`, `subscription.resumed` — Lookup by subscription ID
- `payment.authorized`, `payment.captured`, `payment.failed` — Payment processing

**Response:**
```json
{ "received": true }
```

#### 2. Webhook Health Check
```http
GET /api/razorpay/webhook/health
```

**Description:** Dashboard showing webhook processing health metrics for the last hour.

**Response:**
```json
{
  "status": "healthy",
  "healthScore": 90,
  "metrics": {
    "webhooksLastHour": 15,
    "failedWebhooks": 0,
    "avgProcessingTimeMs": 250,
    "razorpayStatus": "connected",
    "firestoreStatus": "connected"
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### 3. Webhook Event Cleanup
```http
DELETE /api/razorpay/webhook/health
```

**Description:** Delete webhook events older than 30 days. Processes up to 100 events per call.

**Response:**
```json
{
  "deleted": 42,
  "message": "Deleted 42 old webhook events"
}
```

---

### Issue Reporting

#### 1. Report Issue
```http
POST /api/issue/report
```

**Access:** Externally accessible (optional authentication)

**Description:** Report issues with the platform. Issues are sent to Sentry for tracking. Authentication is optional — if an `Authorization` header is present it must be valid (invalid tokens return 401), but anonymous reports are accepted.

**Request Body:** Validated against `IssueReportPayloadSchema`. Includes fields such as:
- `notificationType` (required): Type of issue
- `problemId` (required): Related problem ID
- `description` (required): Issue description
- `companyId` (optional): Related company ID
- `roleId` (optional): Related role ID
- `userCode` (optional): User's code at time of issue
- `consoleLogs` (optional): Browser console logs
- `rawPrepareResponse` (optional): Raw API response for debugging

**Response:**
```json
{
  "success": true,
  "issueId": "sentry_event_id",
  "message": "Issue reported successfully. We'll look into it!"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Description is required",
  "details": { ... }
}
```

## Data Models

### Problem
```typescript
interface Problem {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  categories: string[];
  description: string;
  constraints: string[];
  leetcodeLink?: string;
  isBlind75: boolean;
  testCases: TestCase[];
  languageSpecificDetails: Record<string, LanguageSpecificProblemDetails>;
  solutionApproach?: string | null;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### TestCase
```typescript
interface TestCase {
  stdin: string;
  expectedStdout: string;
  explanation?: string;
  isSample?: boolean;
  name?: string;
  maxCpuTimeLimit?: number;
  maxMemoryLimit?: number;
}
```

### TestCaseResult
```typescript
interface TestCaseResult {
  testCase: TestCase;
  passed: boolean;
  actualOutput: string | number | boolean | null | undefined | Array<unknown> | Record<string, unknown>;
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  status: string;
  judge0StatusId: number;
  time: number;
  memory: number;
  error?: string | null;
}
```

### Company
```typescript
interface Company {
  id?: string;
  name: string;
  description: string;
  domain: string;
  products: string[];
  technologies: string[];
  interviewFocus: string[];
  logoUrl?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  wasNameCorrected?: boolean;
}
```

### ExecutionResult
```typescript
interface ExecutionResult {
  success: boolean;
  testResults: TestCaseResult[];
  executionTime: number;
  memoryUsage: number;
  error?: string;
}
```

## Error Handling

The API uses consistent error response format:

```json
{
  "error": "Error message",
  "message": "Additional context (optional)",
  "details": {} // Optional additional error details
}
```

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (signature verification failed)
- `403`: Forbidden (abuse pattern detected)
- `404`: Not Found
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error
- `503`: Service Unavailable (external service down)

## Rate Limiting

Rate limiting is handled entirely at the **Vercel Firewall** level — the application code does not implement its own rate limiting or return rate limit headers. Specific rate limit thresholds are configured in the Vercel Firewall dashboard and are not part of the application codebase.

When a request is rate-limited, Vercel returns an HTTP `429 Too Many Requests` response before the request reaches the application.

### Abuse Prevention

The application implements the following security measures:

- **IP blocking via Vercel KV**: Manually blocked IPs are checked in middleware and denied access with HTTP 403. This is a manual process, not automatic detection.
- **Code submission validation**: User-submitted code is checked for suspicious patterns (e.g., `import os`, `subprocess`, `child_process`, `eval`, `exec`, `__import__`) and rejected if dangerous operations are detected.
- **Input sanitization**: All non-code string inputs are sanitized to prevent XSS and injection attacks. Code inputs are preserved to maintain syntax.

## Implementation Notes

### Code Execution Architecture

1. **Submission Flow:**
   - User submits code → Internal submission ID generated
   - Code wrapped with language-specific driver template
   - Batch submission to Judge0 with multiple test cases
   - Async processing with callback or polling mechanism

2. **Driver Templates:**
   - Each language has a driver template that handles I/O
   - User code is injected at placeholder location
   - Driver handles JSON parsing/serialization
   - Supports both single and multiple function arguments

3. **Result Aggregation:**
   - Individual test case results are aggregated
   - Execution time and memory usage are averaged
   - First error stops execution of remaining test cases

### Problem Transformation

1. **AI Context Generation:**
   - Extracts algorithms, data structures, and keywords
   - Calculates relevance score between problem and company
   - Generates company-specific analogies

2. **Caching Strategy:**
   - Transformations are cached in Firestore
   - Cache key: `problemId-companyId`
   - Default cache duration: 30 days
   - Can be bypassed with `useCache: false`

3. **Function Mapping:**
   - Original function/variable names mapped to company context
   - Applied consistently across code, test cases, and examples

### Security Considerations

1. **Input Sanitization:**
   - Applied to all non-code string inputs
   - Code inputs preserved to maintain syntax

2. **Code Submission Validation:**
   - Checks for suspicious patterns (`import os`, `subprocess`, `child_process`, `eval`, `exec`, `__import__`)
   - Enforces maximum code length (50KB)

3. **IP Blocking:**
   - Manual IP blocking via Vercel KV (checked in middleware)
   - Request IP addresses tracked for monitoring

4. **Rate Limiting:**
   - Handled entirely by Vercel Firewall at infrastructure level
   - Application code does not set rate limit headers

### Error Handling Patterns

1. **Graceful Degradation:**
   - Falls back to cached data when external services fail
   - Returns partial results when possible

2. **Error Propagation:**
   - External service errors wrapped with context
   - Original error messages preserved in logs

3. **Client-Friendly Errors:**
   - Technical details logged server-side
   - User-friendly messages returned to client

### Judge0 Status Codes

Common status codes returned in test results:

| Status ID | Description | Meaning |
|-----------|-------------|---------|
| 1 | In Queue | Submission waiting to be processed |
| 2 | Processing | Currently being executed |
| 3 | Accepted | Test case passed successfully |
| 4 | Wrong Answer | Output doesn't match expected |
| 5 | Time Limit Exceeded | Execution took too long |
| 6 | Compilation Error | Code failed to compile |
| 7 | Runtime Error (SIGSEGV) | Segmentation fault |
| 8 | Runtime Error (SIGXFSZ) | Output limit exceeded |
| 9 | Runtime Error (SIGFPE) | Floating point error |
| 10 | Runtime Error (SIGABRT) | Aborted |
| 11 | Runtime Error (NZEC) | Non-zero exit code |
| 12 | Runtime Error (Other) | Other runtime errors |
| 13 | Internal Error | Judge0 system error |
| 14 | Exec Format Error | Invalid executable format |

## Environment Configuration

### Required Environment Variables

```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key

# Judge0 Configuration
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your-rapidapi-key
JUDGE0_CALLBACK_URL=https://your-domain.com/api/execute-code/judge0-callback

# AI Service Keys
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-key

# Security
ALLOWED_ORIGINS=https://your-frontend.com,https://another-allowed-origin.com

# Vercel KV (for IP blocking)
KV_REST_API_URL=your-kv-url
KV_REST_API_TOKEN=your-kv-token

# Razorpay (Billing)
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
RAZORPAY_PLAN_MONTHLY_INR=plan_xyz

# Application URL
NEXT_PUBLIC_APP_URL=https://your-app.com

# Sentry (Issue Reporting)
SENTRY_DSN=your-sentry-dsn
```

### Development Setup

1. **Local Development:**
   ```bash
   # Install dependencies
   npm install
   
   # Set up environment variables
   cp .env.example .env.local
   
   # Run development server
   npm run dev
   ```

2. **Testing Code Execution Locally:**
   - Use Judge0's public API for development
   - Set `JUDGE0_CALLBACK_URL` to use ngrok or similar for callbacks
   - Or rely on polling mechanism (callbacks optional in development)

3. **Firebase Emulator:**
   ```bash
   # Install Firebase CLI
   npm install -g firebase-tools
   
   # Start emulators
   firebase emulators:start
   ```

### Production Considerations

1. **Security:**
   - Configure CORS allowed origins restrictively
   - Implement IP whitelisting for Judge0 callbacks
   - Use Firebase Security Rules for Firestore
   - Enable Vercel Firewall for rate limiting and bot protection

2. **Performance:**
   - Enable Firestore indexes for common queries
   - Use Firebase Admin SDK connection pooling
   - Implement response caching where appropriate
   - Consider edge caching for static problem data

3. **Monitoring:**
   - Set up error tracking (e.g., Sentry)
   - Monitor rate limit violations
   - Track code execution metrics
   - Set up alerts for high error rates

4. **Scaling:**
   - Vercel automatically scales Edge Functions
   - Consider Judge0 API rate limits
   - Monitor Firestore read/write quotas
   - Implement queue system for high load 