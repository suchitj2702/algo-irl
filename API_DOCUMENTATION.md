# API Documentation - Algo IRL Backend Service

## Table of Contents
1. [Overview](#overview)
2. [Authentication & Security](#authentication--security)
3. [API Endpoints](#api-endpoints)
   - [Problem Management](#problem-management)
   - [Code Execution](#code-execution)
   - [Company Management](#company-management)
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
- AI-powered problem transformation to company-specific scenarios
- Company profile management with AI-generated content
- Multi-layered security with rate limiting and abuse prevention

## Authentication & Security

### Security Layers

1. **Enhanced Security Middleware**: All sensitive endpoints are protected by a comprehensive security middleware that includes:
   - Request fingerprinting for tracking
   - Multi-tier rate limiting
   - Abuse pattern detection
   - Honeypot bot detection
   - Optional request signature verification

2. **CORS Configuration**: Flexible CORS headers with origin validation

3. **Input Sanitization**: All user inputs are sanitized to prevent XSS and injection attacks

### Security Headers

Protected endpoints include the following headers:
- `X-RateLimit-Limit`: Maximum requests allowed in the time window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Timestamp when the rate limit resets
- `Retry-After`: Seconds to wait before retrying (on 429 responses)

## API Endpoints

### Problem Management

#### 1. Get All Problems
```http
GET /api/problem
```

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

#### 2. Get Problem by ID
```http
GET /api/problem/{problemId}?language={language}
```

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

#### 3. Get Blind 75 Problems
```http
GET /api/problem/blind75
```

**Response:** Array of simplified problem objects (same as Get All Problems)

#### 4. Get Problems by Difficulty
```http
GET /api/problem/by-difficulty/{difficulty}
```

**Parameters:**
- `difficulty` (path): One of "Easy", "Medium", or "Hard"

**Response:**
```json
["problem-id-1", "problem-id-2", ...]
```

#### 5. Filter Problems
```http
GET /api/problem/filter?isBlind75={boolean}&difficulty={difficulty}
```

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

#### 7. Transform Problem
```http
POST /api/problem/transform
```

**Request Body:**
```json
{
  "problemId": "two-sum",
  "companyId": "google",
  "useCache": true
}
```

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

**Request Body:**
```json
{
  "problemId": "two-sum",
  "companyId": "google",
  "difficulty": "Easy",
  "isBlind75": true,
  "transformedProblem": {} // Optional, if not provided will call transform API
}
```

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
    "leetcodeUrl": "https://leetcode.com/problems/two-sum/"
  },
  "codeDetails": {
    "functionName": "findMatchingDocumentIndices",
    "solutionStructureHint": "class with findMatchingDocumentIndices method",
    "defaultUserCode": "...",
    "boilerplateCode": "..."
  }
}
```

### Code Execution

#### 1. Submit Code for Execution
```http
POST /api/execute-code
```

**Security:** Protected by enhanced security middleware with:
- Rate limit: 10 requests per minute
- Honeypot field checking
- Request fingerprinting
- Maximum 20 test cases per submission
- Maximum execution time: 5 seconds per test case
- Maximum memory usage: 128 MB per test case

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
      "maxCpuTimeLimit": 5,
      "maxMemoryLimit": 128
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

**Response (Error):**
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

⚠️ **INTERNAL ONLY**: All company management endpoints are for internal server-side use only. They are not accessible from external clients and are protected by middleware that blocks external access.

#### 1. Get Company by ID (Internal Only)
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

#### 2. Get Companies by Domain (Internal Only)
```http
GET /api/companies/domain?domain={domain}
```

**Access:** Internal server-side only

**Parameters:**
- `domain` (query): Company domain (e.g., "Technology", "Finance")

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "google",
      "name": "Google",
      ...
    }
  ]
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

Different endpoints have different rate limits based on their resource intensity:

| Endpoint Type | Limit | Window | Reset Strategy |
|--------------|-------|---------|----------------|
| Code Execution | 10 requests | 1 minute | Sliding window |
| Problem Generation | 30 requests | 1 minute | Sliding window |
| Company Creation | 5 requests | 1 hour | Sliding window |
| General API | 100 requests | 1 minute | Sliding window |

Rate limit information is included in response headers:
- `X-RateLimit-Limit`: Total requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp for limit reset
- `Retry-After`: Seconds to wait (on 429 responses)

### Abuse Prevention
Beyond rate limiting, the system implements:
- Pattern-based abuse detection
- Suspicious activity tracking
- Automatic blocking for repeated violations
- Configurable cool-down periods

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

1. **Request Fingerprinting:**
   - Combines IP, User-Agent, and other headers
   - Used for rate limiting and abuse tracking

2. **Input Sanitization:**
   - Applied to all non-code string inputs
   - Code inputs preserved to maintain syntax

3. **Honeypot Fields:**
   - Hidden fields in request headers (X-Hp-Field)
   - Bots filling these fields are automatically blocked

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

# Security (Optional)
REQUEST_SIGNATURE_SECRET=your-secret-for-signatures
ALLOWED_ORIGINS=https://your-frontend.com,https://another-allowed-origin.com
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
   - Enable request signature verification for sensitive endpoints
   - Configure CORS allowed origins restrictively
   - Implement IP whitelisting for Judge0 callbacks
   - Use Firebase Security Rules for Firestore

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