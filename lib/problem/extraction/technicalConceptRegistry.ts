/**
 * Centralized registry for technical concepts, patterns, and mappings.
 * This provides a unified approach to extracting algorithms, data structures,
 * and other technical concepts from problem descriptions.
 */

export interface PatternMatch {
  pattern: RegExp;
  name: string;
}

export interface ComplexityPattern {
  pattern: RegExp;
  type: string;
}

/**
 * Centralized registry of technical patterns used across the transformation pipeline
 */
export class TechnicalConceptRegistry {
  /**
   * Common terms for keyword extraction
   */
  static readonly COMMON_TERMS = [
    'optimize',
    'efficient',
    'minimum',
    'maximum',
    'subarray',
    'substring',
    'consecutive',
  ];

  /**
   * Complexity patterns for detecting time/space complexity requirements
   */
  static readonly COMPLEXITY_PATTERNS: ComplexityPattern[] = [
    { pattern: /o\(n\)/i, type: 'LinearTime' },
    { pattern: /o\(1\)/i, type: 'ConstantSpace' },
    { pattern: /o\(log n\)/i, type: 'Logarithmic' },
    { pattern: /o\(n log n\)/i, type: 'LinearithmicTime' },
  ];

  /**
   * Algorithm regex patterns - unified approach for all extractions
   * Each pattern includes variations and common alternative names
   */
  static readonly ALGORITHM_PATTERNS: PatternMatch[] = [
    { pattern: /\b(depth.first|dfs)\b/i, name: 'DepthFirstSearch' },
    { pattern: /\b(breadth.first|bfs)\b/i, name: 'BreadthFirstSearch' },
    { pattern: /\b(dynamic.programming|dp)\b/i, name: 'DynamicProgramming' },
    { pattern: /\b(two.point|2.point)\b/i, name: 'TwoPointers' },
    { pattern: /\b(sliding.window)\b/i, name: 'SlidingWindow' },
    { pattern: /\b(binary.search)\b/i, name: 'BinarySearch' },
    { pattern: /\b(backtrack)\b/i, name: 'Backtracking' },
    { pattern: /\b(greedy)\b/i, name: 'Greedy' },
    { pattern: /\b(recursion|recursive)\b/i, name: 'Recursion' },
    { pattern: /\b(union.find|disjoint.set)\b/i, name: 'UnionFind' },
    { pattern: /\b(topological.sort)\b/i, name: 'TopologicalSort' },
    { pattern: /\b(hash|map|dictionary)\b/i, name: 'Hashing' },
    { pattern: /\b(graph)\b/i, name: 'GraphAlgorithm' },
    { pattern: /\b(tree)\b/i, name: 'TreeAlgorithm' },
    { pattern: /\b(sort)\b/i, name: 'Sorting' },
    { pattern: /\b(merge.sort)\b/i, name: 'MergeSort' },
    { pattern: /\b(quick.sort)\b/i, name: 'QuickSort' },
    { pattern: /\b(memoization)\b/i, name: 'Memoization' },
  ];

  /**
   * Data structure regex patterns - unified approach for all extractions
   * Each pattern includes common variations and aliases
   */
  static readonly STRUCTURE_PATTERNS: PatternMatch[] = [
    { pattern: /\b(array|arrays)\b/i, name: 'Array' },
    { pattern: /\b(linked.list|linkedlist)\b/i, name: 'LinkedList' },
    { pattern: /\b(stack)\b/i, name: 'Stack' },
    { pattern: /\b(queue)\b/i, name: 'Queue' },
    { pattern: /\b(hash.map|hashmap|hash.table|hashtable)\b/i, name: 'HashMap' },
    { pattern: /\b(hash.set|hashset)\b/i, name: 'HashSet' },
    { pattern: /\b(tree|trees)\b/i, name: 'Tree' },
    { pattern: /\b(binary.tree)\b/i, name: 'BinaryTree' },
    { pattern: /\b(binary.search.tree|bst)\b/i, name: 'BinarySearchTree' },
    { pattern: /\b(heap)\b/i, name: 'Heap' },
    { pattern: /\b(priority.queue)\b/i, name: 'PriorityQueue' },
    { pattern: /\b(graph)\b/i, name: 'Graph' },
    { pattern: /\b(trie)\b/i, name: 'Trie' },
    { pattern: /\b(matrix|grid)\b/i, name: 'Matrix' },
    { pattern: /\b(string)\b/i, name: 'String' },
  ];

  /**
   * Extract concepts from text using a set of pattern matches
   * @param text - Text to analyze (should be lowercase)
   * @param patterns - Array of pattern matches to apply
   * @returns Array of matched concept names
   */
  static extractFromText(text: string, patterns: PatternMatch[]): string[] {
    const found: string[] = [];
    for (const { pattern, name } of patterns) {
      if (pattern.test(text) && !found.includes(name)) {
        found.push(name);
      }
    }
    return found;
  }

  /**
   * Get all data structure names (for backward compatibility)
   */
  static getDataStructureNames(): string[] {
    return this.STRUCTURE_PATTERNS.map((p) => p.name);
  }

  /**
   * Get all algorithm names (for backward compatibility)
   */
  static getAlgorithmNames(): string[] {
    return this.ALGORITHM_PATTERNS.map((p) => p.name);
  }
}