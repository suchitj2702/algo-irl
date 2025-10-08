/**
 * Role-Adaptive Thresholds
 *
 * Problem: Fixed threshold=50 filters out 90% of Frontend/Security problems
 * Solution: Use role-specific thresholds based on actual score distributions
 *
 * Data Analysis (2,284 problems):
 * - Backend:        48.6% ≥50, 81.1% ≥40, 91.4% ≥30
 * - ML:             38.2% ≥50, 60.0% ≥40, 79.9% ≥30
 * - Infrastructure: 25.5% ≥50, 45.1% ≥40, 67.7% ≥30
 * - Frontend:       10.9% ≥50, 16.4% ≥40, 52.2% ≥30 ← Critical adjustment!
 * - Security:        7.5% ≥50, 12.1% ≥40, 28.7% ≥30 ← Critical adjustment!
 */

import { RoleFamily } from '@/data-types/role';

/**
 * Role-specific threshold configuration
 * Based on dataset analysis of 2,284 problems
 */
export interface RoleThresholdConfig {
  /** Preferred threshold (for high availability) */
  preferred: number;

  /** Acceptable threshold (fallback when preferred yields insufficient problems) */
  acceptable: number;

  /** Minimum threshold (emergency fallback) */
  minimum: number;
}

/**
 * Role score thresholds optimized for interview preparation
 *
 * Note: These thresholds differ from what would be used for "day-to-day work" scoring.
 * Interview problems often test broader skills than daily role responsibilities.
 */
export const ROLE_SCORE_THRESHOLDS: Record<RoleFamily, RoleThresholdConfig> = {
  backend: {
    preferred: 50,    // 49% of problems
    acceptable: 40,   // 81% of problems
    minimum: 30       // 91% of problems
  },

  ml: {
    preferred: 50,    // 38% of problems
    acceptable: 40,   // 60% of problems
    minimum: 30       // 80% of problems
  },

  frontend: {
    preferred: 40,    // 16% of problems (lowered from 50)
    acceptable: 30,   // 52% of problems ← KEY ADJUSTMENT
    minimum: 25       // 72% of problems
  },

  security: {
    preferred: 40,    // 12% of problems (lowered from 50)
    acceptable: 30,   // 29% of problems ← KEY ADJUSTMENT
    minimum: 20       // 57% of problems
  },

  infrastructure: {
    preferred: 50,    // 26% of problems
    acceptable: 40,   // 45% of problems
    minimum: 30       // 68% of problems
  }
};

/**
 * Get adaptive role score threshold based on availability
 *
 * @param role - Engineering role family
 * @param problemsAvailable - Number of problems available at current threshold
 * @param targetCount - Target number of problems needed
 * @returns Adaptive threshold (preferred, acceptable, or minimum)
 *
 * @example
 * // Frontend with 100 problems available, need 50
 * getAdaptiveThreshold('frontend', 100, 50)
 * // Returns: 30 (acceptable threshold, since 100 > 50 * 1.0)
 *
 * // Frontend with 20 problems available, need 50
 * getAdaptiveThreshold('frontend', 20, 50)
 * // Returns: 25 (minimum threshold, insufficient at acceptable)
 */
export function getAdaptiveThreshold(
  role: RoleFamily,
  problemsAvailable: number,
  targetCount: number
): number {
  const thresholds = ROLE_SCORE_THRESHOLDS[role];

  // If we have enough problems at preferred threshold, use it
  if (problemsAvailable >= targetCount * 1.5) {
    return thresholds.preferred;
  }

  // If not, relax to acceptable threshold
  if (problemsAvailable >= targetCount * 1.0) {
    return thresholds.acceptable;
  }

  // If still not enough, use minimum threshold
  return thresholds.minimum;
}

/**
 * Get threshold for a specific availability stage
 * Used in progressive fallback mechanism
 */
export function getThresholdForStage(
  role: RoleFamily,
  stage: 'preferred' | 'acceptable' | 'minimum'
): number {
  return ROLE_SCORE_THRESHOLDS[role][stage];
}

/**
 * Get all thresholds for a role
 */
export function getRoleThresholds(role: RoleFamily): RoleThresholdConfig {
  return ROLE_SCORE_THRESHOLDS[role];
}

/**
 * Check if a problem passes the threshold for a given role
 */
export function passesThreshold(
  roleScore: number,
  role: RoleFamily,
  thresholdType: 'preferred' | 'acceptable' | 'minimum' = 'acceptable'
): boolean {
  const threshold = ROLE_SCORE_THRESHOLDS[role][thresholdType];
  return roleScore >= threshold;
}

/**
 * Get expected problem availability at each threshold level
 * Based on dataset analysis
 */
export function getExpectedAvailability(role: RoleFamily): {
  preferred: number;
  acceptable: number;
  minimum: number;
} {
  // Percentages based on actual dataset analysis
  const availabilityMap: Record<RoleFamily, { preferred: number; acceptable: number; minimum: number }> = {
    backend: {
      preferred: 0.486,   // 48.6% at threshold 50
      acceptable: 0.811,  // 81.1% at threshold 40
      minimum: 0.914      // 91.4% at threshold 30
    },
    ml: {
      preferred: 0.382,   // 38.2% at threshold 50
      acceptable: 0.600,  // 60.0% at threshold 40
      minimum: 0.799      // 79.9% at threshold 30
    },
    frontend: {
      preferred: 0.164,   // 16.4% at threshold 40
      acceptable: 0.522,  // 52.2% at threshold 30
      minimum: 0.722      // 72.2% at threshold 25
    },
    security: {
      preferred: 0.121,   // 12.1% at threshold 40
      acceptable: 0.287,  // 28.7% at threshold 30
      minimum: 0.570      // 57.0% at threshold 20
    },
    infrastructure: {
      preferred: 0.255,   // 25.5% at threshold 50
      acceptable: 0.451,  // 45.1% at threshold 40
      minimum: 0.677      // 67.7% at threshold 30
    }
  };

  return availabilityMap[role];
}

/**
 * Estimate how many problems will be available for a role at different thresholds
 *
 * @param role - Engineering role family
 * @param totalProblems - Total problem count in database
 * @returns Estimated availability at each threshold level
 */
export function estimateAvailability(
  role: RoleFamily,
  totalProblems: number
): {
  preferred: number;
  acceptable: number;
  minimum: number;
} {
  const percentages = getExpectedAvailability(role);

  return {
    preferred: Math.floor(totalProblems * percentages.preferred),
    acceptable: Math.floor(totalProblems * percentages.acceptable),
    minimum: Math.floor(totalProblems * percentages.minimum)
  };
}
