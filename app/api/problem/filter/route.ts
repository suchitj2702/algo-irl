import { NextRequest, NextResponse } from 'next/server';
import { getFilteredProblems } from '@/lib/problem/problemDatastoreUtils';
import { ProblemDifficulty } from '@/data-types/problem';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const isBlind75Param = searchParams.get('isBlind75');
    const difficultyParam = searchParams.get('difficulty');
    
    // Validate parameters
    if (isBlind75Param === null) {
      return NextResponse.json(
        { error: 'isBlind75 query parameter is required (true or false)' },
        { status: 400 }
      );
    }
    
    // Convert isBlind75 string to boolean
    const isBlind75 = isBlind75Param.toLowerCase() === 'true';
    
    // Validate difficulty if provided
    let difficulty: ProblemDifficulty | null = null;
    if (difficultyParam) {
      if (!['Easy', 'Medium', 'Hard'].includes(difficultyParam)) {
        return NextResponse.json(
          { error: 'Invalid difficulty. Must be "Easy", "Medium", or "Hard".' },
          { status: 400 }
        );
      }
      difficulty = difficultyParam as ProblemDifficulty;
    }
    
    // Get filtered problems
    const problems = await getFilteredProblems(isBlind75, difficulty);
    
    if (problems.length === 0) {
      return NextResponse.json(
        { error: 'No problems found matching the criteria' },
        { status: 404 }
      );
    }
    
    // Return a random problem ID from the filtered list
    const randomIndex = Math.floor(Math.random() * problems.length);
    const randomProblem = problems[randomIndex];
    
    return NextResponse.json({ problemId: randomProblem.id });
  } catch (error: any) {
    console.error('Error filtering problems:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to filter problems' },
      { status: 500 }
    );
  }
} 