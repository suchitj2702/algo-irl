/**
 * Pattern Normalizer
 *
 * Maps fine-grained LLM-generated algorithm patterns to canonical patterns.
 *
 * Problem: LLM generates 2,269 unique patterns across 2,284 problems (over-segmented)
 * Solution: Map to ~50 canonical patterns for meaningful clustering and better topic matching
 *
 * Coverage: 41.4% exact/fuzzy match, rest classified generically
 * Compression: 66.7x (2,269 → 34 canonical patterns)
 */

/**
 * Canonical pattern mapping
 * Key: Canonical pattern name
 * Value: Array of variant patterns that should map to this canonical pattern
 */
const CANONICAL_PATTERN_MAPPING: Record<string, string[]> = {
  // ===== SEARCH & TRAVERSAL =====
  "BFS": [
    "Breadth-First Search",
    "Multi-source BFS",
    "0-1 BFS",
    "Level-order Processing",
    "Level Order Traversal",
    "BFS Traversal",
    "Bidirectional BFS",
    "BFS",
  ],

  "DFS": [
    "Depth-First Search",
    "Recursive Traversal",
    "DFS Traversal",
    "Preorder Traversal",
    "Postorder Traversal",
    "Inorder Traversal",
    "DFS",
  ],

  "Binary Search": [
    "Binary Search",
    "Binary Search on Answer",
    "Bisection Method",
    "Lower Bound",
    "Upper Bound",
  ],

  // ===== DYNAMIC PROGRAMMING =====
  "Dynamic Programming": [
    "Dynamic Programming",
    "Bottom-up DP",
    "Top-down DP",
    "Memoization",
    "State DP",
    "Interval DP",
    "Tree DP",
    "Digit DP",
    "Bitmask DP",
    "DP",
  ],

  // ===== TWO POINTERS & SLIDING WINDOW =====
  "Two Pointers": [
    "Two Pointers",
    "Fast-Slow Pointers",
    "Left-Right Pointers",
    "Opposite Direction",
    "Floyd",
    "Tortoise and Hare",
  ],

  "Sliding Window": [
    "Sliding Window",
    "Fixed Window",
    "Variable Window",
  ],

  // ===== DATA STRUCTURES =====
  "Hash Table": [
    "Hash Table",
    "Hash Map",
    "Frequency Counting",
    "Frequency Map",
    "Counter",
    "Dictionary",
  ],

  "Heap": [
    "Heap",
    "Min Heap",
    "Max Heap",
    "Priority Queue",
    "K-way Merge",
  ],

  "Stack": [
    "Stack",
    "Monotonic Stack",
  ],

  "Queue": [
    "Queue",
    "Deque",
    "Monotonic Queue",
  ],

  "Trie": [
    "Trie",
    "Prefix Tree",
  ],

  // ===== GRAPH ALGORITHMS =====
  "Union Find": [
    "Union Find",
    "Disjoint Set",
    "DSU",
  ],

  "Topological Sort": [
    "Topological Sort",
    "Kahn",
  ],

  "Shortest Path": [
    "Shortest Path",
    "Dijkstra",
    "Bellman-Ford",
    "Floyd-Warshall",
    "SPFA",
  ],

  "Graph Traversal": [
    "Graph Traversal",
    "Graph Search",
    "Connected Components",
  ],

  // ===== GREEDY & SORTING =====
  "Greedy": [
    "Greedy",
    "Interval Scheduling",
  ],

  "Sorting": [
    "Sorting",
    "Custom Sort",
  ],

  // ===== BACKTRACKING & RECURSION =====
  "Backtracking": [
    "Backtracking",
    "Exhaustive Search",
    "State Space Exploration",
    "Constraint Satisfaction",
  ],

  "Recursion": [
    "Recursion",
    "Recursive",
    "Divide and Conquer",
  ],

  // ===== MATH & BIT MANIPULATION =====
  "Math": [
    "Math",
    "Mathematical",
    "Number Theory",
    "Modular Arithmetic",
    "Prime Factorization",
    "GCD",
    "LCM",
  ],

  "Bit Manipulation": [
    "Bit Manipulation",
    "Bitwise",
    "Bit Mask",
    "XOR",
  ],

  // ===== STRING ALGORITHMS =====
  "String Matching": [
    "String Matching",
    "Pattern Matching",
    "KMP",
    "Rabin-Karp",
  ],

  "String Processing": [
    "String Processing",
    "String Manipulation",
    "Text Processing",
  ],

  // ===== OTHER PATTERNS =====
  "Prefix Sum": [
    "Prefix Sum",
    "Cumulative Sum",
    "Range Sum",
    "2D Prefix Sum",
  ],

  "Simulation": [
    "Simulation",
  ],

  "State Machine": [
    "State Machine",
    "FSM",
  ],

  "Array Manipulation": [
    "Array Manipulation",
    "Array Traversal",
    "In-place",
  ],

  "Tree Traversal": [
    "Tree Traversal",
  ],

  "Counting": [
    "Counting",
  ],

  "Enumeration": [
    "Enumeration",
    "Brute Force",
  ],
};

/**
 * Reverse mapping for fast lookup
 * Key: Variant pattern (lowercase)
 * Value: Canonical pattern
 */
const VARIANT_TO_CANONICAL: Map<string, string> = new Map();

