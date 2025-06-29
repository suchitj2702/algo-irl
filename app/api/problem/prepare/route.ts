import { NextRequest, NextResponse } from 'next/server';
import { Problem } from '@/data-types/problem';
import { enhancedSecurityMiddleware } from '@/lib/security/enhanced-middleware';
import { getCorsHeaders } from '@/lib/security/cors';

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

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
  // Temporary debugging middleware - remove after issue is resolved
  console.log('=== INCOMING SIGNATURE REQUEST ===');
  console.log('Method:', request.method);
  console.log('Timestamp Header:', request.headers.get('x-timestamp'));
  console.log('Signature Header:', request.headers.get('x-signature'));
  
  // Collect debug headers
  const debugHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key.startsWith('x-debug-')) {
      debugHeaders[key] = value;
    }
  });
  console.log('Debug Headers:', debugHeaders);
  
  // Log body keys (need to clone request to read body without consuming it)
  try {
    const bodyText = await request.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    console.log('Body Keys:', Object.keys(body || {}).sort());
    
    // Create a new request with the body for the middleware
    const newRequest = new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body: bodyText,
    });
    
    console.log('=================================');
    
    return enhancedSecurityMiddleware(newRequest, async (req, parsedBody) => {
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);
    
    try {
      // Use the parsed body from middleware instead of reading it again
      const body = parsedBody || await req.json();
      const { problemId, companyId, difficulty, isBlind75, transformedProblem } = body;
      
      // Validate required parameters
      if (!problemId && !difficulty) {
        return NextResponse.json(
          { error: 'Either problemId or difficulty is required. You may also provide isBlind75 parameter when using difficulty.' }, 
          { status: 400, headers: corsHeaders }
        );
      }
      
      if (!companyId || typeof companyId !== 'string') {
        return NextResponse.json(
          { error: 'Company ID is required' }, 
          { status: 400, headers: corsHeaders }
        );
      }
      
      let resolvedProblemId = problemId;
      
      // If no problemId was provided, select one randomly based on difficulty and isBlind75
      if (!resolvedProblemId && difficulty) {
        // Determine isBlind75 value, default to false if not provided
        const blind75Value = isBlind75 !== undefined ? isBlind75 : false;
        
        // Use the filter API instead of the difficulty API
        const filterUrl = new URL(`${req.nextUrl.origin}/api/problem/filter`);
        filterUrl.searchParams.append('difficulty', difficulty);
        filterUrl.searchParams.append('isBlind75', blind75Value.toString());
        
        const problemsResponse = await fetch(filterUrl);
        
        if (!problemsResponse.ok) {
          const errorData = await problemsResponse.json();
          return NextResponse.json(
            { error: errorData.error || `Failed to fetch problems with ${difficulty} difficulty and isBlind75=${blind75Value}` },
            { status: problemsResponse.status, headers: corsHeaders }
          );
        }
        
        const problemData = await problemsResponse.json();
        
        if (!problemData.problemId) {
          return NextResponse.json(
            { error: `No problems found with ${difficulty} difficulty and isBlind75=${blind75Value}` },
            { status: 404, headers: corsHeaders }
          );
        }
        
        resolvedProblemId = problemData.problemId;
      }
      
      // Fetch the problem using the existing API
      const problemResponse = await fetch(
        `${req.nextUrl.origin}/api/problem/${resolvedProblemId}?language=python`
      );
      
      if (!problemResponse.ok) {
        const errorData = await problemResponse.json();
        return NextResponse.json(
          { error: errorData.error || `Failed to fetch problem ${resolvedProblemId}` },
          { status: problemResponse.status, headers: corsHeaders }
        );
      }
      
      const problem: Problem = await problemResponse.json();
      
      // Extract the Python-specific details
      const pythonDetails = problem.languageSpecificDetails?.python;
      
      if (!pythonDetails) {
        return NextResponse.json(
          { error: 'Python implementation details not available for this problem' },
          { status: 404, headers: corsHeaders }
        );
      }
      
      // If transformedProblem is not provided, call the transform API
      let transformResult = transformedProblem;
      
      if (!transformResult) {
        const transformResponse = await fetch(`${req.nextUrl.origin}/api/problem/transform`, {
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
            { status: transformResponse.status, headers: corsHeaders }
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
          explanation: testCase.explanation,
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
      
      return NextResponse.json(response, { headers: corsHeaders });
    } catch (error) {
      console.error('Error preparing problem:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
        { status: 500, headers: corsHeaders }
      );
    }
  }, {
    rateLimiterType: 'problemGeneration',
    checkHoneypotField: true,
    requireSignature: true // Require signature from frontend
  });
  } catch (parseError) {
    console.error('Error parsing request for debugging:', parseError);
    // Fallback to original request if parsing fails
    return enhancedSecurityMiddleware(request, async (req) => {
      const origin = req.headers.get('origin');
      const corsHeaders = getCorsHeaders(origin);
      return NextResponse.json(
        { error: 'Failed to parse request for debugging' },
        { status: 500, headers: corsHeaders }
      );
    }, {
      rateLimiterType: 'problemGeneration',
      checkHoneypotField: true,
      requireSignature: true
    });
  }
} 