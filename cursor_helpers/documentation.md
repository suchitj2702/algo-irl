# AlgoIRL Technical Documentation

## Table of Contents
- [Project Overview](#project-overview)
- [System Architecture](#system-architecture)
- [Database Schemas](#database-schemas)
- [API Endpoints](#api-endpoints)
- [Function Specifications](#function-specifications)
- [Architecture Decisions](#architecture-decisions)
- [Security Considerations](#security-considerations)
- [Monitoring and Operations](#monitoring-and-operations)
- [AWS Migration Plan](#aws-migration-plan)

## Project Overview

AlgoIRL (Algorithms In Real Life) transforms abstract LeetCode algorithm problems into realistic, company-specific interview scenarios. The platform takes LeetCode problems (starting with a subset of the Blind 75 collection) and uses AI to contextualize them as real-world challenges a developer might face at companies like Meta, Amazon, or Google.

### Key Features
- Company-specific problem contextualization
- Curated problem repository (initially 20 selected problems)
- Custom company support
- Scenario caching for performance
- User history tracking

## System Architecture

AlgoIRL MVP is built using Firebase and Vercel with a modern serverless approach for rapid development, with plans to migrate to AWS in a later phase.

### Infrastructure Diagram
```
                   ┌─────────────────────┐
                   │     Vercel Edge     │
                   │   (Next.js Host)    │
                   └─────────┬───────────┘
                             │
                             ▼
┌───────────────┐   ┌─────────────────┐   ┌──────────────────┐
│  Firebase Auth │◄──│  Next.js App   │──►│ OpenAI/Anthropic │
└───────────────┘   │   (Frontend +   │   │       API        │
                    │ Serverless API) │   └──────────────────┘
┌───────────────┐   │                 │
│   Firestore   │◄──│                 │
│   Database    │   └─────────────────┘
└───────────────┘          
```

### Core Technologies
- **Next.js**: Full-stack React framework for both frontend and API routes
- **Firebase Auth**: User authentication and management
- **Firestore**: NoSQL database for data storage
- **Vercel**: Hosting and serverless functions platform
- **OpenAI/Anthropic API**: AI service for problem transformation

## Database Schemas

AlgoIRL uses Firestore for data storage with the following collection designs:

### Problems Collection
```javascript
{
  "problemId": "two-sum", // Document ID
  "title": "Two Sum",
  "difficulty": "Easy",
  "category": "Array",
  "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
  "leetcodeLink": "https://leetcode.com/problems/two-sum/",
  "isBlind75": true
}
```

### Companies Collection
```javascript
{
  "companyId": "meta", // Document ID
  "name": "Meta",
  "description": "Social media and technology company focused on connecting people",
  "domain": "Social networking, VR/AR, advertising",
  "products": ["Facebook", "Instagram", "WhatsApp", "Oculus"],
  "technologies": ["React", "GraphQL", "PyTorch", "Distributed systems"]
}
```

### Scenarios Collection
```javascript
{
  "scenarioId": "550e8400-e29b-41d4-a716-446655440000", // Document ID
  "problemId": "two-sum",
  "companyId": "meta",
  "scenario": "You're working on the Instagram Explore page algorithm. Given a user's liked posts with engagement scores, find two posts whose engagement scores sum to the target threshold for recommended content.",
  "createdAt": "2025-05-01T12:34:56Z"
}
```

### Users Collection
```javascript
{
  "uid": "user123", // Document ID (from Firebase Auth)
  "email": "user@example.com",
  "createdAt": "2025-05-01T10:20:30Z"
}
```

### History Collection
```javascript
{
  "historyId": "7f6c74a0-8e9b-4ae0-a699-55e5fdca0001", // Document ID
  "userId": "user123",
  "scenarioId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-05-02T15:22:10Z",
  "notes": "Used a hash map to track complements, O(n) time complexity",
  "completed": true
}
```

## API Endpoints

AlgoIRL uses Next.js API routes for serverless backend functionality:

### Problems API

#### GET /api/problems
Retrieves a list of problems with optional filtering.

**Query Parameters:**
- `category` (optional): Filter by problem category
- `difficulty` (optional): Filter by difficulty level
- `limit` (optional): Maximum number of items to return

**Response:**
```json
{
  "problems": [
    {
      "problemId": "two-sum",
      "title": "Two Sum",
      "difficulty": "Easy",
      "category": "Array",
      "isBlind75": true
    },
    // More problems...
  ]
}
```

#### GET /api/problems/[id]
Retrieves details for a specific problem.

**Path Parameters:**
- `id`: Identifier of the problem

**Response:**
```json
{
  "problemId": "two-sum",
  "leetcodeLink": "https://leetcode.com/problems/two-sum/",
  "title": "Two Sum",
  "difficulty": "Easy",
  "category": "Array",
  "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
  "isBlind75": true
}
```

### Companies API

#### GET /api/companies
Retrieves a list of available companies.

**Response:**
```json
{
  "companies": [
    {
      "companyId": "meta",
      "name": "Meta",
      "description": "Social media and technology company"
    },
    // More companies...
  ]
}
```

#### GET /api/companies/[id]
Retrieves details for a specific company.

**Path Parameters:**
- `id`: Identifier of the company

**Response:**
```json
{
  "companyId": "meta",
  "name": "Meta",
  "description": "Social media and technology company focused on connecting people",
  "domain": "Social networking, VR/AR, advertising",
  "products": ["Facebook", "Instagram", "WhatsApp", "Oculus"],
  "technologies": ["React", "GraphQL", "PyTorch", "Distributed systems"]
}
```

### Scenarios API

#### POST /api/scenarios/generate
Generates a company-specific problem scenario.

**Request:**
```json
{
  "problemId": "two-sum",
  "companyId": "meta"
}
```

**Response:**
```json
{
  "scenarioId": "550e8400-e29b-41d4-a716-446655440000",
  "problemId": "two-sum",
  "companyId": "meta",
  "scenario": "You're working on the Instagram Explore page algorithm. Given a user's liked posts with engagement scores, find two posts whose engagement scores sum to the target threshold for recommended content.",
  "createdAt": "2025-05-01T12:34:56Z"
}
```

#### POST /api/scenarios/custom
Generates a scenario for a custom company.

**Request:**
```json
{
  "problemId": "two-sum",
  "customCompany": "Spotify"
}
```

**Response:**
```json
{
  "scenarioId": "550e8400-e29b-41d4-a716-446655440001",
  "problemId": "two-sum",
  "companyId": "custom-spotify",
  "scenario": "You're working on Spotify's playlist recommendation feature. Given a list of songs with their popularity scores, find two songs whose popularity scores sum to the target engagement value for the perfect playlist transition.",
  "createdAt": "2025-05-01T12:40:22Z"
}
```

### User History API

#### POST /api/history
Records a practice session.

**Request:**
```json
{
  "scenarioId": "550e8400-e29b-41d4-a716-446655440000",
  "notes": "Used a hash map to track complements, O(n) time complexity",
  "completed": true
}
```

**Response:**
```json
{
  "historyId": "7f6c74a0-8e9b-4ae0-a699-55e5fdca0001",
  "userId": "user123",
  "scenarioId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-05-02T15:22:10Z",
  "notes": "Used a hash map to track complements, O(n) time complexity",
  "completed": true
}
```

## Function Specifications

### Problem Repository Functions

#### getProblemsList
Retrieves a list of problems with optional filtering.

**Input:**
- `category` (optional): Filter by category
- `difficulty` (optional): Filter by difficulty
- `limit` (optional): Maximum number of items to return

**Output:**
- Array of problem objects

**Implementation:**
```javascript
export async function getProblemsList(options = {}) {
  const { category, difficulty, limit = 10 } = options;
  
  let query = firestore.collection('problems');
  
  if (category) {
    query = query.where('category', '==', category);
  }
  
  if (difficulty) {
    query = query.where('difficulty', '==', difficulty);
  }
  
  const snapshot = await query.limit(limit).get();
  return snapshot.docs.map(doc => ({ 
    problemId: doc.id, 
    ...doc.data() 
  }));
}
```

#### getProblemById
Retrieves a specific problem by ID.

**Input:**
- `problemId`: String identifier of the problem

**Output:**
- Problem details object

**Implementation:**
```javascript
export async function getProblemById(problemId) {
  const doc = await firestore.collection('problems').doc(problemId).get();
  
  if (!doc.exists) {
    throw new Error('Problem not found');
  }
  
  return {
    problemId: doc.id,
    ...doc.data()
  };
}
```

### Company Functions

#### getCompaniesList
Retrieves a list of available companies.

**Input:**
- `limit` (optional): Maximum number of items to return

**Output:**
- Array of company objects

**Implementation:**
```javascript
export async function getCompaniesList(limit = 10) {
  const snapshot = await firestore.collection('companies').limit(limit).get();
  
  return snapshot.docs.map(doc => ({
    companyId: doc.id,
    ...doc.data()
  }));
}
```

#### getCompanyById
Retrieves a specific company by ID.

**Input:**
- `companyId`: String identifier of the company

**Output:**
- Company details object

**Implementation:**
```javascript
export async function getCompanyById(companyId) {
  const doc = await firestore.collection('companies').doc(companyId).get();
  
  if (!doc.exists) {
    throw new Error('Company not found');
  }
  
  return {
    companyId: doc.id,
    ...doc.data()
  };
}
```

### Scenario Generation Functions

#### generateScenario
Generates a company-specific problem scenario.

**Input:**
- `problemId`: String identifier of the problem
- `companyId`: String identifier of the company

**Output:**
- Generated scenario object

**Implementation:**
```javascript
export async function generateScenario(problemId, companyId) {
  // Check cache first
  const cachedScenario = await checkScenarioCache(problemId, companyId);
  if (cachedScenario) {
    return cachedScenario;
  }
  
  // Get problem and company details
  const problem = await getProblemById(problemId);
  const company = await getCompanyById(companyId);
  
  // Generate scenario using AI
  const scenario = await callAIService(problem, company);
  
  // Store the scenario
  const scenarioData = {
    problemId,
    companyId,
    scenario,
    createdAt: new Date().toISOString()
  };
  
  const scenarioRef = await firestore.collection('scenarios').add(scenarioData);
  
  return {
    scenarioId: scenarioRef.id,
    ...scenarioData
  };
}
```

#### checkScenarioCache
Checks if a scenario already exists for a problem-company combination.

**Input:**
- `problemId`: String identifier of the problem
- `companyId`: String identifier of the company

**Output:**
- Cached scenario or null if not found

**Implementation:**
```javascript
export async function checkScenarioCache(problemId, companyId) {
  const snapshot = await firestore.collection('scenarios')
    .where('problemId', '==', problemId)
    .where('companyId', '==', companyId)
    .limit(1)
    .get();
    
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  return {
    scenarioId: doc.id,
    ...doc.data()
  };
}
```

### AI Service Function

#### callAIService
Calls the OpenAI/Anthropic API to generate a company-specific scenario.

**Input:**
- `problem`: Problem object with details
- `company`: Company object with details

**Output:**
- Generated scenario text

**Implementation:**
```javascript
export async function callAIService(problem, company) {
  const prompt = `
    Transform this coding problem into a realistic interview scenario for ${company.name}:
    
    Problem: ${problem.title}
    Description: ${problem.description}
    
    Company information:
    Name: ${company.name}
    Business domain: ${company.domain || "Unknown"}
    Products: ${company.products ? company.products.join(", ") : "Various products"}
    
    Create a real-world scenario that:
    1. Relates to ${company.name}'s business or products
    2. Requires solving the underlying algorithm problem (${problem.title})
    3. Is presented as an open-ended interview question without explicitly mentioning the algorithm name
    4. Includes relevant context a candidate might face in a real interview
  `;
  
  const response = await fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      prompt,
      max_tokens: 500,
      temperature: 0.7
    })
  });
  
  const data = await response.json();
  return data.choices[0].text.trim();
}
```

## Architecture Decisions

### Accelerated MVP Approach with Firebase + Vercel
**Decision:** Implement AlgoIRL using Firebase and Vercel for the initial MVP before migrating to AWS.

**Rationale:**
- Rapid development: Firebase and Vercel enable much faster implementation (2-week timeline)
- Simplified architecture: Fewer moving parts than a full AWS implementation
- Built-in authentication: Firebase Auth provides ready-made authentication
- Serverless by default: Next.js API routes and Vercel serverless functions are pre-configured
- Cost-effectiveness: Free tiers cover early development and testing

**Trade-offs:**
- Future migration effort to AWS will be required
- Less control over infrastructure compared to AWS
- Some features might need to be rebuilt during migration

### Next.js Full-Stack Approach
**Decision:** Use Next.js for both frontend and backend (API routes).

**Rationale:**
- Unified codebase: Frontend and backend in a single project
- TypeScript support: Strong typing across the entire application
- Server-side rendering: Improved SEO and initial load performance
- API routes: Built-in serverless backend functionality
- Fast development: Simplified deployment and configuration

**Trade-offs:**
- Some limitations in complex backend scenarios
- Less flexibility than separate frontend/backend services
- Potential cold start issues with serverless functions

### Firestore for Database
**Decision:** Use Firebase Firestore for data storage.

**Rationale:**
- Serverless database: No configuration or management required
- Real-time capabilities: Can add real-time updates in the future
- JSON document model: Natural fit for the application data
- Free tier: Generous free tier for MVP development
- Firebase integration: Seamless integration with other Firebase services

**Trade-offs:**
- More complex queries compared to SQL databases
- Limited transaction capabilities
- Migration effort to DynamoDB later

### OpenAI/Anthropic API for AI
**Decision:** Use OpenAI or Anthropic API directly for scenario generation.

**Rationale:**
- Quality results: State-of-the-art text generation capabilities
- Simple integration: RESTful API with clear documentation
- Prompt engineering flexibility: Direct control over prompts
- Pay-per-use: Only pay for what you use

**Trade-offs:**
- API costs scale with usage
- External dependency with potential rate limits
- Future migration to Amazon Bedrock required

## Security Considerations

### Authentication and Authorization
- **User Authentication:** Firebase Authentication handles user sign-up, sign-in, and token management
- **Session Management:** Client-side session management with Firebase Auth tokens
- **Authorization Checks:** Firestore security rules enforce user-level access control

### Data Protection
- **Data Encryption:** Firestore data is encrypted at rest by default
- **Transmission Security:** All API calls use HTTPS
- **Input Validation:** Server-side validation of all user inputs
- **Output Sanitization:** Careful handling of AI-generated content

### API Security
- **Rate Limiting:** Implement basic rate limiting for API endpoints
- **CORS Configuration:** Proper CORS headers to restrict access to authorized domains
- **Environment Variables:** Secure storage of API keys as environment variables in Vercel

### Frontend Security
- **CSP Headers:** Content Security Policy to prevent XSS attacks
- **Authentication State:** Proper handling of authentication state in React
- **Error Handling:** Careful error handling to prevent information leakage

## Monitoring and Operations

### Logging Strategy
- **Client-side Logging:** Basic error tracking in the browser
- **Server-side Logging:** Vercel function logs for API routes
- **Firebase Logging:** Firebase console for authentication and database events

### Monitoring
- **Vercel Analytics:** Basic monitoring of application performance
- **Error Tracking:** Implementation of a simple error tracking mechanism
- **Usage Metrics:** Track key user actions and API calls

### Deployment
- **Continuous Deployment:** Automatic deployments from GitHub via Vercel
- **Environment Strategy:** Development and production environments
- **Rollback Capability:** Vercel's deployment history for quick rollbacks

### Cost Management
- **Usage Monitoring:** Regular monitoring of Firebase and AI API usage
- **Caching Strategy:** Firestore caching to reduce redundant AI calls
- **Free Tier Utilization:** Stay within free tiers during MVP development

## AWS Migration Plan

The MVP will be built using Firebase and Vercel for rapid development, with a planned migration to AWS in Phase 3. The migration will include:

### Infrastructure Migration
- Deploy frontend to S3 + CloudFront
- Migrate authentication to Amazon Cognito
- Set up API Gateway and Lambda functions
- Implement DynamoDB for data storage
- Integrate with Amazon Bedrock for AI functionality

### Data Migration Strategy
- Export Firestore data to JSON
- Transform data for DynamoDB format
- Import data to DynamoDB tables
- Validate data integrity after migration

### Authentication Migration
- Export users from Firebase Auth
- Import users to Amazon Cognito
- Implement token migration strategy
- Update frontend to use Cognito authentication

### Code Adaptation
- Refactor API routes to Lambda functions
- Update database queries for DynamoDB
- Adapt AI service to use Amazon Bedrock
- Update frontend API client code

This migration approach allows for rapid initial development while providing a path to an enterprise-grade AWS architecture.
