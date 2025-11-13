import { z } from 'zod';

/**
 * Issue notification types for AlgoIRL platform
 * Each type represents a specific category of user-reported issues
 */
export enum IssueNotificationType {
  /** Problem transformation doesn't match the selected company/role context */
  TRANSFORMATION_QUALITY = 'TRANSFORMATION_QUALITY',

  /** User's code passes on LeetCode but fails on AlgoIRL */
  TEST_CASE_FAILURE = 'TEST_CASE_FAILURE',

  /** Visual formatting issues with problem display or code editor */
  FORMATTING_ISSUE = 'FORMATTING_ISSUE',

  /** System errors preventing code execution or submission */
  EXECUTION_FAILURE = 'EXECUTION_FAILURE',

  /** Any other issue not covered by the above categories */
  OTHER_UI_ISSUE = 'OTHER_UI_ISSUE',
}

/**
 * Console log entry structure
 * Frontend captures and sanitizes console logs before sending
 */
export interface ConsoleLogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;

  /** Log level */
  level: 'log' | 'info' | 'warn' | 'error';

  /** Log message (sanitized - sensitive data removed by frontend) */
  message: string;
}

/**
 * Zod schema for console log entry validation
 */
export const ConsoleLogEntrySchema = z.object({
  timestamp: z.string().datetime(),
  level: z.enum(['log', 'info', 'warn', 'error']),
  message: z.string(),
});

/**
 * Issue report payload sent from frontend to backend API
 */
export const IssueReportPayloadSchema = z
  .object({
    /** Type of issue being reported */
    notificationType: z.nativeEnum(IssueNotificationType),

    /** Unique identifier for the problem (from LeetCode URL or problem title) */
    problemId: z.string().min(1, 'Problem ID is required'),

    /** Raw response from the /api/problem/prepare endpoint for debugging */
    rawPrepareResponse: z.unknown(),

    /** Company context if applicable (e.g., "meta", "google") */
    companyId: z.string().nullable(),

    /** Role family if from study plan (e.g., "backend", "frontend") */
    roleId: z.string().nullable(),

    /** User's current code in the editor at time of report */
    userCode: z.string(),

    /** User description - required only for OTHER_UI_ISSUE, otherwise must be null */
    description: z.string().nullable(),

    /** Last 10 console logs (sanitized to remove sensitive data) */
    consoleLogs: z.array(ConsoleLogEntrySchema),
  })
  .refine(
    (data) => {
      // For OTHER_UI_ISSUE, description is required and must be at least 10 characters
      if (data.notificationType === IssueNotificationType.OTHER_UI_ISSUE) {
        return data.description !== null && data.description.length >= 10;
      }
      return true;
    },
    {
      message: 'Description is required for other issues and must be at least 10 characters',
      path: ['description'],
    }
  )
  .refine(
    (data) => {
      // For all other issue types, description must be null
      if (data.notificationType !== IssueNotificationType.OTHER_UI_ISSUE) {
        return data.description === null;
      }
      return true;
    },
    {
      message: 'Description must be null for this issue type',
      path: ['description'],
    }
  );

/**
 * TypeScript type inferred from the Zod schema
 */
export type IssueReportPayload = z.infer<typeof IssueReportPayloadSchema>;

/**
 * Successful response from issue report API
 */
export interface IssueReportSuccessResponse {
  success: true;
  /** Unique identifier for this issue report (Sentry event ID) */
  issueId: string;
  /** Optional success message */
  message?: string;
}

/**
 * Error response from issue report API
 */
export interface IssueReportErrorResponse {
  success: false;
  /** Error code */
  error: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Union type for all possible API responses
 */
export type IssueReportResponse = IssueReportSuccessResponse | IssueReportErrorResponse;

/**
 * Issue type labels for display purposes
 */
export const IssueTypeLabels: Record<IssueNotificationType, string> = {
  [IssueNotificationType.TRANSFORMATION_QUALITY]: "Transformation doesn't match context",
  [IssueNotificationType.TEST_CASE_FAILURE]: 'Tests fail but pass on LeetCode',
  [IssueNotificationType.FORMATTING_ISSUE]: 'Formatting looks off',
  [IssueNotificationType.EXECUTION_FAILURE]: "Code doesn't submit/run at all",
  [IssueNotificationType.OTHER_UI_ISSUE]: 'Other issue',
};
