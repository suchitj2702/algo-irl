import { NextResponse } from 'next/server';
import { transformProblem } from '@/lib/problem/problemTransformer';
import { getProblemById } from '@/lib/problem/problemDatastoreUtils';
import { getCompanyById } from '@/lib/company/companyUtils';

export async function POST(request: Request) {
  try {
    const { problemId, companyId, useCache = true } = await request.json();

    // Validate required fields
    if (!problemId || !companyId) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          requiredFields: ['problemId', 'companyId']
        }, 
        { status: 400 }
      );
    }

    // Verify the problem and company exist
    const problem = await getProblemById(problemId);
    const company = await getCompanyById(companyId);

    if (!problem) {
      return NextResponse.json(
        { 
          error: 'Problem not found',
          problemId
        }, 
        { status: 404 }
      );
    }

    if (!company) {
      return NextResponse.json(
        { 
          error: 'Company not found',
          companyId
        }, 
        { status: 404 }
      );
    }

    // Transform the problem into a company-specific scenario with context information
    const result = await transformProblem(problemId, companyId, useCache);

    // Return the transformed scenario and context information
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error transforming problem:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to transform problem',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 