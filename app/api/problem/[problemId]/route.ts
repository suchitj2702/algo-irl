import { NextRequest, NextResponse } from 'next/server';
import { getProblemById } from '@/lib/problem/problemDatastoreUtils';

// GET /api/problem/{problemId} - Get detailed problem information
export async function GET(
  request: NextRequest, 
  context: { params: Promise<{ problemId: string }> }
) {
  try {
    // The `params` property of the context object is a Promise that resolves to the route parameters.
    // It should be awaited before accessing its properties as per Next.js documentation.
    const { problemId } = await context.params; // Correctly await context.params
    const language = request.nextUrl.searchParams.get('language');
    
    // Fetch the problem from Firestore
    const problem = await getProblemById(problemId);
    
    if (!problem) {
      return NextResponse.json(
        { error: `Problem with ID ${problemId} not found` },
        { status: 404 }
      );
    }
    
    // Prepare the response data, starting with all problem information.
    // We will conditionally modify languageSpecificDetails and always filter testCases.
    const responseData = { ...problem };

    if (language) {
      const specificLangDetails = problem.languageSpecificDetails ? problem.languageSpecificDetails[language] : undefined;
      if (specificLangDetails) {
        // Requested language is available, so restrict languageSpecificDetails to only this one.
        responseData.languageSpecificDetails = { [language]: specificLangDetails };
      } else {
        // Requested language is not available.
        // responseData.languageSpecificDetails will retain all available languages from `...problem`.
        // If problem.languageSpecificDetails was null/undefined initially, it remains so.
      }
    }
    // If no language was specified in the query, responseData.languageSpecificDetails already contains all available (or null/undefined if none).

    // Always filter testCases to include only sample ones.
    // Ensure problem.testCases exists and is an array before filtering, defaulting to an empty array.
    responseData.testCases = Array.isArray(problem.testCases) 
      ? problem.testCases.filter(tc => tc.isSample) 
      : [];
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error(`Error fetching problem:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch problem details' },
      { status: 500 }
    );
  }
}