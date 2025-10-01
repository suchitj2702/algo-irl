/**
 * Role Analyzer - Analyzes alignment between problems and engineering roles
 */

import { RoleFamily, RoleProblemAlignment } from '@/data-types/role';
import { ExtractedProblemInfo } from '../types/transformationTypes';
import { ROLE_CONFIGURATIONS } from './roleConfigurations';

export class RoleAnalyzer {
  /**
   * Analyze how well a problem aligns with a specific engineering role.
   * This provides contextual guidance for generating role-specific scenarios.
   *
   * Analysis includes:
   * - Matching algorithms between problem and role preferences
   * - Relevant scenarios from the role configuration
   * - Overall alignment strength (low/medium/high)
   *
   * @param problemInfo - Extracted problem information
   * @param roleFamily - The engineering role to analyze against
   * @returns Detailed alignment analysis
   */
  analyzeRoleProblemAlignment(problemInfo: ExtractedProblemInfo, roleFamily: RoleFamily): RoleProblemAlignment {
    const roleConfig = ROLE_CONFIGURATIONS[roleFamily];

    if (!roleConfig) {
      // Return empty analysis if role not found
      return {
        matchingAlgorithms: [],
        relevantScenarios: [],
        alignmentStrength: 'low',
      };
    }

    const analysis: RoleProblemAlignment = {
      matchingAlgorithms: [],
      relevantScenarios: [],
      alignmentStrength: 'medium',
    };

    // Check algorithm alignment
    for (const algo of problemInfo.coreAlgorithms) {
      for (const preference of roleConfig.algorithmPreferences) {
        const algoLower = algo.toLowerCase();
        const prefLower = preference.toLowerCase();

        if (algoLower.includes(prefLower) || prefLower.includes(algoLower)) {
          analysis.matchingAlgorithms.push(`${algo} matches ${preference}`);
        }
      }
    }

    // Find relevant scenarios by checking keyword overlap
    for (const scenario of roleConfig.typicalScenarios) {
      const scenarioLower = scenario.toLowerCase();
      let relevance = 0;

      // Check if problem keywords or categories appear in the scenario
      for (const keyword of [...problemInfo.keywords, ...problemInfo.categories]) {
        if (scenarioLower.includes(keyword.toLowerCase())) {
          relevance += 1;
        }
      }

      // Also check if scenario mentions problem's data structures or algorithms
      for (const ds of problemInfo.dataStructures) {
        if (scenarioLower.includes(ds.toLowerCase())) {
          relevance += 1;
        }
      }

      for (const algo of problemInfo.coreAlgorithms) {
        if (scenarioLower.includes(algo.toLowerCase())) {
          relevance += 1;
        }
      }

      if (relevance > 0) {
        analysis.relevantScenarios.push(scenario);
      }
    }

    // Determine alignment strength based on matches
    const totalMatches = analysis.matchingAlgorithms.length + analysis.relevantScenarios.length;

    if (totalMatches >= 3) {
      analysis.alignmentStrength = 'high';
    } else if (totalMatches >= 1) {
      analysis.alignmentStrength = 'medium';
    } else {
      analysis.alignmentStrength = 'low';
    }

    return analysis;
  }

  /**
   * Get role configuration for a specific role family
   *
   * @param roleFamily - The role to get configuration for
   * @returns Role configuration or undefined if not found
   */
  getRoleConfiguration(roleFamily: RoleFamily) {
    return ROLE_CONFIGURATIONS[roleFamily];
  }
}