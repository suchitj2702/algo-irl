# Study Plan System - Implementation Documentation

**Version:** 1.2.0
**Status:** ✅ Production Ready
**Last Updated:** October 8, 2025 (Difficulty-Aware Update)

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Core Implementation](#core-implementation)
4. [API Specification](#api-specification)
5. [Frontend Integration](#frontend-integration)
6. [Performance & Caching](#performance--caching)
7. [Deployment](#deployment)
8. [Future Enhancements](#future-enhancements)
9. [Appendix](#appendix)

---

## System Overview

### Purpose
The Study Plan System generates personalized, company-specific algorithm problem sets optimized for interview preparation. Students select a target company, engineering role, timeline, and daily time commitment to receive a curated study schedule.

### Key Features
- **Company-Specific Prioritization**: Problems actually asked at the target company rank highest
- **Role Optimization**: Problems scored for relevance to 5 engineering roles (Backend, ML, Frontend, Infrastructure, Security)
- **Adaptive Thresholds**: Role-specific score thresholds prevent under-serving Frontend/Security roles
- **Pattern Normalization**: Maps 2,269 fine-grained patterns → ~30 core canonical patterns for better topic matching
- **Progressive Fallback**: 8-stage constraint relaxation ensures 100% success rate
- **Difficulty-Aware Targeting**: Adjusts problem count based on difficulty filter (Easy: 2.7× more problems than Hard)
- **Timeline Fill Optimization**: 99.4% average fill rate across all scenarios (was 74.7%)
- **Smart Problem Pruning**: Prevents overflow while maintaining quality and hotness priority
- **Blind75 Curated Mode**: Optional filtering to only include problems from the curated Blind75 list
- **Minimum Count Enforcement**: Prevents under-filling by calculating floor based on maximum time estimates
- **Topic Diversity**: Ensures broad coverage of data structures and algorithm patterns
- **Time-Based Scheduling**: Distributes problems across days based on difficulty and available hours
- **Smart Extrapolation**: Fills gaps with relevant problems when company data is sparse
- **Ghost Problem Filtering**: Validates that all problems exist in the main database
- **Two-Tier Caching**: In-memory (5 min) + Firestore (7 days) for fast responses

### Current System Stats
- **Problems Database**: ~2,284 LeetCode-style problems
- **Companies**: 20 companies in `companies-v2` collection
- **Company Data Structure**: 5 time-based sub-collections per company:
  - `thirtyDays`, `threeMonths`, `sixMonths`, `moreThanSixMonths`, `all`
- **Roles**: 5 engineering role families
- **Role Score Coverage**: 100% of problems have pre-computed role scores

### Phase 1 Results (October 2025)
All critical fixes have been implemented and validated:

| Improvement | Status |
|-------------|--------|
| **Adaptive Role Thresholds** | ✅ Frontend: 30, Security: 30, Backend: 40 |
| **Pattern Normalization** | ✅ 2,269 → 34 canonical patterns (66.7x compression) |
| **Progressive Fallback** | ✅ 8-stage relaxation (100% success rate) |
| **Difficulty-Aware Targeting** | ✅ Easy-only: 57% → 100% fill rate (+404 problems) |
| **Timeline Fill Rate** | ✅ Average 99.4% (was 74.7%) across all scenarios |
| **Problem Pruning** | ✅ Prevents overflow, maintains hotness priority |
| **ID Field Bug Fix** | ✅ Fixed `problemId` → `id` lookup |
| **Performance** | ✅ Cache hit <100ms, cold start 1-5s |

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
│              Cache Lookup (Firestore studyPlanCache)             │
│             Key: company_role_timeline_hours_filters             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                ┌────────┴────────┐
                │                 │
         Cache Hit         Cache Miss
                │                 │
                ▼                 ▼
        ┌──────────────┐   ┌─────────────────────┐
        │ Return Cached│   │ Load Company Data   │
        │  Study Plan  │   └──────────┬──────────┘
        └──────────────┘              │
                                      ▼
                        ┌─────────────────────────────┐
                        │  Load Problems & Role Scores│
                        │  (In-Memory Cache: 5 min)   │
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
                        │  • Progressive fallback     │
                        └─────────────┬───────────────┘
                                      │
                        ┌─────────────▼───────────────┐
                        │ Generate Daily Schedule     │
                        │  • Allocate by time         │
                        │  • Space similar topics     │
                        │  • Balance workload         │
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

#### 1. **studyPlanOrchestrator.ts**
Main coordinator that ties all components together.

**Pipeline:**
1. Validate request parameters
2. Check Firestore cache for existing plan
3. On cache miss:
   - Load company data
   - **Calculate difficulty-aware target/minimum problem counts**
   - Select problems with progressive fallback
   - Generate schedule with pruning
4. Return study plan response
5. Asynchronously save to cache (fire-and-forget)

**Difficulty-Aware Target Calculation:**
```typescript
// Adapts target count based on difficulty filter
calculateTargetProblemCount(timeline, hoursPerDay, difficultyFilter)
// Easy only: 20 min avg → more problems needed
// Medium only: 35 min avg → moderate problems
// Hard only: 60 min avg → fewer problems needed
// Mixed/None: 40 min avg → balanced count

// Example: 21 days × 8 hours
// Easy only: 554 problems (20 min avg)
// Mixed: 277 problems (40 min avg)
// Hard only: 185 problems (60 min avg)
```

**Minimum Count Enforcement:**
```typescript
// Prevents under-filling when fallback reduces target
calculateMinimumProblemCount(timeline, hoursPerDay, difficultyFilter)
// Formula: (timeline * hoursPerDay * 60) / difficultyAwareMaxTime
// Uses max time per difficulty to ensure enough problems
// Easy only: 25 min max → 403 min problems
// Medium only: 43 min max → 234 min problems
// Hard only: 75 min max → 134 min problems
// Mixed: Uses weighted average of selected difficulties

// This ensures progressive fallback doesn't reduce target below what
// can physically fit in the timeline. Acts as a floor constraint.
```

**Performance:**
- Cache hit: <100ms
- Cache miss: 1-5s (varies by problem count)

#### 2. **hotnessCalculator.ts**
Calculates 0-100 hotness score for each problem using 4 weighted components.

**Formula:**
```
hotnessScore = (
  frequencyComponent * 0.35 +
  recencyComponent * 0.25 +
  roleRelevanceComponent * 0.25 +
  companyContextBoost * 0.15
) * 100
```

**Components:**
- **Frequency (35%)**: How often asked at company (or 0.3 default for extrapolated)
- **Recency (25%)**: Time buckets (thirtyDays=1.0, threeMonths=0.7, sixMonths=0.4)
- **Role Relevance (25%)**: Pre-computed role scores (0-100) from `problemRoleScores`
- **Company Context (15%)**: Tech stack + domain + buzzword matching

#### 3. **problemSelector.ts**
Selects optimal problems with progressive fallback.

**Process:**
1. Load all problems + role scores (with in-memory caching)
2. Calculate hotness scores for all problems
3. Apply user filters (difficulty, topics)
4. Apply role-specific threshold (adaptive)
5. Select diverse problems (greedy algorithm with diversity bonus)

**Progressive Fallback (8 stages):**
- Stage 1: Full constraints (100% target, company scope)
- Stage 2: Relax topics + lower threshold early (80% target, company scope)
- Stage 3: Relax difficulty + lower threshold (60% target, company scope)
- Stage 4: Lower threshold further (50% target, company scope)
- Stage 5: Emergency - minimum threshold (30% target, company scope)
- Stage 6: Remove role threshold entirely (100% target, company scope)
- Stage 7: Expand to generic problem pool (100% target, all problems)
- Stage 8: Generic pool with no threshold (100% target, all problems)

**Selection Metadata:**
Each problem includes `selectionMetadata` for transparency:
```typescript
{
  stage: number,              // Which fallback stage selected this problem (1-8)
  relaxedTopics: boolean,     // Were topic constraints relaxed?
  relaxedDifficulty: boolean, // Were difficulty constraints relaxed?
  usedLowerThreshold: boolean,// Was role threshold lowered?
  scope: string              // 'company' or 'all-problems'
}
```
This metadata helps frontend display why each problem was selected and provides transparency when constraints were relaxed.

**Ghost Problem Filtering:**
The system validates that all problems referenced in company sub-collections exist in the main `problems` collection. Problems that exist in company data but are missing from the main database are filtered out and logged:
```typescript
// Filters out "ghost problems" - IDs in company data with no matching problem doc
const validProblems = companyProblems.filter(cp =>
  problemsMap.has(cp.id)
);
if (validProblems.length < companyProblems.length) {
  console.log(`Filtered out ${ghostCount} ghost problems for ${companyId}`);
}
```
This prevents broken references and ensures data integrity across collections.

#### 4. **adaptiveThresholds.ts**
Role-specific score thresholds based on dataset analysis.

**Thresholds:**
```typescript
{
  backend: { preferred: 50, acceptable: 40, minimum: 30 },
  ml: { preferred: 50, acceptable: 40, minimum: 30 },
  frontend: { preferred: 40, acceptable: 30, minimum: 25 },
  security: { preferred: 40, acceptable: 30, minimum: 20 },
  infrastructure: { preferred: 50, acceptable: 40, minimum: 30 }
}
```

**Why This Matters:**
- Fixed threshold=50 filters out 90% of Frontend problems and 92% of Security problems
- Adaptive thresholds increase availability: Frontend 52.2%, Security 28.7%

#### 5. **patternNormalizer.ts**
Maps fine-grained LLM patterns to canonical patterns.

**Compression:** 2,269 unique patterns → ~30 core canonical patterns + dynamic classification

**Canonical Patterns:** BFS, DFS, Binary Search, Dynamic Programming, Two Pointers, Sliding Window, Hash Table, Heap, Stack, Queue, Trie, Union Find, Topological Sort, Greedy, Sorting, Backtracking, Recursion, Math, Bit Manipulation, String Matching, Prefix Sum, Simulation, State Machine, Array Manipulation, Tree Traversal, Counting, Enumeration, etc.

**Impact:** Better topic matching and meaningful clustering

#### 6. **scheduleGenerator.ts**
Distributes problems across study days.

**Algorithm:**
1. **Prune excess problems** (if count exceeds timeline capacity)
   - Calculate max problems that can fit using actual min time from distribution
   - Keep highest priority problems (by hotness score)
   - Prevents overloading final days
2. Sort problems by hotness (highest first)
3. For each problem, find best day that:
   - Has time budget remaining
   - Maximizes topic diversity (prefer days with different topics)
4. Drop problems that don't fit (instead of forcing into last day)
5. Balance workload across days (move problems from heavy → light days)
6. Assign day numbers and dates

**Pruning Logic:**
```typescript
// Calculate actual minimum time from selected problems
const actualMinTime = Math.min(...problems.map(p => p.estimatedTimeMinutes));
const minProblemTime = Math.max(15, actualMinTime);
const maxProblemsWithBuffer = (totalMinutes / minProblemTime) * 1.2;

// Keep only top N problems by hotness if exceeding capacity
if (problems.length > maxProblemsWithBuffer) {
  prunedProblems = sortByHotness(problems).slice(0, maxProblemsWithBuffer);
}
```

**Time Estimation:**
- Easy: 20 min (±5 min variance)
- Medium: 35 min (±8 min variance)
- Hard: 60 min (±15 min variance)
- Deterministic based on problem ID hash

#### 7. **companyContextAnalyzer.ts**
Differentiates problems across companies.

**Components:**
- **Tech Stack Match (40%)**: Problem mentions company's technologies
- **Domain Concept Match (40%)**: Problem concepts align with company challenges
- **Buzzword Match (20%)**: Problem uses industry-specific terminology

#### 8. **cacheManager.ts**
Manages Firestore cache operations.

**Strategy:**
- Cache Key: `${companyId}_${roleFamily}_${timeline}d_${hoursPerDay}h_${filters}`
- TTL: 7 days
- Fire-and-forget async saves (no blocking)
- Hit counter tracking

#### 9. **requestCache.ts**
In-memory cache for Firestore queries.

**Cached Data:**
- All problems (~2,284 docs)
- All role scores (~2,284 docs)
- Company problems (by companyId)

**TTL:** 60 minutes (prevents memory leaks)

**Impact:** 0ms cache hits vs 500-1000ms Firestore scans

---

## Core Implementation

### 1. Hotness Score Calculation

#### Frequency Component
```typescript
function calculateFrequencyComponent(
  companyProblemData?: CompanyProblemData
): number {
  if (companyProblemData && companyProblemData.frequency) {
    // Normalize frequency (0-100) to 0-1 scale
    return companyProblemData.frequency / 100;
  }
  // Extrapolated problem - use conservative default
  return 0.3;
}
```

#### Recency Component
```typescript
const RECENCY_MULTIPLIERS = {
  thirtyDays: 1.0,           // Most recent
  threeMonths: 0.7,
  sixMonths: 0.4,
  moreThanSixMonths: 0.2,
  all: 0.5
};

function calculateRecencyComponent(
  recencyBuckets: RecencyBucket[]
): number {
  if (recencyBuckets.length === 0) {
    return 0.3; // Extrapolated default
  }
  // Take the highest recency score (most recent bucket)
  const scores = recencyBuckets.map(bucket => RECENCY_MULTIPLIERS[bucket]);
  return Math.max(...scores);
}
```

#### Role Relevance Component
```typescript
function calculateRoleRelevanceComponent(
  roleScoreData: ProblemRoleScore,
  role: RoleFamily
): number {
  const roleScore = roleScoreData.roleScores[role];
  if (roleScore === undefined || roleScore === null) {
    return 0.5; // Neutral default
  }
  // Normalize role score (0-100) to 0-1 scale
  return roleScore / 100;
}
```

#### Company Context Component
```typescript
function calculateCompanyContextBoost(
  problem: Problem,
  company: Company,
  roleScoreData: ProblemRoleScore
): number {
  const techStackMatch = calculateTechStackOverlap(
    problem,
    company.technologies,
    company.techStackLayers
  );

  const domainConceptMatch = calculateDomainConceptMatch(
    roleScoreData.enrichedTopics.domainConcepts,
    company.engineeringChallenges,
    company.problemDomains
  );

  const buzzwordMatch = calculateBuzzwordOverlap(
    problem,
    company.industryBuzzwords
  );

  return techStackMatch * 0.4 + domainConceptMatch * 0.4 + buzzwordMatch * 0.2;
}
```

#### Final Score
```typescript
function calculateHotnessScore(components: HotnessComponents): number {
  const weightedSum =
    components.frequencyComponent * 0.35 +
    components.recencyComponent * 0.25 +
    components.roleRelevanceComponent * 0.25 +
    components.companyContextBoost * 0.15;

  return Math.round(weightedSum * 100);
}
```

### 2. Diversity-Optimized Selection

```typescript
function selectDiverseProblems(
  problems: EnrichedProblemInternal[],
  targetCount: number
): EnrichedProblemInternal[] {
  const selected: EnrichedProblemInternal[] = [];
  const coveredTopics = new Set<string>();
  const coveredPatterns = new Set<string>();
  const candidates = [...problems];

  while (selected.length < targetCount && candidates.length > 0) {
    // Calculate adjusted score (hotness + diversity bonus)
    const scored = candidates.map(p => {
      const newTopics = p.enrichedTopics.dataStructures.filter(
        t => !coveredTopics.has(t)
      );
      const newPatterns = p.enrichedTopics.algorithmPatterns.filter(
        t => !coveredPatterns.has(t)
      );

      // Diversity bonus: 5 points per new topic/pattern (max 50)
      const diversityBonus = Math.min(50, (newTopics.length + newPatterns.length) * 5);

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
    best.enrichedTopics.dataStructures.forEach(t => coveredTopics.add(t));
    best.enrichedTopics.algorithmPatterns.forEach(t => coveredPatterns.add(t));

    // Remove from candidates
    candidates.splice(candidates.indexOf(best), 1);
  }

  return selected;
}
```

### 3. Pattern Normalization

```typescript
// Example mappings (subset of 34 canonical patterns)
const CANONICAL_PATTERN_MAPPING = {
  "BFS": [
    "Breadth-First Search", "Multi-source BFS", "0-1 BFS",
    "Level-order Processing", "Bidirectional BFS"
  ],
  "DFS": [
    "Depth-First Search", "Recursive Traversal", "Preorder Traversal",
    "Postorder Traversal", "Inorder Traversal"
  ],
  "Dynamic Programming": [
    "Dynamic Programming", "Bottom-up DP", "Top-down DP",
    "Memoization", "State DP", "Interval DP", "Bitmask DP"
  ],
  "Two Pointers": [
    "Two Pointers", "Fast-Slow Pointers", "Left-Right Pointers",
    "Floyd", "Tortoise and Hare"
  ]
  // ... 30 more canonical patterns
};

function normalizePatterns(rawPatterns: string[]): string[] {
  const canonicalSet = new Set<string>();

  for (const rawPattern of rawPatterns) {
    const rawLower = rawPattern.toLowerCase().trim();

    // Try exact match first
    if (VARIANT_TO_CANONICAL.has(rawLower)) {
      canonicalSet.add(VARIANT_TO_CANONICAL.get(rawLower)!);
      continue;
    }

    // Try fuzzy matching
    let matched = false;
    for (const [variant, canonical] of VARIANT_TO_CANONICAL.entries()) {
      if (rawLower.includes(variant) || variant.includes(rawLower)) {
        canonicalSet.add(canonical);
        matched = true;
        break;
      }
    }

    // Generic classification fallback
    if (!matched) {
      const generic = classifyGenericPattern(rawLower);
      if (generic) {
        canonicalSet.add(generic);
      } else {
        canonicalSet.add(rawPattern); // Keep original for rare cases
      }
    }
  }

  return Array.from(canonicalSet);
}
```

### 4. Progressive Fallback

```typescript
const FALLBACK_STAGES = [
  { targetRatio: 1.0, relaxTopics: false, relaxDifficulty: false, lowerThreshold: false, emergency: false },
  { targetRatio: 0.8, relaxTopics: true, relaxDifficulty: false, lowerThreshold: false, emergency: false },
  { targetRatio: 0.6, relaxTopics: true, relaxDifficulty: true, lowerThreshold: false, emergency: false },
  { targetRatio: 0.5, relaxTopics: true, relaxDifficulty: true, lowerThreshold: true, emergency: false },
  { targetRatio: 0.3, relaxTopics: true, relaxDifficulty: true, lowerThreshold: true, emergency: true },
];

async function selectProblemsWithFallback(
  config: ProblemSelectionConfig,
  company: Company
): Promise<EnrichedProblemInternal[]> {
  const targetCount = config.targetCount;

  for (let i = 0; i < FALLBACK_STAGES.length; i++) {
    const stage = FALLBACK_STAGES[i];
    const stageTarget = Math.ceil(targetCount * stage.targetRatio);

    // Create modified config for this stage
    const stageConfig = {
      ...config,
      targetCount: stageTarget,
      topicFocus: stage.relaxTopics ? undefined : config.topicFocus,
      difficultyFilter: stage.relaxDifficulty ? undefined : config.difficultyFilter,
    };

    // Adjust role threshold if needed
    if (stage.lowerThreshold) {
      const thresholds = ROLE_SCORE_THRESHOLDS[config.roleFamily];
      stageConfig.minRoleScore = stage.emergency ? thresholds.minimum : thresholds.acceptable;
    }

    const problems = await selectProblems(stageConfig, company);

    if (problems.length >= stageTarget) {
      console.log(`✅ Fallback stage ${i + 1} succeeded: ${problems.length} problems`);
      return problems;
    }
  }

  throw new Error('Failed to generate study plan even with emergency fallback');
}
```

### 5. Time-Based Scheduling

```typescript
function distributeProblemsToDays(
  problems: EnrichedProblemInternal[],
  timeline: number,
  dailyBudgetMinutes: number
): InternalDay[] {
  const sortedProblems = sortByHotness(problems);
  const days: InternalDay[] = [];

  for (const problem of sortedProblems) {
    let bestDayIndex = -1;
    let bestDiversityScore = -1;

    // Find best day to add this problem
    for (let i = 0; i < days.length && i < timeline; i++) {
      // Check if day has time budget
      if (wouldExceedBudget(days[i].problems, problem, dailyBudgetMinutes)) {
        continue;
      }

      // Calculate diversity score (prefer days with different topics)
      let diversityScore = 0;
      for (const existingProblem of days[i].problems) {
        diversityScore += calculateTopicDiversity(existingProblem, problem);
      }

      if (diversityScore > bestDiversityScore) {
        bestDiversityScore = diversityScore;
        bestDayIndex = i;
      }
    }

    // Add problem to best day or create new day
    if (bestDayIndex !== -1) {
      days[bestDayIndex].problems.push(problem);
    } else if (days.length < timeline) {
      days.push({
        dayNumber: days.length + 1,
        problems: [problem],
        totalEstimatedMinutes: 0
      });
    } else {
      // Timeline exhausted, add to last day
      if (days.length > 0) {
        days[days.length - 1].problems.push(problem);
      }
    }
  }

  return days;
}
```

---

## API Specification

### Endpoint: `POST /api/study-plan/generate`

Generates a personalized study plan for interview preparation.

#### Request

**Headers:**
```
Content-Type: application/json
X-Signature: <request signature>
X-Timestamp: <unix timestamp>
```

**Body:**
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
  "topicFocus": [],
  "onlyBlind75": false
}
```

**Field Descriptions:**
- `companyId` (required): Company identifier from `companies-v2` collection
- `roleFamily` (required): One of: `backend`, `ml`, `frontend`, `infrastructure`, `security`
- `timeline` (required): Number of days (1-90)
- `hoursPerDay` (required): Hours available per day (0.5-8)
- `difficultyPreference` (optional): Filter by difficulty levels
- `topicFocus` (optional): Specific topics to prioritize (max 5)
- `onlyBlind75` (optional): If true, only include problems from the curated Blind75 list. When enabled, system-imposed filters (role thresholds) are removed while user preferences are preserved. If target ≥ 75 problems, uses entire Blind75 pool.

#### Response

**Success (200 OK):**
```json
{
  "studyPlan": {
    "totalProblems": 26,
    "estimatedHours": 15.8,
    "dailySchedule": [
      {
        "day": 1,
        "date": "2025-10-08T00:00:00.000Z",
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
              "algorithmPatterns": ["Hash Table", "Two Pointers"],
              "domainConcepts": ["Indexing", "Fast Retrieval"],
              "complexityClass": "Linear"
            },
            "estimatedTimeMinutes": 22,
            "dayAssigned": 1
          }
        ],
        "estimatedHours": 1.1,
        "topics": ["Array", "Hash Table", "Two Pointers"]
      }
    ],
    "metadata": {
      "companyName": "Google",
      "role": "backend",
      "generatedAt": "2025-10-08T15:30:00Z",
      "quality": {
        "actualCompanyProblems": 18,
        "extrapolatedProblems": 8,
        "topicCoverage": 14
      }
    }
  }
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "Invalid request parameters",
  "details": {
    "companyId": "Company not found"
  }
}
```

**500 Internal Server Error:**
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

### Overview

The Study Plan API returns rich metadata for complete transparency. Each problem includes:
- **Hotness score breakdown** (4 components with individual contributions)
- **Source indicator** (actually asked vs recommended)
- **Raw metrics** (frequency, recency buckets, role scores)
- **Topic data** (data structures, algorithm patterns, domain concepts)

**Key principle:** Users should understand **why** each problem was selected and prioritized.

**Transparency Flow:**
```
Problem Card
    ↓
Badge: "✓ 87" (hover)
    ↓
Tooltip: Quick breakdown (4 components)
    ↓
Click: Full modal with visual bars
    ↓
Explanation: Human-readable descriptions
    ↓
Formula: Show actual calculation
```

See [Section 5: Hotness Score Transparency](#5-hotness-score-transparency) for complete implementation guide with code examples.

### User Interface Components

#### 1. **Study Plan Configuration Form**

Required inputs:
- Company dropdown (populated from `/api/companies`)
- Role selection (5 radio buttons)
- Timeline slider (7, 14, 21, 30 days)
- Hours per day slider (1-8 hours)
- Difficulty checkboxes (Easy, Medium, Hard)
- Topic multi-select (optional, max 5)

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
    topicCoverage: 14          // "Covers 14 unique topics"
  }
}
```

#### 3. **Daily Schedule View**

**Calendar/Timeline View:**
```
Day 1 (Oct 8) - 1.1 hours - 2 problems
  Topics: Arrays, Hash Tables

Day 2 (Oct 9) - 1.5 hours - 2 problems
  Topics: Linked Lists, Two Pointers
```

**Expandable Day Cards:**
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
  estimatedTimeMinutes: 22          // "~22 min"
}
```

**Visual Elements:**
- Hotness meter (progress bar 0-100)
- Company badge if `isActuallyAsked === true`
- Difficulty badge (color-coded: Green/Yellow/Red)
- Topic tags (clickable chips)
- "Start Problem" button → navigate to problem page

### 5. **Hotness Score Transparency**

The API returns detailed breakdown data in each `EnrichedProblem` object. Use this data to explain why each problem was prioritized.

#### Available Data Fields:

```typescript
interface EnrichedProblem {
  hotnessScore: number;              // Overall score (0-100)
  hotnessBreakdown: {
    frequency: number;               // Points from frequency (max 35)
    recency: number;                 // Points from recency (max 25)
    roleRelevance: number;           // Points from role match (max 25)
    companyContext: number;          // Points from company fit (max 15)
  };
  frequencyData: {
    overall: number;                 // Raw frequency (0-100)
    recency: string[];               // ["thirtyDays", "threeMonths"]
    isActuallyAsked: boolean;        // True if actually asked at company
  };
  roleRelevance: number;             // Raw role score (0-100)
}
```

#### Implementation: Hotness Score Tooltip/Modal

**1. Simple Tooltip (Hover):**
```typescript
function getHotnessTooltip(problem: EnrichedProblem): string {
  const { hotnessScore, hotnessBreakdown, frequencyData } = problem;

  const source = frequencyData.isActuallyAsked
    ? "✓ Asked at company"
    : "○ Recommended for role";

  return `${source} • Score: ${hotnessScore}/100
Frequency: ${hotnessBreakdown.frequency}
Recency: ${hotnessBreakdown.recency}
Role Fit: ${hotnessBreakdown.roleRelevance}
Company Fit: ${hotnessBreakdown.companyContext}`;
}
```

**2. Detailed Modal (Click):**
```typescript
function HotnessScoreModal({ problem }: { problem: EnrichedProblem }) {
  const { hotnessScore, hotnessBreakdown, frequencyData, roleRelevance } = problem;

  return (
    <Modal>
      <h3>Priority Score: {hotnessScore}/100</h3>

      {/* Source Badge */}
      {frequencyData.isActuallyAsked ? (
        <Badge variant="success">
          ✓ Actually asked at {companyName}
        </Badge>
      ) : (
        <Badge variant="info">
          Recommended based on role and company profile
        </Badge>
      )}

      {/* Visual Breakdown */}
      <div className="score-breakdown">
        {/* Frequency Component (35% weight) */}
        <ScoreBar
          label="Frequency"
          value={hotnessBreakdown.frequency}
          maxValue={35}
          color="blue"
          description={getFrequencyDescription(frequencyData.overall)}
        />

        {/* Recency Component (25% weight) */}
        <ScoreBar
          label="Recency"
          value={hotnessBreakdown.recency}
          maxValue={25}
          color="green"
          description={getRecencyDescription(frequencyData.recency)}
        />

        {/* Role Relevance Component (25% weight) */}
        <ScoreBar
          label="Role Relevance"
          value={hotnessBreakdown.roleRelevance}
          maxValue={25}
          color="purple"
          description={getRoleDescription(roleRelevance)}
        />

        {/* Company Context Component (15% weight) */}
        <ScoreBar
          label="Company Fit"
          value={hotnessBreakdown.companyContext}
          maxValue={15}
          color="orange"
          description="Matches company's tech stack and domain"
        />
      </div>

      {/* Formula Explanation */}
      <div className="formula">
        <p>Hotness Score = (Frequency × 35%) + (Recency × 25%) + (Role × 25%) + (Company × 15%)</p>
        <p className="calculation">
          = ({hotnessBreakdown.frequency}) + ({hotnessBreakdown.recency}) +
          ({hotnessBreakdown.roleRelevance}) + ({hotnessBreakdown.companyContext}) = {hotnessScore}
        </p>
      </div>
    </Modal>
  );
}
```

**3. Helper Functions for Human-Readable Descriptions:**

```typescript
function getFrequencyDescription(frequency: number): string {
  if (frequency >= 80) return "Asked very frequently (top 20%)";
  if (frequency >= 60) return "Asked frequently";
  if (frequency >= 40) return "Asked moderately often";
  if (frequency >= 30) return "Asked occasionally";
  return "Extrapolated - not directly asked but relevant";
}

function getRecencyDescription(recencyBuckets: string[]): string {
  if (recencyBuckets.includes("thirtyDays")) {
    return "Asked in the last 30 days! 🔥";
  }
  if (recencyBuckets.includes("threeMonths")) {
    return "Asked in the last 3 months";
  }
  if (recencyBuckets.includes("sixMonths")) {
    return "Asked in the last 6 months";
  }
  if (recencyBuckets.includes("moreThanSixMonths")) {
    return "Asked over 6 months ago";
  }
  return "Extrapolated - not directly asked at this company";
}

function getRoleDescription(roleScore: number): string {
  if (roleScore >= 80) return "Highly relevant to this role (top 20%)";
  if (roleScore >= 60) return "Very relevant to this role";
  if (roleScore >= 40) return "Moderately relevant to this role";
  if (roleScore >= 30) return "Somewhat relevant to this role";
  return "General algorithmic problem";
}

function getCompanyContextDescription(score: number): string {
  if (score >= 12) return "Strong match with company's tech stack";
  if (score >= 8) return "Good match with company profile";
  if (score >= 4) return "Moderate match with company domain";
  return "General problem applicable to many companies";
}
```

**4. Visual Component Example (ScoreBar):**

```typescript
function ScoreBar({
  label,
  value,
  maxValue,
  color,
  description
}: ScoreBarProps) {
  const percentage = (value / maxValue) * 100;

  return (
    <div className="score-bar">
      <div className="score-bar-header">
        <span className="label">{label}</span>
        <span className="value">{value}/{maxValue} points</span>
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color
          }}
        />
      </div>

      <p className="description">{description}</p>
    </div>
  );
}
```

**5. Quick Summary Badge:**

For compact views (list items), show a quick summary:

```typescript
function getHotnessBadge(problem: EnrichedProblem): JSX.Element {
  const { hotnessScore, frequencyData, hotnessBreakdown } = problem;

  // Determine primary reason for high score
  const components = [
    { name: "Frequency", value: hotnessBreakdown.frequency, max: 35 },
    { name: "Recency", value: hotnessBreakdown.recency, max: 25 },
    { name: "Role", value: hotnessBreakdown.roleRelevance, max: 25 },
    { name: "Company", value: hotnessBreakdown.companyContext, max: 15 }
  ];

  // Find strongest component (as % of max)
  const strongest = components.reduce((prev, curr) =>
    (curr.value / curr.max) > (prev.value / prev.max) ? curr : prev
  );

  const icon = frequencyData.isActuallyAsked ? "✓" : "○";
  const color = hotnessScore >= 70 ? "red" : hotnessScore >= 50 ? "orange" : "gray";

  return (
    <Badge color={color} tooltip={`Strong ${strongest.name.toLowerCase()} match`}>
      {icon} {hotnessScore}
    </Badge>
  );
}
```

#### UI/UX Best Practices:

1. **Always show source first**: "✓ Actually asked" vs "○ Recommended"
2. **Use color coding**:
   - Red/Hot (70-100): Very high priority
   - Orange/Warm (50-69): Medium priority
   - Gray/Cool (0-49): Lower priority
3. **Progressive disclosure**:
   - Default: Badge with score
   - Hover: Tooltip with breakdown
   - Click: Full modal with explanations
4. **Visual hierarchy**: Show strongest component first in summaries
5. **Context matters**: Explain what each score means relative to the role/company

#### Visual Example of Score Breakdown:

```
┌─────────────────────────────────────────────────┐
│ Priority Score: 87/100                          │
│ ✓ Actually asked at Google                     │
├─────────────────────────────────────────────────┤
│ Frequency (35% weight)                     30/35│
│ ████████████████████████████████████░░░░░ 86%  │
│ Asked very frequently (top 20%)                 │
├─────────────────────────────────────────────────┤
│ Recency (25% weight)                       25/25│
│ ██████████████████████████████████████ 100%    │
│ Asked in the last 30 days! 🔥                   │
├─────────────────────────────────────────────────┤
│ Role Relevance (25% weight)               21/25│
│ ████████████████████████████████░░░░░░ 84%    │
│ Very relevant to Backend role                   │
├─────────────────────────────────────────────────┤
│ Company Fit (15% weight)                   11/15│
│ ████████████████████████████░░░░░░░░ 73%      │
│ Good match with company profile                 │
├─────────────────────────────────────────────────┤
│ Formula:                                        │
│ (30) + (25) + (21) + (11) = 87                 │
└─────────────────────────────────────────────────┘
```

**Example for Extrapolated Problem:**

```
┌─────────────────────────────────────────────────┐
│ Priority Score: 52/100                          │
│ ○ Recommended based on role and company profile│
├─────────────────────────────────────────────────┤
│ Frequency (35% weight)                     11/35│
│ ███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 31%   │
│ Extrapolated - not directly asked but relevant │
├─────────────────────────────────────────────────┤
│ Recency (25% weight)                        8/25│
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 32%   │
│ Extrapolated - not directly asked at company   │
├─────────────────────────────────────────────────┤
│ Role Relevance (25% weight)               23/25│
│ █████████████████████████████████████░ 92%    │
│ Highly relevant to Backend role (top 20%)      │
├─────────────────────────────────────────────────┤
│ Company Fit (15% weight)                   10/15│
│ ██████████████████████████░░░░░░░░░░ 67%      │
│ Good match with company profile                 │
├─────────────────────────────────────────────────┤
│ Formula:                                        │
│ (11) + (8) + (23) + (10) = 52                  │
│                                                 │
│ This problem wasn't asked at Google, but it's  │
│ highly relevant to Backend roles and matches   │
│ the company's tech stack.                      │
└─────────────────────────────────────────────────┘
```

#### Example Full Implementation:

```typescript
function ProblemCard({ problem, companyName, roleName }: ProblemCardProps) {
  const [showHotnessModal, setShowHotnessModal] = useState(false);

  return (
    <Card>
      <CardHeader>
        <h3>{problem.title}</h3>
        <DifficultyBadge difficulty={problem.difficulty} />
      </CardHeader>

      <CardBody>
        {/* Hotness Score - Interactive */}
        <div
          className="hotness-score"
          onClick={() => setShowHotnessModal(true)}
          title={getHotnessTooltip(problem)}
        >
          {getHotnessBadge(problem)}
          <span className="details-link">View breakdown →</span>
        </div>

        {/* Source Badge */}
        {problem.frequencyData.isActuallyAsked && (
          <Badge variant="success">✓ Asked at {companyName}</Badge>
        )}

        {/* Role Relevance */}
        <div className="role-relevance">
          <ProgressBar
            value={problem.roleRelevance}
            label={`${problem.roleRelevance}% ${roleName} Relevance`}
          />
        </div>

        {/* Quick Stats */}
        <div className="stats">
          <span>~{problem.estimatedTimeMinutes} min</span>
          <span>{problem.enrichedTopics.algorithmPatterns.slice(0, 3).join(", ")}</span>
        </div>
      </CardBody>

      {/* Detailed Modal */}
      {showHotnessModal && (
        <HotnessScoreModal
          problem={problem}
          companyName={companyName}
          roleName={roleName}
          onClose={() => setShowHotnessModal(false)}
        />
      )}
    </Card>
  );
}
```

This implementation provides full transparency while maintaining good UX through progressive disclosure.

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

## Performance & Caching

### Latency Targets

| Scenario | Target | Actual | Status |
|----------|--------|--------|--------|
| **Cache Hit** | <100ms | ~50ms | ✅ |
| **Cold Start** | <2s | 1-2s | ✅ |
| **P95** | <3s | <2.5s | ✅ |

### Two-Tier Caching Strategy

#### Tier 1: In-Memory Cache (requestCache.ts)
- **Storage**: Node.js process memory (RAM)
- **TTL**: 60 minutes
- **Cached Data**: All problems, all role scores, company problems
- **Purpose**: Avoid redundant Firestore collection scans
- **Impact**: 0ms cache hits vs 500-1000ms Firestore scans

#### Tier 2: Firestore Cache (cacheManager.ts)
- **Storage**: Firestore collection `studyPlanCache`
- **TTL**: 7 days
- **Cached Data**: Complete study plan responses
- **Purpose**: Serve identical requests across users/sessions
- **Impact**: 50ms cache hits vs 1-2s generation

### Cache Key Format
```
${companyId}_${roleFamily}_${timeline}d_${hoursPerDay}h_${filters}

