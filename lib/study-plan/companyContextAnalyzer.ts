/**
 * Company Context Analyzer
 *
 * This module analyzes how well a problem aligns with a specific company's
 * technology stack, engineering challenges, and domain focus. It ensures that
 * the same problem can rank differently at different companies based on their
 * unique technical context.
 *
 * Key Features:
 * - Tech stack overlap detection
 * - Domain concept matching
 * - Industry buzzword analysis
 * - Company-specific problem relevance
 */

import { Problem } from '@/data-types/problem';
import { Company } from '@/data-types/company';
import { ProblemRoleScore, CompanyContextAnalysis } from './types';

/**
 * Extract keywords from text for matching
 */
function extractKeywords(text: string): string[] {
  // Convert to lowercase and split on non-alphanumeric characters
  const words = text.toLowerCase().split(/[^a-z0-9]+/);

  // Filter out common words and very short words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'you', 'your', 'we', 'our', 'they'
  ]);

  return words.filter(w => w.length > 2 && !stopWords.has(w));
}

/**
 * Get combined text from problem for analysis
 * Combines description and solution approach for more comprehensive keyword extraction
 */
function getProblemText(problem: Problem): string {
  const parts = [problem.description];

  if (problem.solutionApproach) {
    parts.push(problem.solutionApproach);
  }

  return parts.join(' ');
}

/**
 * Calculate tech stack overlap between problem and company
 *
 * Analyzes whether the problem description/solution mentions technologies
 * that the company uses in their stack.
 *
 * @param problem - The problem to analyze
 * @param companyTech - Company's technologies array
 * @param techLayers - Optional tech stack layers (frontend, backend, etc.)
 * @returns Score between 0-1 indicating tech stack relevance
 */
export function calculateTechStackOverlap(
  problem: Problem,
  companyTech: string[],
  techLayers?: Record<string, string[]>
): number {
  const problemText = getProblemText(problem);
  const problemWords = extractKeywords(problemText);
  let matches = 0;

  // Check main technologies
  for (const tech of companyTech) {
    const techLower = tech.toLowerCase();

    // Check for exact or partial matches
    if (problemWords.some(w => w.includes(techLower) || techLower.includes(w))) {
      matches++;
    }
  }

  // Check tech layers (if provided) with half weight
  if (techLayers) {
    const allLayerTech = Object.values(techLayers).flat();
    for (const tech of allLayerTech) {
      const techLower = tech.toLowerCase();

      if (problemWords.some(w => w.includes(techLower) || techLower.includes(w))) {
        matches += 0.5;
      }
    }
  }

  // Normalize to 0-1 scale
  // Cap at 5 matches = perfect score (prevents over-weighting)
  const normalizedScore = Math.min(1, matches / 5);

  return normalizedScore;
}

/**
 * Calculate domain concept match between problem and company
 *
 * Checks if the problem's domain concepts (from role scoring) align
 * with the company's engineering challenges and problem domains.
 *
 * @param problemConcepts - Domain concepts from problem role scoring
 * @param engineeringChallenges - Company's engineering challenges by category
 * @param problemDomains - Company's focus problem domains
 * @returns Score between 0-1 indicating domain relevance
 */
export function calculateDomainConceptMatch(
  problemConcepts: string[],
  engineeringChallenges?: Record<string, string[]>,
  problemDomains?: string[]
): number {
  if (!engineeringChallenges && !problemDomains) {
    // No company domain data available
    return 0.5;  // Neutral score
  }

  let score = 0;
  const maxScore = problemConcepts.length;  // Max possible matches

  if (maxScore === 0) {
    return 0.5;  // No concepts to match, neutral score
  }

  // Extract all challenges from the nested structure
  const allChallenges = engineeringChallenges
    ? Object.values(engineeringChallenges).flat()
    : [];

  for (const concept of problemConcepts) {
    const conceptLower = concept.toLowerCase();

    // Check against engineering challenges (weight: 0.3 per match)
    if (allChallenges.some(c => {
      const challengeLower = c.toLowerCase();
      return challengeLower.includes(conceptLower) || conceptLower.includes(challengeLower);
    })) {
      score += 0.3;
    }

    // Check against problem domains (weight: 0.2 per match)
    if (problemDomains && problemDomains.some(d => {
      const domainLower = d.replace('_', ' ').toLowerCase();
      return conceptLower.includes(domainLower) || domainLower.includes(conceptLower);
    })) {
      score += 0.2;
    }
  }

  // Normalize to 0-1 scale
  return Math.min(1, score / maxScore);
}

/**
 * Calculate industry buzzword overlap
 *
 * Checks if the problem description/solution contains industry-specific
 * terminology that the company frequently uses.
 *
 * @param problem - The problem to analyze
 * @param buzzwords - Company's industry buzzwords
 * @returns Score between 0-1 indicating buzzword relevance
 */
export function calculateBuzzwordOverlap(
  problem: Problem,
  buzzwords?: string[]
): number {
  if (!buzzwords || buzzwords.length === 0) {
    return 0.5;  // Neutral score if no buzzwords provided
  }

  const problemText = getProblemText(problem);
  const textLower = problemText.toLowerCase();
  let matches = 0;

  for (const buzzword of buzzwords) {
    if (textLower.includes(buzzword.toLowerCase())) {
      matches++;
    }
  }

  // Normalize to 0-1 scale
  // Cap at 3 matches = perfect score
  return Math.min(1, matches / 3);
}

/**
 * Calculate overall company context boost
 *
 * Combines tech stack, domain concepts, and buzzwords into a single
 * company context score that differentiates problems across companies.
 *
 * @param problem - The problem to analyze
 * @param company - The company to analyze against
 * @param roleScoreData - Enhanced topic data from role scoring
 * @returns Complete company context analysis
 */
export function calculateCompanyContextBoost(
  problem: Problem,
  company: Company,
  roleScoreData: ProblemRoleScore
): CompanyContextAnalysis {
  // 1. Tech Stack Match (40% weight)
  const techStackMatch = calculateTechStackOverlap(
    problem,
    company.technologies,
    company.techStackLayers
  );

  // 2. Domain Concept Match (40% weight)
  const domainConceptMatch = calculateDomainConceptMatch(
    roleScoreData.enrichedTopics.domainConcepts,
    company.engineeringChallenges,
    company.problemDomains
  );

  // 3. Buzzword Match (20% weight)
  const buzzwordMatch = calculateBuzzwordOverlap(
    problem,
    company.industryBuzzwords
  );

  // 4. Calculate weighted overall boost
  const overallBoost =
    techStackMatch * 0.4 +
    domainConceptMatch * 0.4 +
    buzzwordMatch * 0.2;

  return {
    techStackMatch,
    domainConceptMatch,
    buzzwordMatch,
    overallBoost
  };
}

