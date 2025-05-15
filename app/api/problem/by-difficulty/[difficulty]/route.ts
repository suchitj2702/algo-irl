import { NextRequest, NextResponse } from 'next/server';
import { getProblemsbyDifficulty } from '@/lib/problem/problemDatastoreUtils';
import { ProblemDifficulty } from '@/data-types/problem';

export async function GET(
  request: NextRequest,
  context: { params: { difficulty: string } }
) {
  try {
    // Explicitly await the params object
    const params = await Promise.resolve(context.params);
    const difficulty = params.difficulty;
    
    if (!isValidDifficulty(difficulty)) {
      return NextResponse.json(
        { error: 'Invalid difficulty. Must be "Easy", "Medium", or "Hard".' },
        { status: 400 }
      );
    }

    // Get problems by difficulty
    const problems = await getProblemsbyDifficulty(difficulty as ProblemDifficulty);
    
    // Return only the IDs, as requested
    const problemIds = problems.map(problem => problem.id);
    
    return NextResponse.json(problemIds);
  } catch (error: any) {
    console.error('Error fetching problems by difficulty:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch problems' },
      { status: 500 }
    );
  }
}

// Helper function to validate difficulty parameter
function isValidDifficulty(difficulty: string): boolean {
  return ['Easy', 'Medium', 'Hard'].includes(difficulty);
} 