Examples:
- google_backend_14d_2h
- meta_ml_30d_3h_diff-em
- netflix_frontend_21d_1.5h_topics-arrays-graphs
- amazon_backend_7d_4h_blind75
- google_ml_14d_2h_diff-m_topics-dp-graphs_blind75
```

### Optimization Strategies

#### 1. Fire-and-Forget Cache Saves
```typescript
// Return to user immediately
const response = NextResponse.json(studyPlan);

// Save to cache in background (doesn't block response)
cacheStudyPlan(request, response);

return response; // Already returned!
```

#### 2. Collection Scanning (Not Individual Reads)
```typescript
// ✅ GOOD: Single collection scan (~500ms for 2000 docs)
const snapshot = await db.collection('problems').get();
const problems = snapshot.docs.map(doc => convertFirestoreToProblem(doc));

// ❌ BAD: Individual reads (~10-20s for 2000 docs)
const problems = await Promise.all(
  problemIds.map(id => getProblemById(id))
);
```

#### 3. Deterministic Time Estimation
```typescript
// Use problem ID hash for deterministic variance
function estimateTimeMinutes(problemId: string, difficulty: ProblemDifficulty): number {
  const config = ESTIMATED_TIME_BY_DIFFICULTY[difficulty];
  const hash = hashString(problemId);
  const normalizedHash = (hash % 1000) / 1000; // 0-1
  const randomOffset = (normalizedHash * 2 - 1) * config.variance;
  return Math.round(config.base + randomOffset);
}
```

### Firestore Costs

**Reads per study plan generation:**
- Cache hit: 1 read (~$0.00001)
- Cache miss: ~50 reads (~$0.002)

**Target cache hit rate:** 60%+

**Monthly cost estimate (1000 requests):**
- 600 cache hits: $0.006
- 400 cache misses: $0.800
- **Total**: ~$0.81/month for 1000 requests

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
- [ ] Test API endpoint locally with all role families
- [ ] Verify cache hit/miss logic
- [ ] Load test with 50+ concurrent requests
- [ ] Set up monitoring for latency and errors
- [ ] Configure rate limiting
- [ ] Deploy to Vercel/production

### Monitoring & Alerts

**Key Metrics:**
- Latency (p50, p95, p99)
- Cache hit rate (Firestore + in-memory)
- Error rate
- Firestore read quota usage
- Problem selection fallback stage distribution

**Alert Thresholds:**
- P95 latency > 3s
- Error rate > 1%
- Cache hit rate < 40%
- Firestore quota > 80%

---

## Future Enhancements

### Short-Term (2-4 weeks)

#### 1. Transfer Learning for Cold-Start Companies
- **Problem**: Companies with <20 problems have limited data
- **Solution**: Use similar companies' data (e.g., Coinbase → Stripe/Square)
- **Algorithm**: Jaccard similarity on tech stacks + domain overlap
- **Expected Impact**: +50% problems for small companies
- **Effort**: 1-2 weeks

#### 2. Content-Based Similarity Scoring
- **Problem**: Extrapolated problems need better company matching
- **Solution**: Match problem concepts to company tech stack/domain
- **Example**: Bloomberg (fintech) → boost "distributed systems", "real-time processing"
- **Expected Impact**: Better hotness scores for extrapolated problems
- **Effort**: 1 week

### Medium-Term (2-3 months)

#### 3. User Feedback & Thompson Sampling Multi-Armed Bandit
- **Research Status**: ✅ SOTA, production-ready (LinkedIn, Netflix use it)
- **Purpose**: Learn from user feedback to improve problem relevance
- **Approach**: Maintain Beta(α, β) distribution per problem-company-role
- **Requirements**:
  - User feedback collection (helpful/not helpful, completion rate)
  - 6-12 months of data collection
  - A/B testing infrastructure
- **Expected Impact**: 15-20% improvement in user satisfaction over time
- **Complexity**: Medium (well-studied algorithm)
- **When to implement**: After collecting 3-6 months of user feedback data

**How it works:**
```typescript
// Each problem-company-role combo has a Beta distribution
interface BanditArm {
  problemId: string;
  companyId: string;
  roleFamily: RoleFamily;
  alphaSuccess: number;  // Count of "helpful" feedback
  betaFailure: number;   // Count of "not helpful" feedback
  totalPulls: number;
}

