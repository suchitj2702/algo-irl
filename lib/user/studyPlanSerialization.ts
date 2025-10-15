import { Timestamp, DocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { StudyPlanRequestPayload, StudyPlanResponsePayload } from './studyPlanValidation';

export interface StudyPlanProgressRecord {
  status?: 'not_started' | 'in_progress' | 'completed';
  completedProblems?: number;
  totalProblems?: number;
  currentDay?: number;
  lastUpdatedAt?: string;
  note?: string;
  problemProgress?: Record<string, {
    status: 'not_started' | 'in_progress' | 'solved';
    code?: string;
    isBookmarked: boolean;
    lastWorkedAt: string;
    attempts?: number;
    problemDetails?: {
      title: string;
      background: string;
      problemStatement: string;
      testCases: Array<{
        id?: string;
        stdin: string;
        expectedStdout: string;
        isSample: boolean;
        explanation?: string;
      }>;
      constraints: string[];
      requirements: string[];
      leetcodeUrl: string;
    };
    codeDetails?: {
      boilerplateCode: string;
      defaultUserCode: string;
      functionName: string;
      solutionStructureHint: string;
      language: string;
    };
  }>;
}

export interface StudyPlanRecord {
  id: string;
  config: StudyPlanRequestPayload;
  response: StudyPlanResponsePayload;
  progress?: StudyPlanProgressRecord | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function timestampToIso(value?: Timestamp | null): string | null {
  return value ? value.toDate().toISOString() : null;
}

function buildProgressRecord(data?: Record<string, unknown>): StudyPlanProgressRecord | undefined {
  if (!data) {
    return undefined;
  }

  const record: StudyPlanProgressRecord = {};

  if (typeof data.status === 'string') {
    record.status = data.status as StudyPlanProgressRecord['status'];
  }
  if (typeof data.completedProblems === 'number') {
    record.completedProblems = data.completedProblems;
  }
  if (typeof data.totalProblems === 'number') {
    record.totalProblems = data.totalProblems;
  }
  if (typeof data.currentDay === 'number') {
    record.currentDay = data.currentDay;
  }
  if (data.lastUpdatedAt instanceof Timestamp) {
    record.lastUpdatedAt = data.lastUpdatedAt.toDate().toISOString();
  } else if (typeof data.lastUpdatedAt === 'string') {
    record.lastUpdatedAt = data.lastUpdatedAt;
  }
  if (typeof data.note === 'string') {
    record.note = data.note;
  }

  // Serialize problemProgress map
  if (data.problemProgress && typeof data.problemProgress === 'object') {
    const problemProgressMap: Record<string, {
      status: 'not_started' | 'in_progress' | 'solved';
      code?: string;
      isBookmarked: boolean;
      lastWorkedAt: string;
      attempts?: number;
      problemDetails?: {
        title: string;
        background: string;
        problemStatement: string;
        testCases: Array<{
          id?: string;
          stdin: string;
          expectedStdout: string;
          isSample: boolean;
          explanation?: string;
        }>;
        constraints: string[];
        requirements: string[];
        leetcodeUrl: string;
      };
      codeDetails?: {
        boilerplateCode: string;
        defaultUserCode: string;
        functionName: string;
        solutionStructureHint: string;
        language: string;
      };
    }> = {};

    Object.entries(data.problemProgress as Record<string, unknown>).forEach(([problemId, progress]) => {
      const progressData = progress as {
        status: 'not_started' | 'in_progress' | 'solved';
        code?: string;
        isBookmarked?: boolean;
        lastWorkedAt: Timestamp | string;
        attempts?: number;
        problemDetails?: unknown;
        codeDetails?: unknown;
      };

      const item: typeof problemProgressMap[string] = {
        status: progressData.status,
        code: progressData.code,
        isBookmarked: Boolean(progressData.isBookmarked),
        lastWorkedAt: progressData.lastWorkedAt instanceof Timestamp
          ? progressData.lastWorkedAt.toDate().toISOString()
          : progressData.lastWorkedAt,
        attempts: typeof progressData.attempts === 'number' ? progressData.attempts : undefined
      };

      // Serialize problemDetails if present
      if (progressData.problemDetails && typeof progressData.problemDetails === 'object') {
        const details = progressData.problemDetails as Record<string, unknown>;
        item.problemDetails = {
          title: String(details.title || ''),
          background: String(details.background || ''),
          problemStatement: String(details.problemStatement || ''),
          testCases: Array.isArray(details.testCases) ? details.testCases : [],
          constraints: Array.isArray(details.constraints) ? details.constraints : [],
          requirements: Array.isArray(details.requirements) ? details.requirements : [],
          leetcodeUrl: String(details.leetcodeUrl || '')
        };
      }

      // Serialize codeDetails if present
      if (progressData.codeDetails && typeof progressData.codeDetails === 'object') {
        const code = progressData.codeDetails as Record<string, unknown>;
        item.codeDetails = {
          boilerplateCode: String(code.boilerplateCode || ''),
          defaultUserCode: String(code.defaultUserCode || ''),
          functionName: String(code.functionName || ''),
          solutionStructureHint: String(code.solutionStructureHint || ''),
          language: String(code.language || 'python')
        };
      }

      problemProgressMap[problemId] = item;
    });

    record.problemProgress = problemProgressMap;
  }

  return Object.keys(record).length > 0 ? record : undefined;
}

export function serializeStudyPlanDoc(doc: DocumentSnapshot<DocumentData>): StudyPlanRecord {
  const data = doc.data();

  if (!data) {
    throw new Error('Study plan document is missing data');
  }

  const progress = buildProgressRecord({
    status: data.progress?.status,
    completedProblems: data.progress?.completedProblems,
    totalProblems: data.progress?.totalProblems,
    currentDay: data.progress?.currentDay,
    lastUpdatedAt:
      data.progress?.lastUpdatedAt instanceof Timestamp
        ? data.progress.lastUpdatedAt.toDate().toISOString()
        : data.progress?.lastUpdatedAt,
    note: data.progress?.note,
    problemProgress: data.progress?.problemProgress,
  });

  return {
    id: doc.id,
    config: data.config,
    response: data.response,
    progress: progress ?? null,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}
