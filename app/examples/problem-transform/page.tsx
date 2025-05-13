'use client';

import { useState, useEffect } from 'react';
import ProblemTransformer from '@/components/problem/ProblemTransformer';
import { Problem } from '@/data-types/problem';
import { Company } from '@/data-types/company';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';



export default function ProblemTransformExample() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch Problems
        const problemsCollectionRef = collection(db, 'problems');
        const problemsSnapshot = await getDocs(problemsCollectionRef);
        const fetchedProblems = problemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Problem));
        setProblems(fetchedProblems);

        // Fetch Companies
        const companiesCollectionRef = collection(db, 'companies');
        const companiesSnapshot = await getDocs(companiesCollectionRef);
        const fetchedCompanies = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
        setCompanies(fetchedCompanies);

      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center h-screen">
        <div className="text-center">
          <p className="text-lg mb-2">Loading problems and companies...</p>
          {/* You can add a spinner or loading animation here */}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 p-4 rounded-md border border-red-200">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (problems.length === 0) {
     return (
      <div className="container mx-auto p-4">
        <p>No problems found in the database.</p>
      </div>
    );   
  }

  // Use the first fetched problem as the example "Original Problem"
  const originalProblem = problems[0];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Problem Transformation Example</h1>
      <p className="mb-6">
        This example demonstrates how coding problems can be transformed into company-specific interview scenarios. 
        Select a company below to see how the same problem would be presented in their interview process.
      </p>
      
      {originalProblem && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 mb-8">
          <h2 className="text-xl font-bold mb-2">Original Problem</h2>
          <div className="mb-2"><span className="font-semibold">Title:</span> {originalProblem.title}</div>
          <div className="mb-2"><span className="font-semibold">Difficulty:</span> {originalProblem.difficulty}</div>
          <div className="mb-2">
            <span className="font-semibold">Categories:</span> {originalProblem.categories.join(', ')}
          </div>
          <div className="mb-4">
            <span className="font-semibold">Description:</span>
            <pre className="whitespace-pre-wrap mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded">
              {originalProblem.description}
            </pre>
          </div>
        </div>
      )}
      
      <ProblemTransformer 
        problems={problems}
        companies={companies}
      />
    </div>
  );
} 