/**
 * Role-specific data types for problem transformation
 */

/**
 * Engineering role families for targeted problem transformations
 */
export enum RoleFamily {
  BACKEND_SYSTEMS = 'backend',
  ML_DATA = 'ml',
  FRONTEND_FULLSTACK = 'frontend',
  INFRASTRUCTURE_PLATFORM = 'infrastructure',
  SECURITY_RELIABILITY = 'security'
}

/**
 * Role-specific technologies, tools, and context for a company
 */
export interface RoleSpecificData {
  /** Core technologies used by this role (10-15 items) */
  technologies: string[];

  /** Tools and platforms used (8-12 items) */
  tools: string[];

  /** Frameworks and libraries (6-8 items) */
  frameworks: string[];

  /** Key areas of responsibility (8-10 items) */
  focusAreas: string[];

  /** Common challenges for this role (6-8 items) */
  typicalChallenges: string[];

  /** Performance metrics this role cares about (6-8 items) */
  keyMetrics: string[];

  /** Realistic projects/scenarios (5-7 items) */
  realWorldScenarios: string[];
}

/**
 * Configuration for a specific engineering role
 * Defines focus areas, typical scenarios, and algorithm preferences
 */
export interface RoleConfiguration {
  /** Display title for the role */
  title: string;

  /** Primary areas of responsibility (15 items) */
  focusAreas: string[];

  /** Relevant problem types for this role (15 items) */
  relevantProblems: string[];

  /** Key performance metrics */
  keyMetrics: string[];

  /** Typical scenarios this role encounters (15 items) */
  typicalScenarios: string[];

  /** Preferred algorithms and patterns */
  algorithmPreferences: string[];
}

/**
 * Analysis of how well a problem aligns with a specific role
 */
export interface RoleProblemAlignment {
  /** Algorithms that match the role's preferences */
  matchingAlgorithms: string[];

  /** Scenarios from the role that are relevant to the problem */
  relevantScenarios: string[];

  /** Overall alignment strength */
  alignmentStrength: 'low' | 'medium' | 'high';
}

/**
 * Select a random role from available RoleFamily values.
 * This ensures diverse problem transformations when no specific role is requested.
 *
 * @returns A randomly selected RoleFamily value
 */
export function getRandomRole(): RoleFamily {
  const roles = Object.values(RoleFamily);
  const randomIndex = Math.floor(Math.random() * roles.length);
  return roles[randomIndex];
}