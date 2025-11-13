import * as Sentry from '@sentry/nextjs';
import {
  IssueNotificationType,
  IssueTypeLabels,
  type ConsoleLogEntry,
} from '@algo-irl/data-types/issueReport';

// Type for Sentry severity levels
type SeverityLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

/**
 * Issue report data structure for Sentry integration
 */
export interface IssueReportData {
  /** Type of issue being reported */
  notificationType: IssueNotificationType;

  /** Unique identifier for the problem */
  problemId: string;

  /** User ID from Firebase authentication */
  userId: string;

  /** User email from Firebase authentication (optional) */
  userEmail?: string | null;

  /** Raw response from the /api/problem/prepare endpoint */
  rawPrepareResponse: unknown;

  /** Company context if applicable */
  companyId: string | null;

  /** Role family if from study plan */
  roleId: string | null;

  /** User's code at time of report */
  userCode: string;

  /** User description (for OTHER_UI_ISSUE) */
  description: string | null;

  /** Console logs captured from frontend */
  consoleLogs: ConsoleLogEntry[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Maps issue notification types to Sentry severity levels
 */
const ISSUE_SEVERITY_MAP: Record<IssueNotificationType, SeverityLevel> = {
  [IssueNotificationType.TRANSFORMATION_QUALITY]: 'warning',
  [IssueNotificationType.TEST_CASE_FAILURE]: 'error',
  [IssueNotificationType.FORMATTING_ISSUE]: 'warning',
  [IssueNotificationType.EXECUTION_FAILURE]: 'error',
  [IssueNotificationType.OTHER_UI_ISSUE]: 'info',
};

/**
 * Truncates a string to a maximum length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '... (truncated)';
}

/**
 * Sanitizes and prepares raw prepare response for Sentry
 * Removes potentially sensitive data and limits size
 */
function sanitizeRawResponse(rawResponse: unknown): unknown {
  if (!rawResponse) return null;

  try {
    const responseStr = JSON.stringify(rawResponse);
    // Limit size to 50KB to avoid hitting Sentry payload limits
    if (responseStr.length > 50000) {
      return {
        _truncated: true,
        _originalSize: responseStr.length,
        _note: 'Response too large, truncated for Sentry',
        sample: responseStr.substring(0, 5000),
      };
    }
    return rawResponse;
  } catch {
    return { _error: 'Failed to serialize raw response' };
  }
}

/**
 * Reports an issue to Sentry with comprehensive context
 *
 * @param issueData - The issue report data
 * @returns Sentry event ID (used as issueId in API response)
 */
export function reportIssueToSentry(issueData: IssueReportData): string {
  const {
    notificationType,
    problemId,
    userId,
    userEmail,
    rawPrepareResponse,
    companyId,
    roleId,
    userCode,
    description,
    consoleLogs,
    metadata,
  } = issueData;

  // Get the severity level for this issue type
  const severity = ISSUE_SEVERITY_MAP[notificationType];

  // Get the human-readable label
  const issueLabel = IssueTypeLabels[notificationType];

  // Create the issue message
  const message = description
    ? `[${notificationType}] ${truncate(description, 200)}`
    : `[${notificationType}] ${issueLabel} - ${problemId}`;

  // Use withScope to create isolated context for this specific issue
  const eventId = Sentry.withScope((scope) => {
    // Set severity level
    scope.setLevel(severity);

    // Set searchable tags for filtering in Sentry UI
    scope.setTag('issue_type', notificationType);
    scope.setTag('problem_id', problemId);

    if (companyId) {
      scope.setTag('company_id', companyId);
    }

    if (roleId) {
      scope.setTag('role_id', roleId);
    }

    // Set user information
    scope.setUser({
      id: userId,
      email: userEmail || undefined,
    });

    // Set fingerprint for grouping similar issues together
    // Issues with same type + problem will be grouped
    scope.setFingerprint([notificationType, problemId]);

    // Add problem metadata context
    scope.setContext('problem_metadata', {
      problemId,
      companyId: companyId || 'N/A',
      roleId: roleId || 'N/A',
      issueType: notificationType,
      issueLabel,
    });

    // Add user code context (truncate to avoid payload size issues)
    if (userCode && userCode.length > 0) {
      scope.setContext('user_code', {
        code: truncate(userCode, 10000), // Max 10KB of code
        length: userCode.length,
        truncated: userCode.length > 10000,
      });
    }

    // Add console logs context
    if (consoleLogs && consoleLogs.length > 0) {
      // Only include last 20 logs to avoid payload size issues
      const logsToInclude = consoleLogs.slice(-20);

      scope.setContext('console_logs', {
        logs: logsToInclude.map((log) => ({
          timestamp: log.timestamp,
          level: log.level,
          message: truncate(log.message, 500), // Truncate each message
        })),
        totalLogs: consoleLogs.length,
        included: logsToInclude.length,
      });

      // Also add console logs as breadcrumbs for better timeline view
      logsToInclude.forEach((log) => {
        scope.addBreadcrumb({
          category: 'console',
          message: truncate(log.message, 200),
          level: log.level === 'error' ? 'error' : log.level === 'warn' ? 'warning' : 'info',
          timestamp: new Date(log.timestamp).getTime() / 1000,
        });
      });
    }

    // Add raw prepare response (sanitized and size-limited)
    if (rawPrepareResponse) {
      scope.setContext('raw_prepare_response', {
        data: sanitizeRawResponse(rawPrepareResponse),
      });
    }

    // Add any additional metadata
    if (metadata && Object.keys(metadata).length > 0) {
      scope.setContext('additional_metadata', metadata);
    }

    // Add a breadcrumb for the issue report event
    scope.addBreadcrumb({
      category: 'issue-report',
      message: `User reported: ${issueLabel}`,
      level: severity,
      data: {
        problemId,
        companyId: companyId || undefined,
        roleId: roleId || undefined,
        hasDescription: !!description,
        consoleLogsCount: consoleLogs.length,
      },
    });

    // Capture the issue as a message (not an exception)
    // This is appropriate for user-reported issues vs system errors
    return Sentry.captureMessage(message, severity);
  });

  // Validate that Sentry actually captured the event
  // If DSN is not configured, Sentry returns an empty string
  if (!eventId || eventId.trim() === '') {
    throw new Error(
      'Failed to report issue to Sentry: Event ID is empty. ' +
        'This usually means SENTRY_DSN is not configured. ' +
        'Check server logs for Sentry configuration errors.'
    );
  }

  return eventId;
}

/**
 * Reports an exception to Sentry with issue report context
 * Use this when an actual error/exception occurs during issue reporting
 *
 * @param error - The error to report
 * @param context - Optional context about the issue report
 * @returns Sentry event ID
 */
export function reportIssueException(
  error: Error,
  context?: {
    userId?: string;
    problemId?: string;
    notificationType?: IssueNotificationType;
  }
): string {
  return Sentry.withScope((scope) => {
    scope.setTag('error_category', 'issue-reporting-failure');

    if (context?.notificationType) {
      scope.setTag('issue_type', context.notificationType);
    }

    if (context?.problemId) {
      scope.setTag('problem_id', context.problemId);
    }

    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }

    return Sentry.captureException(error);
  });
}
