'use client';

import { useState, useEffect } from 'react';
import ProblemTransformer from '@/components/problem/ProblemTransformer';
import { Problem } from '@/data-types/problem';
import { Company } from '@/data-types/company';

// Sample problem data for demonstration
const sampleProblem: Problem = {
  id: 'longest-consecutive-sequence',
  title: 'Longest Consecutive Sequence',
  difficulty: 'Medium',
  categories: ['Array', 'Hash Table', 'Union Find'],
  description: `Given an unsorted array of integers nums, return the length of the longest consecutive elements sequence.
    
You must write an algorithm that runs in O(n) time.

Example 1:
Input: nums = [100,4,200,1,3,2]
Output: 4
Explanation: The longest consecutive elements sequence is [1, 2, 3, 4]. Therefore its length is 4.

Example 2:
Input: nums = [0,3,7,2,5,8,4,6,0,1]
Output: 9
`,
  constraints: [
    '0 <= nums.length <= 10^5',
    '-10^9 <= nums[i] <= 10^9'
  ],
  leetcodeLink: 'https://leetcode.com/problems/longest-consecutive-sequence/',
  isBlind75: true,
  testCases: [
    {
      input: { raw: '[100,4,200,1,3,2]', parsed: [100, 4, 200, 1, 3, 2] },
      output: 4
    },
    {
      input: { raw: '[0,3,7,2,5,8,4,6,0,1]', parsed: [0, 3, 7, 2, 5, 8, 4, 6, 0, 1] },
      output: 9
    }
  ],
  solutionApproach: 'Use a hash set to track numbers in the array, then find the start of each sequence and count its length.',
  timeComplexity: 'O(n)',
  spaceComplexity: 'O(n)',
  createdAt: { seconds: 1636800000, nanoseconds: 0 } as any,
  updatedAt: { seconds: 1636800000, nanoseconds: 0 } as any
};

// Sample companies for demonstration
const sampleCompanies: Company[] = [
  {
    id: 'google',
    name: 'Google',
    description: 'Leading search and advertising technology company',
    domain: 'Search, Advertising, Cloud Computing',
    products: ['Google Search', 'Google Ads', 'Google Cloud', 'Android', 'YouTube'],
    technologies: ['Machine Learning', 'Distributed Systems', 'Web Technologies'],
    interviewFocus: ['Algorithms', 'System Design', 'Problem Solving'],
    logoUrl: 'https://www.google.com/favicon.ico',
    createdAt: { seconds: 1636800000, nanoseconds: 0 } as any,
    updatedAt: { seconds: 1636800000, nanoseconds: 0 } as any
  },
  {
    id: 'amazon',
    name: 'Amazon',
    description: 'E-commerce and cloud computing giant',
    domain: 'E-commerce, Cloud Services, Logistics',
    products: ['Amazon.com', 'AWS', 'Amazon Prime', 'Alexa'],
    technologies: ['Cloud Infrastructure', 'Warehousing Systems', 'Recommendation Engines'],
    interviewFocus: ['Leadership Principles', 'Scalability', 'Operational Excellence'],
    logoUrl: 'https://www.amazon.com/favicon.ico',
    createdAt: { seconds: 1636800000, nanoseconds: 0 } as any,
    updatedAt: { seconds: 1636800000, nanoseconds: 0 } as any
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    description: 'Software and cloud computing company',
    domain: 'Operating Systems, Productivity Software, Cloud Computing',
    products: ['Windows', 'Office 365', 'Azure', 'Xbox'],
    technologies: ['Cloud Computing', '.NET', 'Artificial Intelligence'],
    interviewFocus: ['Coding', 'System Design', 'Behavioral'],
    logoUrl: 'https://www.microsoft.com/favicon.ico',
    createdAt: { seconds: 1636800000, nanoseconds: 0 } as any,
    updatedAt: { seconds: 1636800000, nanoseconds: 0 } as any
  }
];

export default function ProblemTransformExample() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Problem Transformation Example</h1>
      <p className="mb-6">
        This example demonstrates how coding problems can be transformed into company-specific interview scenarios. 
        Select a company below to see how the same problem would be presented in their interview process.
      </p>
      
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 mb-8">
        <h2 className="text-xl font-bold mb-2">Original Problem</h2>
        <div className="mb-2"><span className="font-semibold">Title:</span> {sampleProblem.title}</div>
        <div className="mb-2"><span className="font-semibold">Difficulty:</span> {sampleProblem.difficulty}</div>
        <div className="mb-2">
          <span className="font-semibold">Categories:</span> {sampleProblem.categories.join(', ')}
        </div>
        <div className="mb-4">
          <span className="font-semibold">Description:</span>
          <pre className="whitespace-pre-wrap mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded">
            {sampleProblem.description}
          </pre>
        </div>
      </div>
      
      <ProblemTransformer 
        problems={[sampleProblem]}
        companies={sampleCompanies}
      />
    </div>
  );
} 