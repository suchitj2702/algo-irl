'use client';

import { useState, useEffect } from 'react';
import EnhancedProblemTransformer from '@/components/EnhancedProblemTransformer';

// Sample problem data
const sampleProblems = [
  {
    id: 'longest-consecutive-sequence',
    title: 'Longest Consecutive Sequence',
    description: 'Given an unsorted array of integers nums, return the length of the longest consecutive elements sequence. You must write an algorithm that runs in O(n) time.',
    difficulty: 'Medium',
    constraints: [
      '0 <= nums.length <= 10^5',
      '-10^9 <= nums[i] <= 10^9'
    ]
  },
  {
    id: 'two-sum',
    title: 'Two Sum',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.',
    difficulty: 'Easy',
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.'
    ]
  },
  {
    id: 'merge-intervals',
    title: 'Merge Intervals',
    description: 'Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.',
    difficulty: 'Medium',
    constraints: [
      '1 <= intervals.length <= 10^4',
      'intervals[i].length == 2',
      '0 <= starti <= endi <= 10^4'
    ]
  }
];

// Sample company data
const sampleCompanies = [
  { 
    id: 'google',
    name: 'Google',
  },
  { 
    id: 'amazon',
    name: 'Amazon',
  },
  { 
    id: 'meta',
    name: 'Meta',
  },
  { 
    id: 'microsoft',
    name: 'Microsoft',
  },
  { 
    id: 'apple',
    name: 'Apple',
  },
  { 
    id: 'netflix',
    name: 'Netflix',
  }
];

export default function AdvancedTransformPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Advanced Problem Transformation Demo</h1>
        <p className="text-gray-600">
          This demo showcases enhanced problem transformation with intelligent context extraction. 
          The utility analyzes coding problems to identify algorithms, data structures, and core concepts, 
          then matches them with relevant aspects of the selected company to create more tailored scenarios.
        </p>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-2">How It Works</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Select a coding problem and a technology company</li>
          <li>Our system analyzes the problem to extract key algorithms and data structures</li>
          <li>We identify relevant company products, technologies, and focus areas</li>
          <li>Based on this matching, we generate suggested analogies for the scenario</li>
          <li>The enhanced prompt is sent to Claude to create a realistic, company-specific interview scenario</li>
        </ol>
      </div>
      
      <EnhancedProblemTransformer 
        problems={sampleProblems} 
        companies={sampleCompanies} 
      />
      
      <div className="mt-12 bg-gray-50 p-4 rounded-lg border">
        <h2 className="text-xl font-semibold mb-2">Technical Details</h2>
        <p className="mb-4">
          The prompt enhancer utility uses pattern matching and heuristics to extract:
        </p>
        <ul className="list-disc list-inside space-y-1 mb-4">
          <li>Core algorithms (e.g., DFS, BFS, dynamic programming)</li>
          <li>Data structures (e.g., trees, graphs, hash maps)</li>
          <li>Problem characteristics (complexity, optimization requirements)</li>
          <li>Company-specific relevance metrics</li>
        </ul>
        <p>
          This creates significantly more relevant and tailored interview scenarios 
          that maintain the algorithmic integrity of the original problem.
        </p>
      </div>
    </div>
  );
} 