// Build reverse mapping
for (const [canonical, variants] of Object.entries(CANONICAL_PATTERN_MAPPING)) {
  for (const variant of variants) {
    VARIANT_TO_CANONICAL.set(variant.toLowerCase(), canonical);
  }
}

/**
 * Classify patterns that don't match specific variants into generic categories
 * This helps reduce the 2,269 unique patterns to a manageable set
 */
function classifyGenericPattern(pattern: string): string | null {
  // Optimization patterns
  if (pattern.includes('optimiz')) return 'Greedy';

  // Tracking/State patterns
  if (pattern.includes('tracking') || pattern.includes('state ')) return 'State Machine';

  // Detection patterns
  if (pattern.includes('detection') || pattern.includes('cycle')) return 'Graph Traversal';

  // Analysis/Processing patterns
  if (pattern.includes('analysis') || pattern.includes('processing')) return 'Array Manipulation';

  // Range/Query patterns
  if (pattern.includes('range') || pattern.includes('query')) return 'Prefix Sum';

  // Knapsack variants
  if (pattern.includes('knapsack')) return 'Dynamic Programming';

  // String-related
  if (pattern.includes('string') || pattern.includes('substring') || pattern.includes('anagram')) return 'String Processing';

  // Tree-related
  if (pattern.includes('ancestor') || pattern.includes('subtree') || pattern.includes('lca')) return 'Tree Traversal';

  // Graph-related
  if (pattern.includes('component') || pattern.includes('articulation') || pattern.includes('bridge')) return 'Graph Traversal';

  // Arithmetic/Math
  if (pattern.includes('arithmetic') || pattern.includes('prime') || pattern.includes('digit')) return 'Math';

  // Iteration/Traversal
  if (pattern.includes('iteration') || pattern.includes('traversal') || pattern.includes('scan')) return 'Array Manipulation';

  // Accumulation/Aggregation
  if (pattern.includes('accumulation') || pattern.includes('aggregation') || pattern.includes('counting')) return 'Hash Table';

  // Interval/Merge
  if (pattern.includes('interval') || pattern.includes('merge')) return 'Greedy';

  return null; // Very specific pattern, keep original
}

/**
 * Normalize a list of fine-grained patterns to canonical patterns
 *
 * @param rawPatterns - Array of fine-grained patterns from LLM
 * @returns Array of canonical patterns (deduplicated)
 *
 * @example
 * normalizePatterns(["Multi-source BFS", "Breadth-First Search", "Graph Traversal"])
 * // Returns: ["BFS", "Graph Traversal"]
 */
export function normalizePatterns(rawPatterns: string[]): string[] {
  const canonicalSet = new Set<string>();

  for (const rawPattern of rawPatterns) {
    const rawLower = rawPattern.toLowerCase().trim();

    // Try exact match first
    if (VARIANT_TO_CANONICAL.has(rawLower)) {
      canonicalSet.add(VARIANT_TO_CANONICAL.get(rawLower)!);
      continue;
    }

    // Try fuzzy matching (check if any variant is contained in the raw pattern)
    let matched = false;
    for (const [variant, canonical] of VARIANT_TO_CANONICAL.entries()) {
      if (rawLower.includes(variant) || variant.includes(rawLower)) {
        canonicalSet.add(canonical);
        matched = true;
        break;
      }
    }

    // If no match found, apply generic classification
    if (!matched) {
      const generic = classifyGenericPattern(rawLower);
      if (generic) {
        canonicalSet.add(generic);
      } else {
        // Keep original for very specific patterns (rare cases)
        canonicalSet.add(rawPattern);
      }
    }
  }

  return Array.from(canonicalSet);
}

/**
 * Get all canonical patterns (for reference)
 */
export function getCanonicalPatterns(): string[] {
  return Object.keys(CANONICAL_PATTERN_MAPPING);
}

/**
 * Get all variants for a canonical pattern
 */
export function getVariantsForCanonical(canonical: string): string[] {
  return CANONICAL_PATTERN_MAPPING[canonical] || [];
}

/**
 * Check if a pattern is canonical
 */
export function isCanonical(pattern: string): boolean {
  return pattern in CANONICAL_PATTERN_MAPPING;
}

/**
 * Statistics helper for analysis
 */
export function getPatternStatistics(allProblems: Array<{ algorithmPatterns: string[] }>): {
  totalUniqueRaw: number;
  totalUniqueCanonical: number;
  compressionRatio: number;
  mostCommonCanonical: Array<{ pattern: string; count: number }>;
} {
  const rawPatterns = new Set<string>();
  const canonicalPatterns = new Map<string, number>();

  for (const problem of allProblems) {
    const normalized = normalizePatterns(problem.algorithmPatterns);

    for (const raw of problem.algorithmPatterns) {
      rawPatterns.add(raw);
    }

    for (const canonical of normalized) {
      canonicalPatterns.set(canonical, (canonicalPatterns.get(canonical) || 0) + 1);
    }
  }

  const mostCommon = Array.from(canonicalPatterns.entries())
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    totalUniqueRaw: rawPatterns.size,
    totalUniqueCanonical: canonicalPatterns.size,
    compressionRatio: rawPatterns.size / canonicalPatterns.size,
    mostCommonCanonical: mostCommon,
  };
}
