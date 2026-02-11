import { NextRequest } from 'next/server';
import { withCors } from '@/lib/shared/apiResponse';
import { transformAndPrepareProblem, PROBLEM_CACHE_FEATURE_ENABLED } from '@/lib/problem/problemTransformer';
import { getFilteredProblems } from '@/lib/problem/problemDatastoreUtils';
import { RoleFamily } from '@/data-types/role';
import { ProblemDifficulty } from '@/data-types/problem';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { problemId, companyId, difficulty, isBlind75, roleFamily } = body;

    // Validate required parameters
    if (!problemId && !difficulty) {
      return withCors(request,
        { error: 'Either problemId or difficulty is required. You may also provide isBlind75 parameter when using difficulty.' },
        { status: 400 }
      );
    }

    if (!companyId || typeof companyId !== 'string') {
      return withCors(request, { error: 'Company ID is required' }, { status: 400 });
    }

    // Validate role family if provided
    if (roleFamily !== undefined && roleFamily !== null) {
      if (!Object.values(RoleFamily).includes(roleFamily as RoleFamily)) {
        return withCors(request,
          { error: 'Invalid role family', providedRole: roleFamily, validRoles: Object.values(RoleFamily) },
          { status: 400 }
        );
      }
    }

    // Resolve problem ID (select random if not provided)
    let resolvedProblemId = problemId as string | undefined;

    if (!resolvedProblemId && difficulty) {
      const blind75Value = typeof isBlind75 === 'boolean' ? isBlind75 : false;

      try {
        const problems = await getFilteredProblems(blind75Value, difficulty as ProblemDifficulty);

        if (problems.length === 0) {
          return withCors(request,
            { error: `No problems found with ${difficulty} difficulty and isBlind75=${blind75Value}` },
            { status: 404 }
          );
        }

        // Select a random problem from the filtered list
        const randomIndex = Math.floor(Math.random() * problems.length);
        resolvedProblemId = problems[randomIndex].id;
      } catch (filterError) {
        console.error('Error filtering problems:', filterError);
        return withCors(request,
          { error: filterError instanceof Error ? filterError.message : 'Failed to filter problems' },
          { status: 500 }
        );
      }
    }

    // Use the unified transformation function (role auto-selected by transformer if not provided)
    const preparedProblem = await transformAndPrepareProblem(
      resolvedProblemId as string,
      companyId as string,
      roleFamily as RoleFamily | undefined,
      PROBLEM_CACHE_FEATURE_ENABLED
    );

    // Format response with role metadata (always included by transformer)
    const response = {
      problem: {
        id: preparedProblem.problemData.id,
        title: preparedProblem.transformedProblem.structuredScenario.title,
        difficulty: preparedProblem.problemData.difficulty,
        background: preparedProblem.transformedProblem.structuredScenario.background,
        problemStatement: preparedProblem.transformedProblem.structuredScenario.problemStatement,
        constraints: preparedProblem.transformedProblem.structuredScenario.constraints,
        examples: preparedProblem.transformedProblem.structuredScenario.examples,
        requirements: preparedProblem.transformedProblem.structuredScenario.requirements,
        testCases: preparedProblem.appliedMappings.testCases,
        leetcodeUrl: preparedProblem.problemData.leetcodeLink,
        categories: preparedProblem.problemData.categories,
        timeComplexity: preparedProblem.problemData.timeComplexity,
        spaceComplexity: preparedProblem.problemData.spaceComplexity,
      },
      codeDetails: {
        functionName: preparedProblem.appliedMappings.functionName,
        solutionStructureHint: preparedProblem.appliedMappings.solutionStructureHint,
        defaultUserCode: preparedProblem.appliedMappings.defaultUserCode,
        boilerplateCode: preparedProblem.appliedMappings.boilerplateCode,
      },
      roleMetadata: {
        roleFamily: preparedProblem.roleFamily,
        wasRoleAutoSelected: preparedProblem.wasRoleAutoSelected,
        contextInfo: preparedProblem.transformedProblem.contextInfo,
      },
    };

    return withCors(request, response);
  } catch (error) {
    console.error('Error preparing problem:', error);
    return withCors(request,
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
