import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireUser, type CurrentUser } from '@algo-irl/lib/auth/verifyFirebaseToken';
import { FirebaseTokenError } from '@algo-irl/lib/auth/tokenUtils';
import {
  IssueReportPayloadSchema,
  type IssueReportSuccessResponse,
  type IssueReportErrorResponse,
} from '@algo-irl/data-types/issueReport';
import { reportIssueToSentry, reportIssueException } from '@algo-irl/lib/sentry/reportIssue';

/**
 * POST /api/issue/report
 *
 * Endpoint for users to report issues with the AlgoIRL platform.
 * Issues are sent to Sentry for tracking and analysis.
 *
 * Authentication: Optional - accepts both authenticated and anonymous reports
 * - If Authorization header is present and valid: Reports with user context
 * - If Authorization header is missing: Reports as anonymous user
 * - If Authorization header is invalid/expired: Returns 401 error
 *
 * Rate Limiting: Handled by Vercel at infrastructure level
 *
 * @see docs/ISSUE_REPORTING_API.md for full API specification
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Step 1: Try to authenticate user (optional)
    let user: CurrentUser | null = null;
    const authHeader = request.headers.get('authorization');

    if (authHeader) {
      try {
        const authResult = await requireUser(request);
        user = authResult.user;
      } catch (error) {
        // Invalid or expired token - reject explicitly
        if (error instanceof FirebaseTokenError) {
          console.error('[API][IssueReport][POST] Invalid auth token:', error.message);
          const errorResponse: IssueReportErrorResponse = {
            success: false,
            error: 'INVALID_TOKEN',
            message: 'Invalid or expired authentication token',
          };
          return NextResponse.json(errorResponse, { status: 401 });
        }
        throw error; // Re-throw unexpected errors
      }
    }

    // Step 2: Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('[API][IssueReport][POST] JSON parse error:', error);
      const errorResponse: IssueReportErrorResponse = {
        success: false,
        error: 'INVALID_JSON',
        message: 'Invalid JSON in request body',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Step 3: Validate payload against schema
    const validationResult = IssueReportPayloadSchema.safeParse(body);

    if (!validationResult.success) {
      console.error('[API][IssueReport][POST] Validation error:', validationResult.error.flatten());

      // Extract the first error message for a user-friendly response
      const firstError = validationResult.error.errors[0];
      let message = 'Invalid request data';

      if (firstError.path.includes('description')) {
        message = firstError.message;
      } else if (firstError.path.includes('notificationType')) {
        message = 'Invalid issue type';
      } else if (firstError.path.includes('problemId')) {
        message = 'Problem ID is required';
      }

      const errorResponse: IssueReportErrorResponse = {
        success: false,
        error: 'VALIDATION_ERROR',
        message,
        details: validationResult.error.flatten(),
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const payload = validationResult.data;

    console.log('[API][IssueReport][POST] Processing issue report', {
      userId: user?.uid || 'anonymous',
      notificationType: payload.notificationType,
      problemId: payload.problemId,
      companyId: payload.companyId,
      roleId: payload.roleId,
    });

    // Step 4: Report to Sentry
    let sentryEventId: string;
    try {
      sentryEventId = reportIssueToSentry({
        notificationType: payload.notificationType,
        problemId: payload.problemId,
        userId: user?.uid || 'anonymous',
        userEmail: user?.email || null,
        rawPrepareResponse: payload.rawPrepareResponse,
        companyId: payload.companyId,
        roleId: payload.roleId,
        userCode: payload.userCode,
        description: payload.description,
        consoleLogs: payload.consoleLogs,
        metadata: {
          userAgent: request.headers.get('user-agent') || undefined,
          reportedAt: new Date().toISOString(),
        },
      });

      console.log('[API][IssueReport][POST] Issue reported to Sentry', {
        sentryEventId,
        userId: user?.uid || 'anonymous',
        notificationType: payload.notificationType,
      });
    } catch (error) {
      console.error('[API][IssueReport][POST] Failed to report to Sentry:', error);

      // Try to report the error itself to Sentry
      try {
        reportIssueException(error as Error, {
          userId: user?.uid,
          problemId: payload.problemId,
          notificationType: payload.notificationType,
        });
      } catch (sentryError) {
        console.error('[API][IssueReport][POST] Failed to report error to Sentry:', sentryError);
      }

      const errorResponse: IssueReportErrorResponse = {
        success: false,
        error: 'SERVER_ERROR',
        message: 'Failed to submit issue report. Please try again later.',
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // Step 5: Flush Sentry buffer to ensure the event is sent before the serverless function terminates
    await Sentry.flush(2000);

    // Step 6: Return success response
    const successResponse: IssueReportSuccessResponse = {
      success: true,
      issueId: sentryEventId,
      message: "Issue reported successfully. We'll look into it!",
    };

    return NextResponse.json(successResponse, { status: 200 });
  } catch (error) {
    // Catch-all for unexpected errors
    console.error('[API][IssueReport][POST] Unexpected error:', error);

    // Try to report to Sentry
    try {
      reportIssueException(error as Error);
    } catch (sentryError) {
      console.error('[API][IssueReport][POST] Failed to report unexpected error to Sentry:', sentryError);
    }

    const errorResponse: IssueReportErrorResponse = {
      success: false,
      error: 'SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
