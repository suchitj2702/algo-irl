import { NextResponse } from 'next/server';
import { getBlind75Problems } from '@/lib/problem/problemDatastoreUtils';

export async function GET() {
  try {
    // Get problems marked as Blind 75
    const problems = await getBlind75Problems();
    
    // Return simplified versions of each problem with essential details
    const simplifiedProblems = problems.map(problem => ({
      id: problem.id,
      title: problem.title,
      difficulty: problem.difficulty,
      categories: problem.categories,
      isBlind75: problem.isBlind75
    }));
    
    return NextResponse.json(simplifiedProblems);
  } catch (error: unknown) {
    console.error('Error fetching Blind 75 problems:', error);
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) || 'Failed to fetch Blind 75 problems' },
      { status: 500 }
    );
  }
} 