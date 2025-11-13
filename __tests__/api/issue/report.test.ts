// Mock dependencies BEFORE importing anything
jest.mock('@algo-irl/lib/auth/verifyFirebaseToken', () => ({
  requireUser: jest.fn(),
}));

jest.mock('@algo-irl/lib/sentry/reportIssue', () => ({
  reportIssueToSentry: jest.fn(),
  reportIssueException: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { IssueNotificationType } from '@algo-irl/data-types/issueReport';
import {
  MissingAuthorizationHeaderError,
  ExpiredFirebaseTokenError,
  MalformedAuthorizationHeaderError,
} from '@algo-irl/lib/auth/tokenUtils';
import { POST } from '@/app/api/issue/report/route';

const { requireUser } = jest.requireMock('@algo-irl/lib/auth/verifyFirebaseToken') as {
  requireUser: jest.Mock;
};

const { reportIssueToSentry } = jest.requireMock('@algo-irl/lib/sentry/reportIssue') as {
  reportIssueToSentry: jest.Mock;
};

describe('POST /api/issue/report', () => {
  const mockUser = {
    uid: 'test-user-123',
    email: 'test@example.com',
    emailVerified: true,
    providerIds: ['password'],
  };

  const validPayload = {
    notificationType: IssueNotificationType.TEST_CASE_FAILURE,
    problemId: 'two-sum',
    rawPrepareResponse: {
      problem: { title: 'Two Sum' },
      codeDetails: { language: 'python' },
    },
    companyId: 'meta',
    roleId: null,
    userCode: 'def twoSum(nums, target):\n    return []',
    description: null,
    consoleLogs: [
      {
        timestamp: '2025-11-13T10:00:00.000Z',
        level: 'error' as const,
        message: 'Test failed',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    requireUser.mockResolvedValue({ user: mockUser });
    reportIssueToSentry.mockReturnValue('sentry-event-id-123');
  });

  describe('Authentication', () => {
    it('should allow anonymous reporting (no auth header)', async () => {
      // No auth header provided - requireUser should not be called
      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(requireUser).not.toHaveBeenCalled();
      expect(reportIssueToSentry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'anonymous',
          userEmail: null,
        })
      );
    });

    it('should return 401 when auth token is invalid (expired)', async () => {
      requireUser.mockRejectedValue(new ExpiredFirebaseTokenError());

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer expired-token' },
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_TOKEN');
      expect(data.message).toBe('Invalid or expired authentication token');
      expect(reportIssueToSentry).not.toHaveBeenCalled();
    });

    it('should return 401 when auth token is malformed', async () => {
      requireUser.mockRejectedValue(new MalformedAuthorizationHeaderError());

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'InvalidFormat' },
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_TOKEN');
      expect(data.message).toBe('Invalid or expired authentication token');
      expect(reportIssueToSentry).not.toHaveBeenCalled();
    });

    it('should authenticate successfully with valid Firebase token', async () => {
      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(requireUser).toHaveBeenCalledWith(request);
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(reportIssueToSentry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.uid,
          userEmail: mockUser.email,
        })
      );
    });
  });

  describe('Validation', () => {
    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_JSON');
    });

    it('should return 400 when required fields are missing', async () => {
      const invalidPayload = {
        notificationType: IssueNotificationType.TEST_CASE_FAILURE,
        // Missing problemId
        rawPrepareResponse: {},
        companyId: null,
        roleId: null,
        userCode: '',
        description: null,
        consoleLogs: [],
      };

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when notificationType is invalid', async () => {
      const invalidPayload = {
        ...validPayload,
        notificationType: 'INVALID_TYPE',
      };

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when OTHER_UI_ISSUE is missing description', async () => {
      const invalidPayload = {
        ...validPayload,
        notificationType: IssueNotificationType.OTHER_UI_ISSUE,
        description: null, // Should not be null for OTHER_UI_ISSUE
      };

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.message).toContain('Description is required');
    });

    it('should return 400 when OTHER_UI_ISSUE description is too short', async () => {
      const invalidPayload = {
        ...validPayload,
        notificationType: IssueNotificationType.OTHER_UI_ISSUE,
        description: 'short', // Less than 10 characters
      };

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when non-OTHER_UI_ISSUE has description', async () => {
      const invalidPayload = {
        ...validPayload,
        notificationType: IssueNotificationType.TEST_CASE_FAILURE,
        description: 'This should not be here', // Should be null
      };

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('Successful Issue Reporting', () => {
    it('should successfully report TEST_CASE_FAILURE', async () => {
      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.issueId).toBe('sentry-event-id-123');
      expect(data.message).toBeTruthy();

      expect(reportIssueToSentry).toHaveBeenCalledWith({
        notificationType: IssueNotificationType.TEST_CASE_FAILURE,
        problemId: 'two-sum',
        userId: mockUser.uid,
        userEmail: mockUser.email,
        rawPrepareResponse: validPayload.rawPrepareResponse,
        companyId: 'meta',
        roleId: null,
        userCode: validPayload.userCode,
        description: null,
        consoleLogs: validPayload.consoleLogs,
        metadata: expect.objectContaining({
          reportedAt: expect.any(String),
        }),
      });
    });

    it('should successfully report TRANSFORMATION_QUALITY', async () => {
      const payload = {
        ...validPayload,
        notificationType: IssueNotificationType.TRANSFORMATION_QUALITY,
      };

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(reportIssueToSentry).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationType: IssueNotificationType.TRANSFORMATION_QUALITY,
        })
      );
    });

    it('should successfully report FORMATTING_ISSUE', async () => {
      const payload = {
        ...validPayload,
        notificationType: IssueNotificationType.FORMATTING_ISSUE,
      };

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should successfully report EXECUTION_FAILURE', async () => {
      const payload = {
        ...validPayload,
        notificationType: IssueNotificationType.EXECUTION_FAILURE,
      };

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should successfully report OTHER_UI_ISSUE with description', async () => {
      const payload = {
        ...validPayload,
        notificationType: IssueNotificationType.OTHER_UI_ISSUE,
        description: 'The button is not clickable on mobile devices',
      };

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(reportIssueToSentry).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationType: IssueNotificationType.OTHER_UI_ISSUE,
          description: 'The button is not clickable on mobile devices',
        })
      );
    });

    it('should include console logs in Sentry report', async () => {
      const payloadWithLogs = {
        ...validPayload,
        consoleLogs: [
          {
            timestamp: '2025-11-13T10:00:00.000Z',
            level: 'error' as const,
            message: 'Test case 1 failed',
          },
          {
            timestamp: '2025-11-13T10:00:01.000Z',
            level: 'warn' as const,
            message: 'Warning: memory usage high',
          },
        ],
      };

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(payloadWithLogs),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(reportIssueToSentry).toHaveBeenCalledWith(
        expect.objectContaining({
          consoleLogs: payloadWithLogs.consoleLogs,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when Sentry reporting fails', async () => {
      reportIssueToSentry.mockImplementation(() => {
        throw new Error('Sentry is down');
      });

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('SERVER_ERROR');
      expect(data.message).toContain('Failed to submit issue report');
    });

    it('should return 500 for unexpected errors', async () => {
      requireUser.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('SERVER_ERROR');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty console logs array', async () => {
      const payload = {
        ...validPayload,
        consoleLogs: [],
      };

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(reportIssueToSentry).toHaveBeenCalledWith(
        expect.objectContaining({
          consoleLogs: [],
        })
      );
    });

    it('should handle empty user code', async () => {
      const payload = {
        ...validPayload,
        userCode: '',
      };

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(reportIssueToSentry).toHaveBeenCalledWith(
        expect.objectContaining({
          userCode: '',
        })
      );
    });

    it('should handle null companyId and roleId', async () => {
      const payload = {
        ...validPayload,
        companyId: null,
        roleId: null,
      };

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(reportIssueToSentry).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: null,
          roleId: null,
        })
      );
    });

    it('should handle user without email', async () => {
      requireUser.mockResolvedValue({
        user: {
          ...mockUser,
          email: null,
        },
      });

      const request = new NextRequest('http://localhost:3000/api/issue/report', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(reportIssueToSentry).toHaveBeenCalledWith(
        expect.objectContaining({
          userEmail: null,
        })
      );
    });
  });
});
