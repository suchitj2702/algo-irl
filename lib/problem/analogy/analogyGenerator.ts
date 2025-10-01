/**
 * Analogy Generator - Creates company-specific analogies using seeded randomization
 *
 * This generator uses multiple layers of data sources to create contextual analogies:
 * 1. Role-specific company data (if available)
 * 2. Role configuration scenarios (matching problem characteristics)
 * 3. Company engineering challenges (filtered by relevance)
 * 4. Notable systems
 * 5. Fallback patterns
 *
 * Uses seeded randomization for consistency within time windows while providing variety
 */

import { RoleFamily } from '@/data-types/role';
import { ExtractedProblemInfo, ExtractedCompanyInfo } from '../types/transformationTypes';
import { ROLE_CONFIGURATIONS } from '../role/roleConfigurations';

/**
 * Simple seeded random number generator for deterministic randomization
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Generate next random number (0-1)
   */
  next(): number {
    // Simple LCG algorithm
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  /**
   * Shuffle array in place using seeded random
   */
  shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export class AnalogyGenerator {
  /**
   * Generate suggested analogy points using enriched company data and role context.
   * Uses seeded randomization for consistency within hourly time windows.
   *
   * Multi-layered analogy selection strategy:
   * 1. Role-specific company data (if available)
   * 2. Role configuration scenarios (matching problem)
   * 3. Company engineering challenges (filtered)
   * 4. Notable systems
   * 5. Fallback patterns
   *
   * @param problemInfo - Extracted problem information
   * @param companyInfo - Extracted company information with enhanced fields
   * @param roleFamily - Optional role for role-specific analogies
   * @returns Array of up to 5 contextual analogy points
   */
  generateSuggestedAnalogyPoints(
    problemInfo: ExtractedProblemInfo,
    companyInfo: ExtractedCompanyInfo,
    roleFamily?: RoleFamily
  ): string[] {
    const analogyPoints: string[] = [];

    // Set seed based on company name + current hour for consistency within timeframe
    const currentHour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const seedString = `${companyInfo.name}_${currentHour}`;
    const seed = this.hashString(seedString);
    const random = new SeededRandom(seed);

    // Layer 1: Use role-specific company data if available
    if (roleFamily && companyInfo.roleSpecificData) {
      const roleKey = roleFamily;
      const roleData = companyInfo.roleSpecificData[roleKey];

      if (roleData) {
        // Use role-specific scenarios
        const scenarios = random.shuffle([...roleData.realWorldScenarios]);
        for (const scenario of scenarios.slice(0, 3)) {
          const scenarioLower = scenario.toLowerCase();

          // Check if scenario matches problem characteristics
          let matches = false;
          for (const algo of problemInfo.coreAlgorithms) {
            if (this.containsKeywords(scenarioLower, [algo.toLowerCase(), 'algorithm', 'optimization'])) {
              matches = true;
              break;
            }
          }

          for (const ds of problemInfo.dataStructures) {
            if (this.containsKeywords(scenarioLower, [ds.toLowerCase(), 'data', 'structure', 'system'])) {
              matches = true;
              break;
            }
          }

          if (matches) {
            analogyPoints.push(`${companyInfo.name}'s ${scenario}`);
          }
        }

        // Use role-specific challenges
        const challenges = random.shuffle([...roleData.typicalChallenges]);
        for (const challenge of challenges.slice(0, 2)) {
          const challengeLower = challenge.toLowerCase();

          let matches = false;
          for (const algo of problemInfo.coreAlgorithms) {
            if (algo.toLowerCase() in challengeLower || challengeLower.includes('optimization')) {
              matches = true;
              break;
            }
          }

          for (const ds of problemInfo.dataStructures) {
            if (ds.toLowerCase() in challengeLower || challengeLower.includes('data')) {
              matches = true;
              break;
            }
          }

          if (matches) {
            analogyPoints.push(`${companyInfo.name}'s ${challenge}`);
          }
        }
      }
    }

    // Layer 2: Use expanded role-specific analogies from ROLE_CONFIGURATIONS
    if (roleFamily && ROLE_CONFIGURATIONS[roleFamily]) {
      const roleConfig = ROLE_CONFIGURATIONS[roleFamily];

      // Prioritize scenarios that match problem characteristics
      const scenarios = random.shuffle([...roleConfig.typicalScenarios]);
      const matchingScenarios: string[] = [];

      for (const scenario of scenarios) {
        const scenarioLower = scenario.toLowerCase();

        // Check for algorithm matches
        for (const algo of problemInfo.coreAlgorithms) {
          if (this.containsKeywords(scenarioLower, [algo.toLowerCase(), 'algorithm', 'optimization', 'efficient'])) {
            matchingScenarios.push(`${companyInfo.name}'s ${scenario}`);
            break;
          }
        }

        // Check for data structure matches
        for (const ds of problemInfo.dataStructures) {
          if (this.containsKeywords(scenarioLower, [ds.toLowerCase(), 'data', 'structure', 'system', 'storage'])) {
            matchingScenarios.push(`${companyInfo.name}'s ${scenario}`);
            break;
          }
        }
      }

      // Add best matching scenarios (limit to 3)
      analogyPoints.push(...matchingScenarios.slice(0, 3));

      // Add some focus areas as context
      const focusAreas = random.shuffle([...roleConfig.focusAreas]);
      for (const focusArea of focusAreas.slice(0, 2)) {
        if (this.containsKeywords(focusArea.toLowerCase(), ['performance', 'optimization', 'design'])) {
          analogyPoints.push(`${companyInfo.name}'s ${focusArea}`);
        }
      }
    }

    // Layer 3: Use company's embedded analogy patterns if available
    if (companyInfo.analogyPatterns) {
      for (const ds of problemInfo.dataStructures) {
        const patterns = companyInfo.analogyPatterns[ds];
        if (patterns) {
          for (const pattern of patterns) {
            const analogy = typeof pattern === 'object' && 'analogy' in pattern ? pattern.analogy : String(pattern);
            analogyPoints.push(analogy);
          }
        }
      }
    }

    // Layer 4: Use company's engineering challenges if available
    if (companyInfo.engineeringChallenges) {
      const categories = random.shuffle(Object.keys(companyInfo.engineeringChallenges));

      for (const category of categories.slice(0, 2)) {
        const challenges = companyInfo.engineeringChallenges[category];
        if (challenges) {
          const shuffledChallenges = random.shuffle([...challenges]);

          for (const challenge of shuffledChallenges.slice(0, 1)) {
            const challengeLower = challenge.toLowerCase();

            // Check if challenge matches problem characteristics
            let matches = false;
            for (const algo of problemInfo.coreAlgorithms) {
              if (challengeLower.includes(algo.toLowerCase())) {
                matches = true;
                break;
              }
            }

            for (const ds of problemInfo.dataStructures) {
              if (challengeLower.includes(ds.toLowerCase())) {
                matches = true;
                break;
              }
            }

            if (matches) {
              analogyPoints.push(`${companyInfo.name}'s ${challenge}`);
            }
          }
        }
      }
    }

    // Layer 5: Use notable systems if available
    if (companyInfo.notableSystems) {
      const systems = random.shuffle([...companyInfo.notableSystems]);
      for (const system of systems.slice(0, 2)) {
        analogyPoints.push(`${companyInfo.name}'s ${system}`);
      }
    }

    // Layer 6: Fallback to basic pattern matching if no enriched data
    if (analogyPoints.length === 0) {
      analogyPoints.push(...this.generateBasicAnalogies(problemInfo, companyInfo));
    }

    // Final fallback
    if (analogyPoints.length === 0) {
      analogyPoints.push(`${companyInfo.name}'s engineering challenges in the ${companyInfo.domain} domain`);
    }

    // Remove duplicates while preserving order and limit to reasonable number
    const uniqueAnalogies = Array.from(new Set(analogyPoints));
    return uniqueAnalogies.slice(0, 5); // Limit to top 5 to avoid overwhelming prompts
  }

  /**
   * Generate basic analogies using data structure to product mappings
   */
  private generateBasicAnalogies(problemInfo: ExtractedProblemInfo, companyInfo: ExtractedCompanyInfo): string[] {
    const analogies: string[] = [];

    const dataStructureToProductMappings = [
      {
        dataStructure: 'Array',
        productPatterns: [
          { pattern: /search/i, analogy: 'search results list' },
          { pattern: /video|stream/i, analogy: 'video recommendations' },
          { pattern: /product|item|shop/i, analogy: 'product catalog' },
        ],
      },
      {
        dataStructure: 'Graph',
        productPatterns: [
          { pattern: /map|navigation/i, analogy: 'maps connections between locations' },
          { pattern: /social|network|connect/i, analogy: 'user connections network' },
          { pattern: /recommendation/i, analogy: 'recommendation system' },
        ],
      },
      {
        dataStructure: 'Tree',
        productPatterns: [
          { pattern: /file|document/i, analogy: 'file/folder hierarchy' },
          { pattern: /category|taxonomy/i, analogy: 'product category organization' },
          { pattern: /ui|interface/i, analogy: 'UI component hierarchy' },
        ],
      },
      {
        dataStructure: 'HashMap',
        productPatterns: [
          { pattern: /cache|memory/i, analogy: 'caching system' },
          { pattern: /user|profile/i, analogy: 'user profile store' },
          { pattern: /config|setting/i, analogy: 'configuration management' },
        ],
      },
    ];

    for (const dsInfo of dataStructureToProductMappings) {
      if (problemInfo.dataStructures.includes(dsInfo.dataStructure)) {
        for (const product of companyInfo.products) {
          for (const pPattern of dsInfo.productPatterns) {
            if (pPattern.pattern.test(product)) {
              analogies.push(`${companyInfo.name} ${pPattern.analogy}`);
            }
          }
        }
      }
    }

    return analogies;
  }

  /**
   * Check if text contains any of the keywords
   */
  private containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Simple string hash function for seeding
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}