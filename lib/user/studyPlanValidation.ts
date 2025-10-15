import { z } from 'zod';
import { RoleFamily } from '@/data-types/role';

export const ProblemDifficultySchema = z.enum(['Easy', 'Medium', 'Hard']);

const DifficultyPreferenceSchema = z
  .object({
    easy: z.boolean().optional(),
    medium: z.boolean().optional(),
    hard: z.boolean().optional(),
  })
  .optional();

const EnrichedTopicsSchema = z.object({
  dataStructures: z.array(z.string()).default([]),
  algorithmPatterns: z.array(z.string()).default([]),
  domainConcepts: z.array(z.string()).default([]),
  complexityClass: z.string().optional(),
});

const FrequencyDataSchema = z.object({
  overall: z.number(),
  recency: z.array(z.string()),
  isActuallyAsked: z.boolean(),
});

const HotnessBreakdownSchema = z.object({
  frequency: z.number(),
  recency: z.number(),
  roleRelevance: z.number(),
  companyContext: z.number(),
});

export const EnrichedProblemSchema = z.object({
  problemId: z.string(),
  title: z.string(),
  difficulty: ProblemDifficultySchema,
  hotnessScore: z.number(),
  hotnessBreakdown: HotnessBreakdownSchema,
  frequencyData: FrequencyDataSchema,
  roleRelevance: z.number(),
  enrichedTopics: EnrichedTopicsSchema,
  estimatedTimeMinutes: z.number(),
  dayAssigned: z.number(),
  transformedScenario: z
    .object({
      title: z.string(),
      background: z.string(),
    })
    .optional(),
});

export const DailyPlanSchema = z.object({
  day: z.number().int().min(1),
  date: z.string(),
  problems: z.array(EnrichedProblemSchema),
  estimatedHours: z.number(),
  topics: z.array(z.string()),
});

const StudyPlanQualitySchema = z.object({
  actualCompanyProblems: z.number().int().min(0),
  extrapolatedProblems: z.number().int().min(0),
  topicCoverage: z.number().int().min(0),
});

export const StudyPlanMetadataSchema = z.object({
  companyName: z.string(),
  role: z.nativeEnum(RoleFamily),
  generatedAt: z.string(),
  quality: StudyPlanQualitySchema,
});

export const StudyPlanSchema = z.object({
  totalProblems: z.number().int().min(0),
  estimatedHours: z.number().min(0),
  dailySchedule: z.array(DailyPlanSchema),
  metadata: StudyPlanMetadataSchema,
});

export const StudyPlanRequestSchema = z.object({
  companyId: z.string().min(1),
  roleFamily: z.nativeEnum(RoleFamily),
  timeline: z.number().int().min(1).max(90),
  hoursPerDay: z.number().min(0.5).max(24),
  difficultyPreference: DifficultyPreferenceSchema,
  topicFocus: z.array(z.string().min(1)).optional(),
});

export const StudyPlanResponseSchema = z.object({
  studyPlan: StudyPlanSchema,
});

export const StudyPlanCreatePayloadSchema = z.object({
  config: StudyPlanRequestSchema,
  response: StudyPlanResponseSchema,
});

const ProblemProgressItemSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'solved']),
  code: z.string().optional(),
  isBookmarked: z.boolean().default(false),
  lastWorkedAt: z.string().datetime(),
  attempts: z.number().int().min(0).optional(),

  // Complete problem details for cross-device sync
  problemDetails: z.object({
    title: z.string(),
    background: z.string(),
    problemStatement: z.string(),
    testCases: z.array(z.object({
      id: z.string().optional(),
      stdin: z.string(),
      expectedStdout: z.string(),
      isSample: z.boolean(),
      explanation: z.string().optional()
    })),
    constraints: z.array(z.string()),
    requirements: z.array(z.string()),
    leetcodeUrl: z.string()
  }).optional(),

  // Complete code details for cross-device sync
  codeDetails: z.object({
    boilerplateCode: z.string(),
    defaultUserCode: z.string(),
    functionName: z.string(),
    solutionStructureHint: z.string(),
    language: z.string()
  }).optional()
});

export const StudyPlanProgressSchema = z
  .object({
    status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
    completedProblems: z.number().int().min(0).optional(),
    totalProblems: z.number().int().min(0).optional(),
    currentDay: z.number().int().min(0).optional(),
    lastUpdatedAt: z.string().datetime().optional(),
    note: z.string().max(1000).optional(),
    problemProgress: z.record(z.string(), ProblemProgressItemSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one progress field must be provided.',
  });

export type StudyPlanRequestPayload = z.infer<typeof StudyPlanRequestSchema>;
export type StudyPlanResponsePayload = z.infer<typeof StudyPlanResponseSchema>;
export type StudyPlanCreatePayload = z.infer<typeof StudyPlanCreatePayloadSchema>;
export type StudyPlanProgressUpdate = z.infer<typeof StudyPlanProgressSchema>;
export type ProblemProgressItem = z.infer<typeof ProblemProgressItemSchema>;