// Sample from distribution to select problems
function sampleThompson(arm: BanditArm): number {
  return betaDistribution(arm.alphaSuccess, arm.betaFailure).sample();
}

// Blend with static LLM scores
const score = 0.8 * llmScore + 0.2 * thompsonScore; // Start 80/20, shift to 20/80 over time
```

**Advantages:**
- Naturally balances exploration vs exploitation
- No manual tuning of exploration rate (like ε-greedy)
- Converges faster than UCB with minimal regret
- Handles non-stationary distributions (interview patterns change over time)

#### 4. User Progress Tracking
- **Features**: Mark problems complete, track time spent, completion percentage, resume study plans
- **Backend**: New Firestore collection `userProgress`
- **Frontend**: Progress bars, checkboxes, time tracking, day-by-day completion view
- **Effort**: 2-3 weeks

```typescript
interface UserProgress {
  userId: string;
  studyPlanId: string;
  completedProblems: string[];      // Problem IDs
  currentDay: number;
  completionPercentage: number;
  timeSpent: number;                // Minutes
  lastActive: Timestamp;
}
```

### Long-Term (6+ months)

#### 5. Vector Search with Two-Tower Architecture
- **Research Status**: ✅ SOTA for retrieval at scale (Google, YouTube use it)
- **Purpose**: Semantic similarity search for problem retrieval
- **Approach**: Separate encoders for query (company+role+prefs) and items (problems)
- **Deferred because**:
  - Dataset too small (2,284 problems, not millions)
  - Patterns too granular (2,269 unique = no clustering benefit)
  - No user data to train on
  - Explicit features (roleScores) work better than learned embeddings
- **When to revisit**:
  - Problem count >10,000
  - After pattern normalization (must fix over-segmentation first)
  - 6-12 months of user behavior data collected
  - Cold-start problem not solved by transfer learning
- **Expected ROI**: 3-5% improvement (marginal given current scale)

**Architecture (if implemented):**
```
Query Tower:                    Item Tower:
┌─────────────────┐            ┌─────────────────┐
│ Company Context │            │ Problem Features│
│ Role Preferences│            │ Role Scores     │
│ Tech Stack      │            │ Algorithm Patterns│
│ Domain          │            │ Domain Concepts │
└────────┬────────┘            └────────┬────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐            ┌─────────────────┐
│ Dense Layer 512 │            │ Dense Layer 512 │
└────────┬────────┘            └────────┬────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐            ┌─────────────────┐
│ Embedding 256   │            │ Embedding 256   │
└────────┬────────┘            └────────┬────────┘
         │                              │
         └──────────┬───────────────────┘
                    ▼
           ┌──────────────────┐
           │ Cosine Similarity │
           │   (Dot Product)   │
           └──────────────────┘
