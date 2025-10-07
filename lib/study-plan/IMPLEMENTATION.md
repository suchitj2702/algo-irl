# AlgoIRL Study Plan System - Complete Implementation Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Data Models](#data-models)
4. [Core Algorithms](#core-algorithms)
5. [API Specification](#api-specification)
6. [Frontend Integration](#frontend-integration)
7. [Performance](#performance)
8. [Deployment](#deployment)

---

## System Overview

### Purpose
The Study Plan System generates personalized, company-specific algorithm problem sets optimized for interview preparation. Students can select a target company, engineering role, timeline, and daily time commitment to receive a curated study schedule.

### Key Features
✅ **Company-Specific Prioritization**: Problems actually asked at the target company rank highest
✅ **Role Optimization**: Problems are scored for relevance to 5 engineering roles (Backend, ML, Frontend, Infrastructure, Security)
✅ **Topic Diversity**: Ensures broad coverage of data structures and algorithm patterns
✅ **Time-Based Scheduling**: Distributes problems across days based on difficulty and available hours
✅ **Smart Extrapolation**: Fills gaps with relevant problems when company data is sparse
✅ **Company Differentiation**: Same role at different companies yields different study plans

### Current System Stats
- **Problems Database**: ~2,000 LeetCode-style problems
- **Companies**: 20 companies in `companies-v2` collection
- **Company Data Structure**: 5 time-based sub-collections per company:
  - `thirtyDays` - Last 30 days
  - `threeMonths` - Last 3 months
  - `sixMonths` - Last 6 months
  - `moreThanSixMonths` - Older than 6 months
  - `all` - All problems ever asked
- **Roles**: 5 engineering role families

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Request                              │
│  (Company, Role, Timeline, Hours/Day, Difficulty, Topics)       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Cache Lookup (studyPlanCache)                  │
│                  Key: company-role-timeline-hours                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                ┌────────┴────────┐
                │                 │
         Cache Hit         Cache Miss
                │                 │
                ▼                 ▼
        ┌──────────────┐   ┌─────────────────────┐
        │ Return Cached│   │ Generate Fresh Plan │
        │  Study Plan  │   └──────────┬──────────┘
        └──────────────┘              │
                                      ▼
                        ┌─────────────────────────────┐
                        │  Load Problems & Role Scores│
                        │  (Optimized Collection Scan)│
                        └─────────────┬───────────────┘
                                      │
                        ┌─────────────▼───────────────┐
                        │ Calculate Hotness Scores    │
                        │  • Frequency (35%)          │
                        │  • Recency (25%)            │
                        │  • Role Relevance (25%)     │
                        │  • Company Context (15%)    │
                        └─────────────┬───────────────┘
                                      │
                        ┌─────────────▼───────────────┐
                        │ Select Diverse Problems     │
                        │  • Sort by hotness          │
                        │  • Apply diversity bonus    │
                        │  • Apply filters            │
                        └─────────────┬───────────────┘
                                      │
                        ┌─────────────▼───────────────┐
                        │ Generate Daily Schedule     │
                        │  • Allocate by time         │
                        │  • Difficulty progression   │
                        │  • Topic spacing            │
                        └─────────────┬───────────────┘
                                      │
                        ┌─────────────▼───────────────┐
                        │   Return Study Plan         │
                        └─────────────┬───────────────┘
                                      │
                        ┌─────────────▼───────────────┐
                        │  Async Cache Save           │
                        │  (Fire-and-Forget)          │
                        └─────────────────────────────┘
```

### Components

#### 1. **Study Plan Orchestrator** (`studyPlanOrchestrator.ts`)
- Main coordinator that ties all components together
- Pipeline: Validate → Check Cache → Load Company (if cache miss) → Select Problems → Generate Schedule
- Optimized cache-first approach (checks cache before loading company data)
- Returns complete study plan

#### 2. **Hotness Calculator** (`hotnessCalculator.ts`)
- Calculates 0-100 hotness score for each problem
- Combines 4 weighted components:
  - Frequency (35%)
  - Recency (25%)
  - Role Relevance (25%)
  - Company Context (15%)

#### 3. **Company Context Analyzer** (`companyContextAnalyzer.ts`)
- Differentiates problems across companies
- Analyzes tech stack overlap
- Matches domain concepts
- Identifies industry buzzwords

#### 4. **Problem Selector** (`problemSelector.ts`)
- Loads all problems with optimization
- Applies user filters
- Selects diverse problem set
- Ensures topic coverage

#### 5. **Schedule Generator** (`scheduleGenerator.ts`)
- Distributes problems across days
- Estimates completion time
- Balances difficulty progression
- Spaces similar topics

#### 6. **Cache Manager** (`cacheManager.ts`)
- Manages study plan caching
- Fire-and-forget async saves
- Cache invalidation logic

#### 7. **Request Cache** (`requestCache.ts`)
- In-memory request-level cache
- Speeds up repeated API calls
- Auto-expiring entries

---

## Data Models

### Firestore Collections

#### `problemRoleScores` (NEW)
Pre-computed role relevance scores for all problems.

```typescript
interface ProblemRoleScoreDocument {
  problemId: string;                    // e.g., "two-sum"

  roleScores: {
    backend: number;                    // 0-100
    ml: number;                         // 0-100
    frontend: number;                   // 0-100
    infrastructure: number;             // 0-100
    security: number;                   // 0-100
  };

  enrichedTopics: {
    dataStructures: string[];           // ["Array", "HashMap"]
    algorithmPatterns: string[];        // ["Two Pointers", "Hash Table Lookup"]
    domainConcepts: string[];           // ["Caching", "Indexing"]
    complexityClass: string;            // "Linear", "Logarithmic", etc.
    systemDesignRelevance: boolean;     // Does it relate to real systems?
  };

  computedAt: Timestamp;
  version: string;                      // "v1.0" for algorithm versioning
}
```

**Generation**: Computed via `scripts/compute-role-scores.ts` using Claude Sonnet 4.5

#### `studyPlanCache` (NEW)
Cached study plans for fast retrieval.

```typescript
interface StudyPlanCacheDocument {
  id: string;  // Format: "studyPlan-{companyId}-{role}-{timeline}-{hours}"

  // Cache key components
  companyId: string;
  roleFamily: "backend" | "ml" | "frontend" | "infrastructure" | "security";
  timeline: number;                     // Days
  hoursPerDay: number;

  // Cached study plan
  studyPlan: {
    totalProblems: number;
    estimatedHours: number;
    dailySchedule: DailyPlan[];
    metadata: {
      companyName: string;
      role: string;
      generatedAt: string;
      quality: {
        actualCompanyProblems: number;
        extrapolatedProblems: number;
        topicCoverage: number;
        avgHotnessScore: number;
      };
    };
  };

  problemIds: string[];                 // Ordered list

  // Cache metadata
  generatedAt: Timestamp;
  expiresAt: Timestamp;                 // TTL: 7 days
  version: string;                      // Cache format version
}
```

### TypeScript Types

#### Request Types (`data-types/studyPlan.ts`)

```typescript
export interface StudyPlanRequest {
  companyId: string;                    // Required
  roleFamily: RoleFamily;               // Required
  timeline: number;                     // Days (7, 14, 21, 30)
  hoursPerDay: number;                  // 1-8 hours

  // Optional filters
  difficultyPreference?: {
    easy?: boolean;
    medium?: boolean;
    hard?: boolean;
  };
  topicFocus?: string[];                // ["arrays", "graphs"]
}

export enum RoleFamily {
  BACKEND_SYSTEMS = 'backend',
  ML_DATA = 'ml',
  FRONTEND_FULLSTACK = 'frontend',
  INFRASTRUCTURE_PLATFORM = 'infrastructure',
  SECURITY_RELIABILITY = 'security'
}
```

#### Response Types

```typescript
export interface StudyPlanResponse {
  studyPlan: {
    totalProblems: number;
    estimatedHours: number;
    dailySchedule: DailyPlan[];
    metadata: StudyPlanMetadata;
  };
}

export interface DailyPlan {
  day: number;                          // 1-indexed
  date: string;                         // ISO 8601
  problems: EnrichedProblem[];
  estimatedHours: number;
  topics: string[];                     // Unique topics for the day
}

export interface EnrichedProblem {
  problemId: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";

  // Scoring breakdown
  hotnessScore: number;                 // 0-100
  hotnessBreakdown: {
    frequency: number;                  // Contribution from frequency
    recency: number;                    // Contribution from recency
    roleRelevance: number;              // Contribution from role
    companyContext: number;             // Contribution from context
  };

  // Company frequency data
  frequencyData: {
    overall: number;                    // Frequency rating (0-100)
    recency: string[];                  // Buckets: ["thirtyDays", "all"]
    isActuallyAsked: boolean;           // True if in company data
  };

  roleRelevance: number;                // 0-100 role score

  // Enhanced topics
  enrichedTopics: {
    dataStructures: string[];
    algorithmPatterns: string[];
    domainConcepts: string[];
    complexityClass: string;
  };

  estimatedTimeMinutes: number;         // Based on difficulty
  dayAssigned: number;

  // Optional: Pre-generated transformation
  transformedScenario?: {
    title: string;
    background: string;
  };
}

export interface StudyPlanMetadata {
  companyName: string;
  role: RoleFamily;
  generatedAt: string;
  quality: {
    actualCompanyProblems: number;      // Count from company data
    extrapolatedProblems: number;       // Count from problem bank
    topicCoverage: number;              // Unique topics count
  };
}
```

---

## Core Algorithms

### 1. Hotness Score Calculation

The hotness score determines problem priority using 4 weighted components.

**Formula**:
```
hotnessScore = (
  frequencyComponent * 0.35 +
  recencyComponent * 0.25 +
  roleRelevanceComponent * 0.25 +
  companyContextBoost * 0.15
) * 100

Result: 0-100
```

#### Component 1: Frequency (35%)

**For problems in company data**:
```typescript
frequencyComponent = problem.frequency / 100
// Example: frequency=85 → 0.85
```

**For extrapolated problems**:
```typescript
frequencyComponent = 0.3  // Conservative default
```

#### Component 2: Recency (25%)

Measures how recently the problem was asked.

```typescript
const recencyMultipliers = {
  thirtyDays: 1.0,           // Most recent
  threeMonths: 0.7,
  sixMonths: 0.4,
  moreThanSixMonths: 0.2,
  all: 0.5                   // Average
};

// Find which buckets the problem appears in
const buckets = determineRecencyBuckets(problemId, companyId);

// Take the highest (most recent)
recencyComponent = Math.max(
  ...buckets.map(b => recencyMultipliers[b])
);

// For extrapolated problems
recencyComponent = 0.3;
```

#### Component 3: Role Relevance (25%)

Uses pre-computed scores from `problemRoleScores` collection.

```typescript
const roleScoreDoc = await getProblemRoleScore(problemId);
roleRelevanceComponent = roleScoreDoc.roleScores[selectedRole] / 100;

// Example: Backend role, problem scores 85
// → roleRelevanceComponent = 0.85
```

#### Component 4: Company Context Boost (15%)

Differentiates problems across companies.

```typescript
companyContextBoost = (
  techStackMatch * 0.4 +
  domainConceptMatch * 0.4 +
  buzzwordMatch * 0.2
);

// Each sub-component: 0-1 scale
```

**Tech Stack Match**:
```typescript
// Check if problem description mentions company technologies
function calculateTechStackOverlap(
  problemDesc: string,
  companyTech: string[],
  techLayers?: Record<string, string[]>
): number {
  const problemWords = extractKeywords(problemDesc);
  let matches = 0;

  for (const tech of companyTech) {
    if (problemWords.includes(tech.toLowerCase())) {
      matches++;
    }
  }

  // Normalize to 0-1 (5 matches = perfect)
  return Math.min(1, matches / 5);
}
```

**Domain Concept Match**:
```typescript
// Check if problem concepts align with company challenges
function calculateDomainConceptMatch(
  problemConcepts: string[],           // From role scoring
  engineeringChallenges: Record<string, string[]>,
  problemDomains: string[]
): number {
  let score = 0;
  const allChallenges = Object.values(engineeringChallenges).flat();

  for (const concept of problemConcepts) {
    if (allChallenges.some(c => c.includes(concept))) {
      score += 0.3;  // Direct match
    }
    if (problemDomains.some(d => concept.includes(d))) {
      score += 0.2;  // Domain match
    }
  }

  return Math.min(1, score);
}
```

**Buzzword Match**:
```typescript
// Check industry-specific terminology
function calculateBuzzwordOverlap(
  problemDesc: string,
  buzzwords: string[]
): number {
  let matches = 0;
  for (const buzzword of buzzwords) {
    if (problemDesc.toLowerCase().includes(buzzword.toLowerCase())) {
      matches++;
    }
  }
  return Math.min(1, matches / 3);  // 3 matches = perfect
}
```

### 2. Diversity-Optimized Selection

Ensures broad topic coverage while respecting hotness scores.

```typescript
function selectDiverseProblems(
  rankedProblems: EnrichedProblem[],
  targetCount: number,
  topicFocus?: string[]
): EnrichedProblem[] {

  // User specified topics? Filter first
  if (topicFocus && topicFocus.length > 0) {
    rankedProblems = rankedProblems.filter(p =>
      p.enrichedTopics.dataStructures.some(t => topicFocus.includes(t))
    );
  }

  const selected: EnrichedProblem[] = [];
  const coveredTopics = new Set<string>();
  const coveredPatterns = new Set<string>();
  const candidates = [...rankedProblems];

  while (selected.length < targetCount && candidates.length > 0) {
    // Score with diversity bonus
    const scored = candidates.map(p => {
      const newTopics = p.enrichedTopics.dataStructures
        .filter(t => !coveredTopics.has(t));
      const newPatterns = p.enrichedTopics.algorithmPatterns
        .filter(t => !coveredPatterns.has(t));

      // 5 points per new topic/pattern (max 50)
      const diversityBonus = Math.min(50,
        (newTopics.length + newPatterns.length) * 5
      );

      return {
        problem: p,
        adjustedScore: p.hotnessScore + diversityBonus
      };
    });

    // Pick highest adjusted score
    scored.sort((a, b) => b.adjustedScore - a.adjustedScore);
    const best = scored[0].problem;

    selected.push(best);

    // Update covered sets
    best.enrichedTopics.dataStructures.forEach(t =>
      coveredTopics.add(t)
    );
    best.enrichedTopics.algorithmPatterns.forEach(t =>
      coveredPatterns.add(t)
    );

    // Remove from candidates
    candidates.splice(candidates.indexOf(best), 1);
  }

  return selected;
}
```

### 3. Time-Based Schedule Generation

Distributes problems across days based on available hours.

```typescript
function generateDailySchedule(
  problems: EnrichedProblem[],
  timeline: number,
  hoursPerDay: number
): DailyPlan[] {
  const minutesPerDay = hoursPerDay * 60;
  const schedule: DailyPlan[] = [];

  let currentDay = 1;
  let currentDayMinutes = 0;
  let currentDayProblems: EnrichedProblem[] = [];

  for (const problem of problems) {
    // Would exceed daily time? Start new day
    if (currentDayMinutes + problem.estimatedTimeMinutes > minutesPerDay) {
      schedule.push(createDailyPlan(currentDay, currentDayProblems));
      currentDay++;
      currentDayMinutes = 0;
      currentDayProblems = [];
    }

    currentDayProblems.push({
      ...problem,
      dayAssigned: currentDay
    });
    currentDayMinutes += problem.estimatedTimeMinutes;
  }

  // Push last day
  if (currentDayProblems.length > 0) {
    schedule.push(createDailyPlan(currentDay, currentDayProblems));
  }

  return schedule;
}

function createDailyPlan(
  day: number,
  problems: EnrichedProblem[]
): DailyPlan {
  const totalMinutes = problems.reduce(
    (sum, p) => sum + p.estimatedTimeMinutes, 0
  );

  const uniqueTopics = new Set<string>();
  problems.forEach(p => {
    p.enrichedTopics.dataStructures.forEach(t => uniqueTopics.add(t));
  });

  return {
    day,
    date: addDays(new Date(), day - 1).toISOString(),
    problems,
    estimatedHours: totalMinutes / 60,
    topics: Array.from(uniqueTopics)
  };
}
```

### 4. Estimated Time Calculation

Since `estimatedTimeMinutes` is not in the database, we compute it dynamically based on difficulty.

```typescript
function estimateTimeMinutes(difficulty: ProblemDifficulty): number {
  const baseMinutes = {
    Easy: 20,      // 20-30 minutes
    Medium: 35,    // 35-50 minutes
    Hard: 60       // 60-90 minutes
  };

  // Add ±25% randomness for realism
  const base = baseMinutes[difficulty];
  const variance = base * 0.25;
  const randomOffset = (Math.random() * 2 - 1) * variance;

  return Math.round(base + randomOffset);
}
```

---

## API Specification

### Endpoint: `POST /api/study-plan/generate`

Generates a personalized study plan for interview preparation.

#### Request

**Headers**:
```
Content-Type: application/json
X-Signature: <request signature>
X-Timestamp: <unix timestamp>
```

**Body**:
```json
{
  "companyId": "google",
  "roleFamily": "backend",
  "timeline": 14,
  "hoursPerDay": 2,
  "difficultyPreference": {
    "easy": true,
    "medium": true,
    "hard": false
  },
  "topicFocus": []
}
```

**Field Descriptions**:
- `companyId` (required): Company identifier from `companies-v2` collection
- `roleFamily` (required): One of: `backend`, `ml`, `frontend`, `infrastructure`, `security`
- `timeline` (required): Number of days for the study plan (1-90)
- `hoursPerDay` (required): Hours available per day (0.5-8)
- `difficultyPreference` (optional): Filter by difficulty levels
- `topicFocus` (optional): Specific topics to prioritize (e.g., `["arrays", "graphs"]`)

#### Response

**Success (200 OK)**:
```json
{
  "studyPlan": {
    "totalProblems": 26,
    "estimatedHours": 15.8,
    "dailySchedule": [
      {
        "day": 1,
        "date": "2025-10-07T00:00:00.000Z",
        "problems": [
          {
            "problemId": "two-sum",
            "title": "Two Sum",
            "difficulty": "Easy",
            "hotnessScore": 87,
            "hotnessBreakdown": {
              "frequency": 30,
              "recency": 25,
              "roleRelevance": 23,
              "companyContext": 9
            },
            "frequencyData": {
              "overall": 85,
              "recency": ["thirtyDays", "threeMonths"],
              "isActuallyAsked": true
            },
            "roleRelevance": 90,
            "enrichedTopics": {
              "dataStructures": ["Array", "HashMap"],
              "algorithmPatterns": ["Hash Table Lookup", "Single Pass"],
              "domainConcepts": ["Indexing", "Fast Retrieval"],
              "complexityClass": "Linear"
            },
            "estimatedTimeMinutes": 22,
            "dayAssigned": 1,
            "transformedScenario": {
              "title": "Find Matching Document IDs in Search Index",
              "background": "You're working on Google Search's indexing system..."
            }
          }
        ],
        "estimatedHours": 1.1,
        "topics": ["Arrays", "Hash Tables"]
      }
    ],
    "metadata": {
      "companyName": "Google",
      "role": "backend",
      "generatedAt": "2025-10-06T15:30:00Z",
      "quality": {
        "actualCompanyProblems": 18,
        "extrapolatedProblems": 8,
        "topicCoverage": 14
      }
    }
  }
}
```

**Error Responses**:

**400 Bad Request**:
```json
{
  "error": "Invalid request parameters",
  "details": {
    "companyId": "Company not found"
  }
}
```

**429 Too Many Requests**:
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

**500 Internal Server Error**:
```json
{
  "error": "Failed to generate study plan",
  "message": "Internal server error"
}
```

#### Rate Limiting
- **Limit**: 10 requests per minute per user
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Frontend Integration

### User Interface Components

#### 1. **Study Plan Configuration Form**

Required inputs:
- Company dropdown (populated from `/api/companies`)
- Role selection (5 radio buttons)
- Timeline slider (7, 14, 21, 30 days)
- Hours per day slider (1-8 hours)
- Difficulty checkboxes (Easy, Medium, Hard)
- Topic multi-select (optional)

#### 2. **Study Plan Overview Card**

Display fields:
```typescript
{
  totalProblems: 26,           // "26 problems"
  timeline: 14,                // "14 days"
  estimatedHours: 15.8,        // "~16 hours total"
  quality: {
    actualCompanyProblems: 18, // "18 actually asked at Google ✓"
    extrapolatedProblems: 8,   // "8 recommended for backend role"
    topicCoverage: 14,         // "Covers 14 unique topics"
    avgHotnessScore: 76        // "Average priority: 76/100 🔥"
  }
}
```

#### 3. **Daily Schedule View**

**Calendar/Timeline View**:
```
Day 1 (Oct 7) - 1.1 hours - 2 problems
  Topics: Arrays, Hash Tables

Day 2 (Oct 8) - 1.5 hours - 2 problems
  Topics: Linked Lists, Two Pointers
```

**Expandable Day Cards**:
- Click to expand and see problem details
- Progress tracking (checkboxes)
- Total time for the day

#### 4. **Problem Card**

```typescript
{
  title: "Two Sum",
  difficulty: "Easy",               // Badge color: Green
  hotnessScore: 87,                 // "🔥 87% Priority"
  isActuallyAsked: true,            // Badge: "✓ Asked at Google"
  roleRelevance: 90,                // "90% Backend Relevance"
  estimatedTimeMinutes: 22,         // "~22 min"
  transformedScenario: {
    title: "Find Matching Document IDs"  // Show company context
  }
}
```

**Visual Elements**:
- Hotness meter (progress bar 0-100)
- Company badge if `isActuallyAsked === true`
- Difficulty badge (color-coded)
- Topic tags (clickable chips)
- "Start Problem" button → navigate to problem page

**Hotness Score Explanation (Frontend Implementation)**:
When users hover over or click the hotness score, display a human-readable explanation:

```typescript
function explainHotnessScore(
  problem: EnrichedProblem
): string {
  const parts: string[] = [];
  const { hotnessBreakdown, frequencyData } = problem;

  if (frequencyData.isActuallyAsked) {
    parts.push('✓ Actually asked at company');
  } else {
    parts.push('○ Recommended based on role/company fit');
  }

  if (hotnessBreakdown.frequency >= 25) {
    parts.push(`High frequency (${hotnessBreakdown.frequency})`);
  }
  if (hotnessBreakdown.recency >= 20) {
    parts.push(`Recent (${hotnessBreakdown.recency})`);
  }
  if (hotnessBreakdown.roleRelevance >= 20) {
    parts.push(`Role-relevant (${hotnessBreakdown.roleRelevance})`);
  }
  if (hotnessBreakdown.companyContext >= 10) {
    parts.push(`Company fit (${hotnessBreakdown.companyContext})`);
  }

  return parts.join(' | ');
}
```

Example output: `"✓ Actually asked at company | High frequency (30) | Recent (25) | Role-relevant (21)"`

#### 5. **Progress Tracking** (Future)

```typescript
interface UserProgress {
  studyPlanId: string;
  completedProblems: string[];      // Problem IDs
  currentDay: number;
  completionPercentage: number;
  timeSpent: number;                // Minutes
}
```

**UI Features**:
- Mark problems as complete (checkbox)
- Show % completion per day
- Overall progress bar
- Time tracking (optional)

### API Integration Example

```typescript
// Frontend API call
async function generateStudyPlan(config: StudyPlanConfig) {
  const response = await fetch('/api/study-plan/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': Date.now().toString(),
      'X-Signature': generateSignature(config)
    },
    body: JSON.stringify(config)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const data = await response.json();
  return data.studyPlan;
}

// Usage in React component
const [studyPlan, setStudyPlan] = useState(null);
const [loading, setLoading] = useState(false);

const handleGenerate = async () => {
  setLoading(true);
  try {
    const plan = await generateStudyPlan({
      companyId: 'google',
      roleFamily: 'backend',
      timeline: 14,
      hoursPerDay: 2
    });
    setStudyPlan(plan);
  } catch (error) {
    console.error('Failed to generate study plan:', error);
  } finally {
    setLoading(false);
  }
};
```

---

## Performance

### Latency Targets

| Scenario | Target | Actual (v1.1.0) | Notes |
|----------|--------|-----------------|-------|
| **Cache Hit** | <100ms | ~50ms | Cache check before company load |
| **Cold Start** | <2s | 1-2s | Fresh generation (first time) |
| **Warm Start** | <1s | 500-800ms | After in-memory cache warm |

### Optimization Strategies

#### 1. In-Memory Request Cache

```typescript
// Caches all problems and role scores for 5 minutes
const REQUEST_CACHE = new Map<string, any>();

export function getCachedAllProblems(): Problem[] | null {
  return REQUEST_CACHE.get('all-problems') || null;
}

export function cacheAllProblems(problems: Problem[]) {
  REQUEST_CACHE.set('all-problems', problems);
  setTimeout(() => REQUEST_CACHE.delete('all-problems'), 5 * 60 * 1000);
}
```

#### 2. Firestore Collection Scanning

```typescript
// ✅ GOOD: Single collection scan (~500ms for 2000 docs)
const snapshot = await db.collection('problems').get();
const problems = snapshot.docs.map(doc => convertFirestoreToProblem(doc));

// ❌ BAD: Individual reads (~10-20s for 2000 docs)
const problems = await Promise.all(
  problemIds.map(id => getProblemById(id))
);
```

#### 3. Fire-and-Forget Cache Saves

```typescript
// Return to user immediately
const response = NextResponse.json(studyPlan);

// Save to cache in background (doesn't block response)
saveStudyPlanToCacheAsync(cacheKey, studyPlan)
  .catch(err => console.error('Cache save failed:', err));

return response;  // Already returned to user!
```

### Firestore Quotas

**Reads per study plan generation**:
- Cache hit: 1 read
- Cache miss: ~50 reads (1 cache check + 1 problems scan + 1 role scores scan)

**Estimated costs**:
- Cache hit: $0.00001 (negligible)
- Cache miss: $0.002 per generation
- Target cache hit rate: 60%+

---

## Deployment

### Environment Variables

```bash
# Required
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key

ANTHROPIC_API_KEY=your-anthropic-key  # For role scoring script
OPENAI_API_KEY=your-openai-key        # Alternative

# Optional
CACHE_VERSION=v1.0                    # For cache invalidation
ROLE_SCORE_VERSION=v1.0               # For role score versioning
```

### Firestore Indexes

Add to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "studyPlanCache",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "companyId", "order": "ASCENDING" },
        { "fieldPath": "roleFamily", "order": "ASCENDING" },
        { "fieldPath": "expiresAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "problemRoleScores",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "version", "order": "ASCENDING" },
        { "fieldPath": "computedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Deploy indexes:
```bash
firebase deploy --only firestore:indexes
```

### Firestore Rules

Add to `firestore.rules`:

```javascript
// Study plan cache - no direct client access
match /studyPlanCache/{planId} {
  allow read: if false;
  allow write: if false;
}

// Problem role scores - no direct client access
match /problemRoleScores/{scoreId} {
  allow read: if false;
  allow write: if false;
}
```

### Pre-Deployment Checklist

- [ ] Run `scripts/compute-role-scores.ts` to populate `problemRoleScores`
- [ ] Deploy Firestore indexes
- [ ] Update Firestore rules
- [ ] Test API endpoint locally
- [ ] Verify cache hit/miss logic
- [ ] Load test with 100 concurrent requests
- [ ] Set up monitoring for latency and errors
- [ ] Configure rate limiting
- [ ] Deploy to Vercel

---

## Monitoring & Metrics

### Key Metrics to Track

```typescript
{
  cacheHitRate: 0.82,             // 82% served from cache
  avgGenerationTime: 450,         // 450ms average
  avgHotnessScore: 74,            // Quality indicator
  topicCoverageRate: 0.85,        // Topic diversity
  p95Latency: 1200,               // 95th percentile
  errorRate: 0.002                // 0.2% errors
}
```

### Logging

```typescript
console.log('[StudyPlan] Generated', {
  companyId,
  roleFamily,
  timeline,
  totalProblems,
  avgHotnessScore,
  cacheHit: false,
  latencyMs: 847
});
```

### Alerts

Set up alerts for:
- Latency > 3s (p95)
- Error rate > 1%
- Cache hit rate < 40%
- Firestore quota exceeded

---

## Troubleshooting

### Common Issues

**Issue**: "No problems found for company"
- **Cause**: Company has no data in sub-collections
- **Fix**: Ensure extrapolation logic is working (should always return problems)

**Issue**: "All problems have same hotness score"
- **Cause**: Missing role scores or company context
- **Fix**: Verify `problemRoleScores` collection is populated

**Issue**: "Cache never hits"
- **Cause**: Cache key mismatch
- **Fix**: Verify cache key format matches exactly

**Issue**: "Latency > 5s"
- **Cause**: Not using collection scans
- **Fix**: Ensure request cache is populated

---

## Version History

- **v1.1.0** (2025-10-07): Performance and code quality improvements
  - ✅ Cache check moved before company data load (50ms faster cache hits)
  - ✅ Removed avgHotnessScore calculation (unused metric)
  - ✅ Deterministic time estimation using problem ID hash
  - ✅ Company problems added to request cache
  - ✅ Fixed cache key generation for consistent filter handling
  - ✅ Fixed type conversion chain (removed unsafe double casting)
  - ✅ Extracted topic collection helper to eliminate duplication
  - ✅ Removed dead code: `batchAnalyzeCompanyContext`, `getContextSummary`, `explainHotnessScore`
  - ✅ Fixed role score fallback (neutral defaults instead of skipping problems)

- **v1.0.0** (2025-10-06): Initial implementation
  - Hotness scoring with 4 components
  - Company context differentiation
  - Diversity optimization
  - Fire-and-forget caching

---

## Future Enhancements

1. **User Progress Tracking**: Save completed problems per user
2. **Adaptive Scheduling**: Adjust future days based on completion rate
3. **ML-Based Similarity**: Use embeddings for better problem extrapolation
4. **A/B Testing**: Test different scoring weights
5. **Weekly Reports**: Send progress summaries via email
6. **Social Features**: Share study plans with friends
7. **Interview Simulation**: Timed practice mode

---

**Document Version**: 1.0.0
**Last Updated**: October 6, 2025
**Author**: AlgoIRL Engineering Team
