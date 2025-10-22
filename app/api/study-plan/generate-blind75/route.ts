import { NextRequest, NextResponse } from 'next/server';
import { generateStudyPlan } from '@/lib/study-plan/studyPlanOrchestrator';
import { StudyPlanRequest } from '@/data-types/studyPlan';
import { RoleFamily } from '@/data-types/role';

/**
 * POST /api/study-plan/generate-blind75
 *
 * Generate a personalized study plan using ONLY Blind75 problems
 * This is a specialized endpoint that filters the problem pool to only include
 * problems marked with isBlind75 = true before generating the study plan.
 *
 * Request body:
 * {
 *   companyId: string;
 *   roleFamily: RoleFamily;
 *   timeline: number;           // days (1-90)
 *   hoursPerDay: number;        // hours (0.5-8)
 *   difficultyPreference?: {
 *     easy?: boolean;
 *     medium?: boolean;
 *     hard?: boolean;
 *   };
 *   topicFocus?: string[];      // max 5 topics
 * }
 *
 * Response:
 * {
 *   company: Company;
 *   roleFamily: RoleFamily;
 *   timeline: number;
 *   hoursPerDay: number;
 *   totalProblems: number;
 *   schedule: DailyPlan[];
 *   problems: EnrichedProblem[];
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.companyId || !body.roleFamily || !body.timeline || !body.hoursPerDay) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['companyId', 'roleFamily', 'timeline', 'hoursPerDay']
        },
        { status: 400 }
      );
    }

    // Validate role family
    const validRoles = Object.values(RoleFamily);
    if (!validRoles.includes(body.roleFamily)) {
      return NextResponse.json(
        {
          error: 'Invalid role family',
          validRoles
        },
        { status: 400 }
      );
    }

    // Build request object with onlyBlind75 flag set to true
    const studyPlanRequest: StudyPlanRequest = {
      companyId: body.companyId,
      roleFamily: body.roleFamily,
      timeline: Number(body.timeline),
      hoursPerDay: Number(body.hoursPerDay),
      difficultyPreference: body.difficultyPreference,
      topicFocus: body.topicFocus,
      onlyBlind75: true // Always use Blind75 problems for this endpoint
    };

    // Generate study plan (will only use Blind75 problems)
    const studyPlan = await generateStudyPlan(studyPlanRequest);

    return NextResponse.json(studyPlan);
  } catch (error) {
    console.error('Error generating Blind75 study plan:', error);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('Invalid request')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      if (error.message.includes('No problems found')) {
        return NextResponse.json({ error: error.message }, { status: 422 });
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate Blind75 study plan',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
