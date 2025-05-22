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
    const { problemId, companyId, difficulty, isBlind75, transformedProblem } = await request.json();
    
    // Validate required parameters
    if (!problemId && !difficulty) {
      return NextResponse.json(
        { error: 'Either problemId or difficulty is required. You may also provide isBlind75 parameter when using difficulty.' }, 
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
    
    // If no problemId was provided, select one randomly based on difficulty and isBlind75
    if (!resolvedProblemId && difficulty) {
      // Determine isBlind75 value, default to false if not provided
      const blind75Value = isBlind75 !== undefined ? isBlind75 : false;
      
      // Use the filter API instead of the difficulty API
      const filterUrl = new URL(`${request.nextUrl.origin}/api/problem/filter`);
      filterUrl.searchParams.append('difficulty', difficulty);
      filterUrl.searchParams.append('isBlind75', blind75Value.toString());
      
      const problemsResponse = await fetch(filterUrl);
      
      if (!problemsResponse.ok) {
        const errorData = await problemsResponse.json();
        return NextResponse.json(
          { error: errorData.error || `Failed to fetch problems with ${difficulty} difficulty and isBlind75=${blind75Value}` },
          { status: problemsResponse.status }
        );
      }
      
      const problemData = await problemsResponse.json();
      
      if (!problemData.problemId) {
        return NextResponse.json(
          { error: `No problems found with ${difficulty} difficulty and isBlind75=${blind75Value}` },
          { status: 404 }
        );
      }
      
      resolvedProblemId = problemData.problemId;
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
    
    const transformedDefaultUserCode = applyFunctionMappings(
      pythonDetails.defaultUserCode, 
      transformResult.structuredScenario.functionMapping
    );

    const transformedBoilerplateCodeWithPlaceholder = applyFunctionMappings(
      pythonDetails.boilerplateCodeWithPlaceholder, 
      transformResult.structuredScenario.functionMapping
    );
    
    // for each test case, apply the function mappings to the input and output
    const transformedTestCases = problem.testCases.map(testCase => {
      return {
        stdin: applyFunctionMappings(testCase.stdin, transformResult.structuredScenario.functionMapping),
        expectedStdout: applyFunctionMappings(testCase.expectedStdout, transformResult.structuredScenario.functionMapping),
        isSample: testCase.isSample
      };
    });

    // apply the function mappings to the solutionFunctionNameOrClassName
    const transformedSolutionFunctionNameOrClassName = applyFunctionMappings(
      pythonDetails.solutionFunctionNameOrClassName, 
      transformResult.structuredScenario.functionMapping
    );

    // apply the function mappings to the solutionStructureHint
    const transformedSolutionStructureHint = applyFunctionMappings(
      pythonDetails.solutionStructureHint, 
      transformResult.structuredScenario.functionMapping
    );
    
    // Prepare the response with both problem and code details
    const response = {
      problem: {
        id: problem.id,
        title: transformResult.structuredScenario.title,
        difficulty: problem.difficulty,
        background: transformResult.structuredScenario.background,
        problemStatement: transformResult.structuredScenario.problemStatement,
        constraints: transformResult.structuredScenario.constraints,
        examples: transformResult.structuredScenario.examples,
        requirements: transformResult.structuredScenario.requirements,
        testCases: transformedTestCases,
        leetcodeUrl: problem.leetcodeLink,
        categories: problem.categories,
        timeComplexity: problem.timeComplexity,
        spaceComplexity: problem.spaceComplexity
      },
      codeDetails: {
        functionName: transformedSolutionFunctionNameOrClassName,
        solutionStructureHint: transformedSolutionStructureHint,
        defaultUserCode: transformedDefaultUserCode,
        boilerplateCode: transformedBoilerplateCodeWithPlaceholder,
      }
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