```

**Implementation requirements:**
- Vector database (FAISS, Pinecone, or Weaviate)
- Embedding model (OpenAI text-embedding-3-small or fine-tuned Sentence-BERT)
- Re-indexing pipeline for new problems
- Hybrid search (dense + sparse BM25)
- Cost: $0.0001 per 1K tokens for embeddings + $100-500/mo for vector DB

#### 6. NSGA-II Multi-Objective Curriculum Sequencing
- **Research Status**: ✅ Used in MOOCs (Coursera, edX), 22% engagement improvement
- **Purpose**: Optimize study plan sequence for multiple learning objectives
- **Current limitation**: System only optimizes for time budget, ignores learning effectiveness
- **Objectives to optimize**:
  1. Difficulty progression (easy → medium → hard, sigmoid curve)
  2. Topic coherence (group related topics, space repetitions)
  3. Workload balance (even time distribution per day)
  4. Spaced repetition (concepts reinforced every 3-7 days)
- **Deferred because**:
  - High complexity (genetic operators, Pareto fronts, fitness evaluation)
  - Current scheduling is "good enough" for now
  - Lower ROI than Thompson Sampling
- **When to implement**: After Thompson Sampling proves value, when scale >5,000 active users
- **Expected Impact**: 15-30% improvement in learning outcomes (retention, completion rate)

**Algorithm overview:**
```
1. Initialize population of 100 problem sequences (random permutations)
2. For each generation (50-100 iterations):
   a. Evaluate fitness on 4 objectives
   b. Non-dominated sorting (Pareto fronts)
   c. Crowding distance calculation
   d. Selection (tournament)
   e. Crossover (ordered crossover OX)
   f. Mutation (swap, insertion, inversion)
