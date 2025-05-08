import { useState } from 'react';
import ProblemTransformer from '../components/ProblemTransformer';

// Sample problem data
const sampleProblem = {
  title: 'Longest Consecutive Sequence',
  description: 'Given an unsorted array of integers nums, return the length of the longest consecutive elements sequence. You must write an algorithm that runs in O(n) time.',
  difficulty: 'Medium',
  constraints: [
    '0 <= nums.length <= 10^5',
    '-10^9 <= nums[i] <= 10^9'
  ]
};

// Sample companies
const sampleCompanies = [
  { id: 'google', name: 'Google' },
  { id: 'amazon', name: 'Amazon' },
  { id: 'meta', name: 'Meta' },
  { id: 'apple', name: 'Apple' },
  { id: 'microsoft', name: 'Microsoft' },
  { id: 'netflix', name: 'Netflix' }
];

const ExampleTransformPage = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Problem Transformation Demo</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-medium mb-3">Original Problem</h2>
        <div className="p-4 bg-gray-50 rounded border">
          <h3 className="font-semibold">{sampleProblem.title} ({sampleProblem.difficulty})</h3>
          <p className="my-2">{sampleProblem.description}</p>
          
          {sampleProblem.constraints && sampleProblem.constraints.length > 0 && (
            <div className="mt-3">
              <h4 className="font-medium">Constraints:</h4>
              <ul className="list-disc list-inside">
                {sampleProblem.constraints.map((constraint, index) => (
                  <li key={index}>{constraint}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      
      <ProblemTransformer 
        problem={sampleProblem} 
        companies={sampleCompanies} 
      />
    </div>
  );
};

export default ExampleTransformPage; 