import { Timestamp } from "firebase-admin/firestore";
import { RoleSpecificData } from './role';

export interface Company {
  id: string;
  name: string;
  description?: string;
  domain: string;
  products: string[];
  technologies: string[];
  interviewFocus: string[];
  logoUrl?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;

  // Enhanced context fields for richer problem transformation
  engineeringChallenges?: Record<string, string[]>;
  scaleMetrics?: Record<string, string>;
  techStackLayers?: Record<string, string[]>;
  problemDomains?: string[];
  industryBuzzwords?: string[];
  notableSystems?: string[];
  dataProcessingPatterns?: string[];
  optimizationPriorities?: string[];
  analogyPatterns?: Record<string, Array<{ context: string; analogy: string }>>;

  // Role-specific data for each engineering role
  roleSpecificData?: Record<string, RoleSpecificData>;
} 