import { NextRequest, NextResponse } from 'next/server';
import { Problem, TransformationResult } from '@/data-types/problem';

/**
 * Apply function mappings to code by replacing original function names with company-specific ones
 */
function applyFunctionMappings(code: string, functionMapping: Record<string, string>): string {
  let transformedCode = code;
  
  // Sort mappings by length in descending order to avoid partial replacements
  // (e.g., replacing "foo" before "fooBar" would cause issues)
  const sortedMappings = Object.entries(functionMapping)
    .sort((a, b) => b[0].length - a[0].length);
  
  // Replace each function/class name with its mapped version
  for (const [original, mapped] of sortedMappings) {
    // Escape special regex characters in the original name
    const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Create a regex that matches the exact word boundaries
    const regex = new RegExp(`\\b${escapedOriginal}\\b`, 'g');
    transformedCode = transformedCode.replace(regex, mapped);
  }
  
  return transformedCode;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { problemId, companyId, difficulty, transformedProblem } = await request.json();
    
    // Validate required parameters
    if (!problemId && !difficulty) {
      return NextResponse.json(
        { error: 'Either problemId or difficulty is required' }, 
        { status: 400 }
      );
    }
    
    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json(
        { error: 'Company ID is required' }, 
        { status: 400 }
      );
    }
    
    let resolvedProblemId = problemId;
    
    // If no problemId was provided, select one randomly based on difficulty
    if (!resolvedProblemId && difficulty) {
      const problemsResponse = await fetch(
        `${request.nextUrl.origin}/api/problem/by-difficulty/${difficulty}`
      );
      
      if (!problemsResponse.ok) {
        const errorData = await problemsResponse.json();
        return NextResponse.json(
          { error: errorData.error || `Failed to fetch problems with ${difficulty} difficulty` },
          { status: problemsResponse.status }
        );
      }
      
      const problemIds = await problemsResponse.json();
      
      if (!problemIds.length) {
        return NextResponse.json(
          { error: `No problems found with ${difficulty} difficulty` },
          { status: 404 }
        );
      }
      
      // Randomly select one problem ID
      const randomIndex = Math.floor(Math.random() * problemIds.length);
      resolvedProblemId = problemIds[randomIndex];
    }
    
    // Fetch the problem using the existing API
    const problemResponse = await fetch(
      `${request.nextUrl.origin}/api/problem/${resolvedProblemId}?language=python`
    );
    
    if (!problemResponse.ok) {
      const errorData = await problemResponse.json();
      return NextResponse.json(
        { error: errorData.error || `Failed to fetch problem ${resolvedProblemId}` },
        { status: problemResponse.status }
      );
    }
    
    const problem: Problem = await problemResponse.json();
    
    // Extract the Python-specific details
    const pythonDetails = problem.languageSpecificDetails?.python;
    
    if (!pythonDetails) {
      return NextResponse.json(
        { error: 'Python implementation details not available for this problem' },
        { status: 404 }
      );
    }
    
    // If transformedProblem is not provided, call the transform API
    let transformResult = transformedProblem;
    
    if (!transformResult) {
      const transformResponse = await fetch(`${request.nextUrl.origin}/api/problem/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: resolvedProblemId,
          companyId: companyId,
          useCache: true
        }),
      });
      
      if (!transformResponse.ok) {
        const errorData = await transformResponse.json();
        return NextResponse.json(
          { error: errorData.error || 'Failed to transform problem' },
          { status: transformResponse.status }
        );
      }
      
      transformResult = await transformResponse.json();
    }
    
    // Apply function mappings to code templates if we have them
    let transformedDefaultUserCode = pythonDetails.defaultUserCode;
    
    if (transformResult.functionMapping && Object.keys(transformResult.functionMapping).length > 0) {
      // Transform only the defaultUserCode with function mappings
      transformedDefaultUserCode = applyFunctionMappings(
        pythonDetails.defaultUserCode, 
        transformResult.functionMapping
      );
    }
    
    // Prepare the response with both problem and code details
    const response = {
      problem: {
        id: problem.id,
        title: problem.title,
        difficulty: problem.difficulty,
        description: problem.description,
        constraints: problem.constraints,
        testCases: problem.testCases
      },
      codeDetails: {
        functionName: pythonDetails.solutionFunctionNameOrClassName,
        solutionStructureHint: pythonDetails.solutionStructureHint,
        defaultUserCode: transformedDefaultUserCode,
        boilerplateCode: pythonDetails.boilerplateCodeWithPlaceholder
      },
      transformedProblem: transformResult
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error preparing problem:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 