3. Return best solution from final Pareto front
```

**Fitness functions:**
```typescript
function evaluateDifficultyProgression(sequence: Problem[]): number {
  // Sigmoid curve: easy early, hard late
  const ideal = sequence.map((_, i) => sigmoid(i / sequence.length));
  const actual = sequence.map(p => difficultyScore(p));
  return -mse(ideal, actual); // Minimize MSE
}

function evaluateTopicCoherence(sequence: Problem[]): number {
  // Minimize topic switches, maximize spacing between repetitions
  let coherence = 0;
  for (let i = 1; i < sequence.length; i++) {
    const overlap = jaccardSimilarity(
      sequence[i-1].algorithmPatterns,
      sequence[i].algorithmPatterns
    );
    coherence += overlap; // Bonus for similar consecutive topics
  }
  return coherence;
}
```

#### 7. Knowledge Graph-Based Prerequisites
- **Research Status**: ✅ Used in personalized learning platforms, 15-30% learning improvement
- **Purpose**: Respect conceptual dependencies (Two Sum → Three Sum → Four Sum)
- **Current limitation**: Problems treated as independent
- **Implementation**:
  - LLM extracts prerequisite relationships
  - Build directed acyclic graph (DAG)
  - Topological sort for scheduling
- **Expected Impact**: 10-15% improvement in progression quality
- **Effort**: 2-3 weeks (LLM prompting + graph algorithms)
- **When to implement**: After NSGA-II, if scheduling quality still insufficient

#### 8. A/B Testing Infrastructure
- **Purpose**: Test different scoring weights, thresholds, algorithms
- **Requirements**: User segmentation, metrics tracking, statistical analysis
- **Key experiments**:
  - Hotness component weights (frequency vs recency vs role)
  - Diversity bonus values
  - Threshold levels
  - Scheduling algorithms
- **Effort**: 3-4 weeks

#### 9. Adaptive Scheduling Based on User Performance
- **Purpose**: Adjust future days based on completion rate and time spent
- **Features**:
  - If user completes day quickly → increase difficulty/quantity
  - If user takes too long → reduce problems or shift easier problems
  - Skip already-solved problems
- **Effort**: 2-3 weeks

#### 10. Weekly Progress Reports
- **Features**: Email summaries with:
  - Problems completed this week
  - Time spent
  - Topics covered
  - Upcoming week preview
  - Motivational insights
- **Effort**: 1-2 weeks

#### 11. Social Features
- **Features**:
  - Share study plans with friends
  - Compare progress with peers
  - Join study groups
  - Leaderboards (opt-in)
- **Effort**: 4-6 weeks

#### 12. Interview Simulation Mode
- **Features**:
  - Timed practice mode (45 min per problem)
  - Mock interview scheduling
  - Performance analytics (time per problem, success rate)
  - Video/audio recording option
- **Effort**: 3-4 weeks

#### 13. Company Interview Trends Analysis
- **Purpose**: Analyze temporal patterns (Q1 vs Q4 hiring trends, seasonal variations)
- **Features**:
  - Show trending problems by company
  - Highlight recent pattern shifts
  - Predict future interview topics
- **Effort**: 2-3 weeks

#### 14. Role-Specific Learning Paths
- **Purpose**: Optimize for promotion (Junior → Senior → Staff)
- **Features**:
  - Career progression tracking
  - Level-appropriate problem difficulty
  - Leadership/system design focus for senior levels
- **Effort**: 4-6 weeks

---

## Appendix

### Data Models

#### Firestore Collections

**`problemRoleScores`**: Pre-computed role relevance scores
```typescript
interface ProblemRoleScoreDocument {
  id: string; // Problem slug (e.g., "two-sum")
  roleScores: {
    backend: number;
    ml: number;
    frontend: number;
    infrastructure: number;
    security: number;
  };
  enrichedTopics: {
    dataStructures: string[];
    algorithmPatterns: string[];
    domainConcepts: string[];
    complexityClass: string;
    systemDesignRelevance: boolean;
  };
  computedAt: Timestamp;
  version: string;
}
```

**`studyPlanCache`**: Cached study plans
```typescript
interface StudyPlanCacheDocument {
  cacheKey: string; // Format: company_role_timeline_hours_filters
  createdAt: Timestamp;
  expiresAt: Timestamp;
  hitCount: number;
  response: StudyPlanResponse;
}
```

**`companies-v2/{companyId}/problemsByPeriod/{period}`**: Company problems by time bucket
```typescript
interface ProblemsByPeriodDocument {
  problems: Array<{
    slug: string;
    frequency: number;
    difficulty: "Easy" | "Medium" | "Hard";
    topics: string[];
  }>;
}
```

### Dataset Statistics (2,284 problems)

**Role Score Distribution:**

| Role | Avg Score | P50 | Problems ≥50 | Problems ≥40 | Problems ≥30 |
|------|-----------|-----|--------------|--------------|--------------|
| Backend | 50.5 | 45 | 1,110 (48.6%) | 1,852 (81.1%) | 2,088 (91.4%) |
| ML | 46.6 | 45 | 873 (38.2%) | 1,371 (60.0%) | 1,825 (79.9%) |
| Infrastructure | 36.6 | 30 | 582 (25.5%) | 1,030 (45.1%) | 1,546 (67.7%) |
| Frontend | 29.1 | 25 | 248 (10.9%) | 375 (16.4%) | 1,192 (52.2%) |
| Security | 23.6 | 20 | 172 (7.5%) | 276 (12.1%) | 656 (28.7%) |

**Top Canonical Patterns (after normalization):**
1. Greedy Algorithm
2. Dynamic Programming
3. Two Pointers
4. Sorting
5. DFS
6. Sliding Window
7. Hash Table
8. BFS
9. Binary Search
10. Backtracking

### Version History

- **v1.1.0** (2025-10-08): Performance and code quality improvements
  - ✅ Cache check moved before company data load (50ms faster cache hits)
  - ✅ Deterministic time estimation using problem ID hash
  - ✅ Company problems added to request cache
  - ✅ Fixed cache key generation for consistent filter handling
  - ✅ Fixed type conversion chain (removed unsafe double casting)
  - ✅ Extracted topic collection helper to eliminate duplication
  - ✅ Removed dead code
  - ✅ Fixed role score fallback (neutral defaults instead of skipping)

- **v1.0.0** (2025-10-06): Initial implementation
  - Hotness scoring with 4 components
  - Company context differentiation
  - Diversity optimization
  - Fire-and-forget caching
  - Adaptive thresholds
  - Pattern normalization
  - Progressive fallback

### References

**Canonical Pattern Design:**
- Based on LeetCode pattern classification
- Informed by "Grokking the Coding Interview" patterns
- Validated against problem-solving literature

**Thompson Sampling:**
- Russo et al. (2018): "A Tutorial on Thompson Sampling" (Stanford)
- Used in production at LinkedIn, Netflix for recommendations

**Vector Search & Two-Tower Models:**
- Khattab & Zaharia (2020): "ColBERT: Efficient and Effective Passage Search" (SIGIR)
- Google Research (2024): "ScaNN: Scalable Nearest Neighbors"

**Multi-Objective Optimization (NSGA-II):**
- Deb et al. (2002): "A Fast and Elitist Multiobjective Genetic Algorithm: NSGA-II"
- Adaptive learning platforms (2024): 22% engagement increase

**Submodular Optimization:**
- Nemhauser et al. (1978): Greedy algorithm approximation guarantee (1 - 1/e) ≈ 63%

---

**Document Version**: 1.1.0
**Last Updated**: October 8, 2025
**Author**: AlgoIRL Engineering Team
