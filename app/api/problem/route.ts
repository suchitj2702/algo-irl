import { NextResponse } from 'next/server';
import { getAllProblems } from '@/lib/problem/problemDatastoreUtils';

// GET /api/problem - Get list of all problems with basic info
export async function GET() {
  try {
    // Fetch all problems from Firestore
    const problems = await getAllProblems();
    
    // Return a simplified version of each problem with only essential details
    const simplifiedProblems = problems.map(problem => ({
      id: problem.id,
      title: problem.title,
      difficulty: problem.difficulty,
      categories: problem.categories,
      isBlind75: problem.isBlind75
    }));
    
    return NextResponse.json(simplifiedProblems);
  } catch (error) {
    console.error('Error fetching problems:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch problems' },
      { status: 500 }
    );
  }
} 