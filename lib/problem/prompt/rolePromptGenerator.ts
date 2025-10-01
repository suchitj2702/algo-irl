/**
 * Role Prompt Generator - Enhances base prompts with role-specific context
 *
 * Extends the BasePromptGenerator to add rich role-specific information including:
 * - Role-problem alignment analysis
 * - Role focus areas and algorithm preferences
 * - Company-specific role technologies
 * - Enhanced role requirements
 */

import { RoleFamily } from '@/data-types/role';
import { TransformationContext } from '../types/transformationTypes';
import { RoleAnalyzer } from '../role/roleAnalyzer';
import { BasePromptGenerator } from './basePromptGenerator';

export class RolePromptGenerator extends BasePromptGenerator {
  constructor(private roleAnalyzer: RoleAnalyzer) {
    super();
  }

  /**
   * Generate prompt with enhanced role-specific context.
   * Adds detailed role information to guide the AI in creating scenarios
   * that are highly relevant to specific engineering roles.
   *
   * Role Enhancement Includes:
   * - Problem-role alignment analysis (matching algorithms, relevant scenarios)
   * - Role configuration data (focus areas, metrics, typical scenarios)
   * - Company-specific role technologies (if available in company data)
   * - Enhanced requirements for role-appropriate framing
   *
   * @param context - Transformation context with problem and company info
   * @param roleFamily - Optional role to enhance the prompt for
   * @returns Role-enhanced prompt or base prompt if no role specified
   */
  generateOptimizedPromptWithRole(context: TransformationContext, roleFamily?: RoleFamily): string {
    const basePrompt = this.generateOptimizedPrompt(context);

    if (!roleFamily) {
      return basePrompt;
    }

    const roleConfig = this.roleAnalyzer.getRoleConfiguration(roleFamily);
    if (!roleConfig) {
      return basePrompt;
    }

    // Perform role-problem alignment analysis
    const alignment = this.roleAnalyzer.analyzeRoleProblemAlignment(context.problem, roleFamily);

    // Build role-specific context section
    let roleSection = `
ENHANCED ROLE-PROBLEM ANALYSIS:
* Role: ${roleConfig.title} at ${context.company.name}
* Problem-Role Alignment: ${alignment.alignmentStrength.toUpperCase()} RELEVANCE
* Focus Areas: ${roleConfig.focusAreas.slice(0, 3).join(', ')}
* Algorithm Preferences: ${roleConfig.algorithmPreferences.join(', ')}`;

    // Add matching algorithms if found
    if (alignment.matchingAlgorithms.length > 0) {
      roleSection += `
* Algorithm Matches: ${alignment.matchingAlgorithms.slice(0, 2).join('; ')}`;
    }

    // Add relevant scenarios if found
    if (alignment.relevantScenarios.length > 0) {
      roleSection += `
* Relevant Scenarios: ${alignment.relevantScenarios.slice(0, 2).join('; ')}`;
    }

    roleSection += `
* Key Metrics: ${roleConfig.keyMetrics.join(', ')}
* Typical Scenarios: ${roleConfig.typicalScenarios.slice(0, 2).join(', ')}`;

    // Add role-specific company technologies if available
    if (context.company.roleSpecificData) {
      const roleKey = roleFamily;
      const roleData = context.company.roleSpecificData[roleKey];

      if (roleData) {
        roleSection += `

COMPANY-SPECIFIC ROLE TECHNOLOGIES AT ${context.company.name.toUpperCase()}:
* Technologies Used: ${roleData.technologies.slice(0, 6).join(', ')}  # Show top 6
* Tools & Platforms: ${roleData.tools.slice(0, 4).join(', ')}  # Show top 4
* Frameworks: ${roleData.frameworks.slice(0, 3).join(', ')}  # Show top 3
* Real-World Challenges: ${roleData.typicalChallenges.slice(0, 3).join(', ')}  # Show top 3
* Key Performance Metrics: ${roleData.keyMetrics.slice(0, 4).join(', ')}  # Show top 4
* Actual Scenarios at ${context.company.name}: ${roleData.realWorldScenarios.slice(0, 3).join(', ')}  # Show top 3`;
      }
    }

    roleSection += `

ENHANCED ROLE-SPECIFIC REQUIREMENTS:
* Frame the problem in the context of a ${roleConfig.title} at ${context.company.name}
* Use realistic technologies and tools this role actually works with at ${context.company.name}
* Include specific metrics and terminology this role cares about
* Consider the expanded scenarios this role would encounter (${roleConfig.typicalScenarios.length} scenarios available)
* Emphasize challenges from ${roleConfig.focusAreas.slice(0, 2).join(', ')}
* Make the problem sound like something this role would actually solve at ${context.company.name}
* Use concrete technology names and industry-specific terminology where appropriate`;

    // Insert role section before "YOUR TASK:"
    const enhancedPrompt = basePrompt.replace('YOUR TASK:', roleSection + '\n\nYOUR TASK:');

    return enhancedPrompt;
  }
}