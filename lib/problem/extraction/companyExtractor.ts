/**
 * Company Extractor - Extract and process company information for problem transformation
 */

import { Company } from '@/data-types/company';
import { ExtractedCompanyInfo, ExtractedProblemInfo } from '../types/transformationTypes';

export class CompanyExtractor {
  /**
   * Extract relevant company information for problem transformation context.
   * This function identifies company attributes that are relevant to the problem
   * and can be used to create meaningful analogies.
   *
   * Algorithm:
   * 1. Find technologies that align with problem keywords
   * 2. Find products that relate to problem domain
   * 3. Create consolidated list of relevant keywords
   * 4. Pass through all enhanced context fields
   * 5. Return structured company information
   *
   * @param company - The company object from database
   * @param problemKeywords - Keywords extracted from the problem
   * @returns Structured company information for transformation
   */
  extractCompanyInfo(company: Company, problemKeywords: string[]): ExtractedCompanyInfo {
    // Extract keywords that might be relevant to the company
    const relevantKeywords: string[] = [];

    // Find relevant technologies
    company.technologies.forEach((tech) => {
      problemKeywords.forEach((keyword) => {
        if (
          tech.toLowerCase().includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(tech.toLowerCase())
        ) {
          relevantKeywords.push(tech);
        }
      });
    });

    // Find relevant products
    company.products.forEach((product) => {
      const productLower = product.toLowerCase();
      problemKeywords.forEach((keyword) => {
        if (productLower.includes(keyword.toLowerCase())) {
          relevantKeywords.push(product);
        }
      });
    });

    return {
      name: company.name,
      domain: company.domain,
      products: company.products,
      technologies: company.technologies,
      interviewFocus: company.interviewFocus,
      relevantKeywords: [...new Set(relevantKeywords)], // Remove duplicates
      // Pass through enhanced context fields for rich transformations
      engineeringChallenges: company.engineeringChallenges,
      scaleMetrics: company.scaleMetrics,
      techStackLayers: company.techStackLayers,
      problemDomains: company.problemDomains,
      industryBuzzwords: company.industryBuzzwords,
      notableSystems: company.notableSystems,
      dataProcessingPatterns: company.dataProcessingPatterns,
      optimizationPriorities: company.optimizationPriorities,
      analogyPatterns: company.analogyPatterns,
      // Pass through role-specific data for role-based transformations
      roleSpecificData: company.roleSpecificData,
    };
  }

  /**
   * Calculate a relevance score between a problem and company.
   * This scoring algorithm determines how well a company context
   * matches with a given problem for transformation purposes.
   *
   * Scoring Algorithm:
   * 1. Technology alignment: +2 points for each tech matching problem concepts
   * 2. Interview focus alignment: +2 points for relevant focus areas
   * 3. Domain relevance: +1 point for domain keyword matches
   * 4. Relevant keywords: +1 point per relevant keyword
   *
   * @param problemInfo - Extracted problem information
   * @param companyInfo - Extracted company information
   * @returns Numerical relevance score (higher = more relevant)
   */
  calculateRelevanceScore(problemInfo: ExtractedProblemInfo, companyInfo: ExtractedCompanyInfo): number {
    let score = 0;

    // Check if any company technologies align with problem data structures or algorithms
    companyInfo.technologies.forEach((tech) => {
      const techLower = tech.toLowerCase();

      problemInfo.dataStructures.forEach((ds) => {
        if (techLower.includes(ds.toLowerCase()) || ds.toLowerCase().includes(techLower)) {
          score += 2;
        }
      });

      problemInfo.coreAlgorithms.forEach((algo) => {
        if (techLower.includes(algo.toLowerCase()) || algo.toLowerCase().includes(techLower)) {
          score += 2;
        }
      });
    });

    // Check if company interview focus aligns with problem characteristics
    companyInfo.interviewFocus.forEach((focus) => {
      const focusLower = focus.toLowerCase();

      if (focusLower.includes('algorithm') && problemInfo.coreAlgorithms.length > 0) {
        score += 2;
      }
      if (focusLower.includes('data structure') && problemInfo.dataStructures.length > 0) {
        score += 2;
      }
      if (focusLower.includes('system design') && problemInfo.difficulty === 'Hard') {
        score += 2;
      }
      if (focusLower.includes('scale') && problemInfo.keywords.includes('efficient')) {
        score += 2;
      }
    });

    // Add points for company domain relevance
    const domainLower = companyInfo.domain.toLowerCase();
    problemInfo.keywords.forEach((keyword) => {
      if (domainLower.includes(keyword.toLowerCase())) {
        score += 1;
      }
    });

    // Additional points for relevant keywords
    score += companyInfo.relevantKeywords.length;

    return score;
  }
}