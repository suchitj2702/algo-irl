import { NextResponse } from 'next/server';
import { transformProblem } from '@/lib/problem/problemTransformer';
import { getProblemById } from '@/lib/problem/problemDatastoreUtils';
import { getCompanyById } from '@/lib/company/companyUtils';
import { RoleFamily } from '@/data-types/role';

/**
 * Internal-only API for problem transformation.
 *
 * This endpoint is blocked from external access by middleware and should only be
 * called by internal services.
 *
 * Role parameter is optional - if not provided, the transformer will auto-select
 * a random role for diversity. This ensures all transformations benefit from
 * role-enhanced prompts.
 */
export async function POST(request: Request) {
  try {
    const { problemId, companyId, roleFamily, useCache = true } = await request.json();

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

    // Validate role family if provided
    if (roleFamily !== undefined && roleFamily !== null && !Object.values(RoleFamily).includes(roleFamily)) {
      return NextResponse.json(
        {
          error: 'Invalid role family',
          providedRole: roleFamily,
          validRoles: Object.values(RoleFamily)
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

    // Transform problem (role will be auto-selected by transformer if not provided)
    const result = await transformProblem(problemId, companyId, roleFamily, useCache);

    // Return the transformed scenario with role metadata
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
