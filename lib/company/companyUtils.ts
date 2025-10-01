import { adminDb } from '../firebase/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Company } from "@/data-types/company";
import { generateCompanyDataWithPrompt } from "@/lib/llmServices/llmUtils";

/**
 * Company Management Utilities
 * 
 * This module provides comprehensive company data management functionality including:
 * - AI-powered company data generation
 * - Firestore CRUD operations for company records
 * - Company name validation and correction
 * - Bulk company initialization for major tech companies
 */

/**
 * Converts Company objects to Firestore-compatible data format.
 * This function handles timestamp conversion and removes the ID field for storage.
 * 
 * @param modelObject - Partial Company object to convert
 * @returns Firestore-compatible data object with proper timestamp handling
 */
const convertCompanyToFirestore = (
  modelObject: Partial<Company>
): Record<string, unknown> => {
  const data = { ...modelObject } as Partial<Company>;
  delete data.id; // Remove ID as it's handled by Firestore document ID
  
  data.updatedAt = Timestamp.now();
  if (!data.createdAt) {
    data.createdAt = Timestamp.now();
  }
  
  // Convert Date objects to Firestore Timestamps if needed
  if (data.createdAt instanceof Date) {
    data.createdAt = Timestamp.fromDate(data.createdAt);
  }
  if (data.updatedAt instanceof Date) {
    data.updatedAt = Timestamp.fromDate(data.updatedAt);
  }
  return data as Record<string, unknown>;
};

/**
 * Converts Firestore document data to Company objects.
 * This function provides type safety and default values for company data.
 * Handles both basic fields and enhanced context fields including role-specific data.
 *
 * @param doc - Firestore document snapshot containing company data
 * @returns Properly typed Company object with defaults for missing fields
 */
const convertFirestoreToCompany = (doc: FirebaseFirestore.DocumentSnapshot): Company => {
  const data = doc.data()!;
  return {
    id: doc.id,
    name: typeof data.name === 'string' ? data.name : "Unknown Company",
    description: typeof data.description === 'string' ? data.description : "No description available",
    domain: typeof data.domain === 'string' ? data.domain : "Technology",
    products: Array.isArray(data.products) ? data.products : [],
    technologies: Array.isArray(data.technologies) ? data.technologies : [],
    interviewFocus: Array.isArray(data.interviewFocus) ? data.interviewFocus : [],
    logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : undefined,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : Timestamp.now(),
    // Enhanced context fields
    engineeringChallenges: data.engineeringChallenges || undefined,
    scaleMetrics: data.scaleMetrics || undefined,
    techStackLayers: data.techStackLayers || undefined,
    problemDomains: Array.isArray(data.problemDomains) ? data.problemDomains : undefined,
    industryBuzzwords: Array.isArray(data.industryBuzzwords) ? data.industryBuzzwords : undefined,
    notableSystems: Array.isArray(data.notableSystems) ? data.notableSystems : undefined,
    dataProcessingPatterns: Array.isArray(data.dataProcessingPatterns) ? data.dataProcessingPatterns : undefined,
    optimizationPriorities: Array.isArray(data.optimizationPriorities) ? data.optimizationPriorities : undefined,
    analogyPatterns: data.analogyPatterns || undefined,
    roleSpecificData: data.roleSpecificData || undefined,
  };
};

/**
 * Initializes major tech companies in Firestore using AI-powered data generation.
 * This function bootstraps the system with data for major technology companies
 * commonly used in technical interviews.
 * 
 * Companies Initialized:
 * - Meta (Facebook)
 * - Amazon
 * - Apple
 * - Netflix
 * - Google
 * - Microsoft
 * 
 * Process:
 * 1. Iterate through predefined list of major tech companies
 * 2. Generate comprehensive company data using AI
 * 3. Store each company in Firestore
 * 4. Handle errors gracefully and log progress
 * 
 * @throws Error if any company initialization fails
 */
export async function initializeTechCompanies(): Promise<void> {
  try {
    // List of major tech companies to initialize
    const companyNames = ["Meta", "Amazon", "Apple", "Netflix", "Google", "Microsoft"];
    
    // Generate and add each company using AI
    for (const companyName of companyNames) {
      console.log(`Initializing company data for ${companyName}...`);
      
      // Use our AI generation function
      await generateCompanyDataWithAI(companyName);
      
      console.log(`Successfully initialized ${companyName}`);
    }
    
    console.log("Tech companies initialized successfully");
  } catch (error) {
    console.error("Error initializing tech companies:", error);
    throw error;
  }
}

/**
 * Retrieves a company by its unique identifier from Firestore.
 * 
 * @param companyId - The unique ID of the company to retrieve
 * @returns Promise resolving to Company object or null if not found
 * @throws Error if database operation fails
 */
export async function getCompanyById(companyId: string): Promise<Company | null> {
  try {
    const db = adminDb();
    const docRef = db.collection('companies-v2').doc(companyId);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      return convertFirestoreToCompany(docSnap);
    } else {
      console.log(`Company with ID ${companyId} not found`);
      return null;
    }
  } catch (error) {
    console.error(`Error getting company with ID ${companyId}:`, error);
    throw error;
  }
}

/**
 * Retrieves all companies from Firestore with optional pagination.
 * 
 * @param options - Optional query parameters including limit for pagination
 * @returns Promise resolving to array of all Company objects
 * @throws Error if database operation fails
 */
export async function getAllCompanies(options?: { limit?: number }): Promise<Company[]> {
  try {
    const db = adminDb();
    const collectionRef = db.collection('companies-v2');
    
    if (options?.limit) {
      const querySnapshot = await collectionRef.limit(options.limit).get();
      const companies: Company[] = [];
      
      querySnapshot.forEach((doc) => {
        companies.push(convertFirestoreToCompany(doc));
      });
      
      return companies;
    } else {
      const querySnapshot = await collectionRef.get();
      const companies: Company[] = [];
      
      querySnapshot.forEach((doc) => {
        companies.push(convertFirestoreToCompany(doc));
      });
      
      return companies;
    }
  } catch (error) {
    console.error("Error getting all companies:", error);
    throw error;
  }
}

/**
 * Retrieves companies filtered by their business domain.
 * This function enables filtering companies by industry or domain type.
 * 
 * @param domain - The business domain to filter by (e.g., "Technology", "Finance")
 * @returns Promise resolving to array of companies in the specified domain
 * @throws Error if database operation fails
 */
export async function getCompaniesByDomain(domain: string): Promise<Company[]> {
  try {
    const db = adminDb();
    const querySnapshot = await db.collection('companies-v2')
      .where('domain', '==', domain)
      .get();
    
    const companies: Company[] = [];
    
    querySnapshot.forEach((doc) => {
      companies.push(convertFirestoreToCompany(doc));
    });
    
    return companies;
  } catch (error) {
    console.error(`Error getting companies by domain ${domain}:`, error);
    throw error;
  }
}

/**
 * Generates comprehensive company data using AI and saves to Firestore.
 * This is the main function for creating new company records with AI-generated content.
 *
 * Workflow:
 * 1. Check if company already exists in database
 * 2. If exists, return existing data
 * 3. If new, generate comprehensive company data using AI:
 *    - Company description and domain
 *    - List of main products/services
 *    - Key technologies used
 *    - Interview focus areas for engineers
 *    - Logo URL if available
 *    - Enhanced context fields (engineering challenges, scale metrics, etc.)
 *    - Role-specific data for 5 engineering roles
 * 4. Parse AI response and validate JSON format
 * 5. Save to Firestore with proper error handling
 * 6. Return complete company object
 *
 * @param companyName - The name of the company to generate
 * @returns Promise resolving to complete Company object
 * @throws Error if AI generation fails or database operation fails
 */
export async function generateCompanyDataWithAI(companyName: string): Promise<Company> {
  try {
    // Create company ID from the company name (normalized for storage)
    const companyId = companyName.toLowerCase().replace(/\s+/g, '');
    
    // Check if company already exists in Firestore
    const db = adminDb();
    const docRef = db.collection('companies-v2').doc(companyId);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      console.log(`Company ${companyName} already exists, returning existing data`);
      return convertFirestoreToCompany(docSnap);
    }
    
    // Construct comprehensive prompt for AI company data generation
    // Use web search to find current, accurate information about the company
    const customPrompt = `
I need detailed information about the company "${companyName}" in JSON format, including role-specific technologies and data points.

Use web search to find current, accurate information about ${companyName}'s:
- Latest technology stack and tools
- Current products and services
- Recent engineering blog posts or tech talks
- Job postings for role-specific technologies
- Scale metrics and engineering challenges

REQUIRED FIELDS (for backward compatibility):
Please provide the following information:
1. A concise description of what the company does
2. The company's primary domain/industry (as many as possible)
3. List of main products or services (as many as possible)
4. List of key technologies used at the company (as many as possible)
5. List of typical interview focus areas for engineers at this company (as many as possible)
6. A URL to the company's logo (if well-known)

ENHANCED FIELDS (for richer context):
7. Engineering challenges organized by category (as many as possible)
8. Scale metrics (e.g., number of users, requests per day) (as many as possible)
9. Tech stack organized by layer (frontend, backend, data, infrastructure) (as many as possible)
10. Problem domains the company focuses on (as many as possible)
11. Industry-specific buzzwords and terminology (as many as possible)
12. Notable internal systems or technologies
13. Data processing patterns used (as many as possible)
14. Optimization priorities (as many as possible)
15. Company-specific analogy patterns for different data structures (as many as possible)

ROLE-SPECIFIC DATA (for each engineering role at ${companyName}):
16. For each role (backend, ml, frontend, infrastructure, security), provide COMPREHENSIVE and RICH data:
    - technologies: 10-15 specific technologies this role uses at ${companyName} (include languages, databases, frameworks, tools)
    - tools: 8-12 tools/platforms commonly used by this role (dev tools, monitoring, deployment, etc.)
    - frameworks: 6-8 frameworks/libraries this role works with (be specific to the role and company)
    - focusAreas: 8-10 primary areas of responsibility (comprehensive coverage of the role)
    - typicalChallenges: 6-8 real challenges this role faces at ${companyName} (technical and business challenges)
    - keyMetrics: 6-8 performance metrics this role cares about (quantitative and qualitative measures)
    - realWorldScenarios: 5-7 realistic projects/scenarios this role would work on (diverse and company-specific)

Consider ${companyName}'s actual business domain and technology stack when generating role-specific data.

Format your response as valid JSON ONLY with these exact fields:
{
  "description": "string description here",
  "domain": "string domain here",
  "products": ["product1", "product2", "product3"],
  "technologies": ["tech1", "tech2", "tech3"],
  "interviewFocus": ["focus1", "focus2", "focus3"],
  "logoUrl": "https://example.com/logo.png or null if unknown",

  "engineeringChallenges": {
    "scalability": ["challenge1", "challenge2"],
    "reliability": ["challenge3"],
    "performance": ["challenge4"]
  },
  "scaleMetrics": {
    "users": "2B+ monthly active",
    "requestsPerDay": "100B+"
  },
  "techStackLayers": {
    "frontend": ["React", "TypeScript"],
    "backend": ["Java", "Python"]
  },
  "problemDomains": ["distributed_systems", "machine_learning"],
  "industryBuzzwords": ["term1", "term2"],
  "notableSystems": ["System1", "System2"],
  "dataProcessingPatterns": ["streaming", "batch"],
  "optimizationPriorities": ["latency", "throughput"],

  "analogyPatterns": {
    "Array": [
      {"context": "search", "analogy": "${companyName} search results ranking"}
    ],
    "Graph": [
      {"context": "social", "analogy": "${companyName} user network"}
    ]
  },

  "roleSpecificData": {
    "backend": {
      "technologies": ["Docker", "Kubernetes", "Redis", "PostgreSQL", "gRPC", "Java", "Python", "Go", "Elasticsearch", "Kafka", "MongoDB", "Cassandra", "RabbitMQ", "Istio", "Helm"],
      "tools": ["Jenkins", "Prometheus", "Grafana", "ElasticSearch", "SonarQube", "Nexus", "Vault", "Consul", "Jaeger", "Zipkin", "Datadog", "PagerDuty"],
      "frameworks": ["Spring Boot", "Django", "Express.js", "FastAPI", "Gin", "Echo", "Hibernate", "SQLAlchemy"],
      "focusAreas": ["API design and versioning", "database optimization", "caching strategies", "microservices architecture", "event-driven systems", "performance tuning", "security implementation", "scalability planning", "monitoring and observability", "distributed systems design"],
      "typicalChallenges": ["rate limiting and throttling", "distributed transactions", "data consistency", "service discovery", "circuit breaker implementation", "database sharding", "event ordering", "cross-service communication"],
      "keyMetrics": ["requests per second", "p99 latency", "error rate", "throughput", "CPU utilization", "memory usage", "database connection pool efficiency", "cache hit ratio"],
      "realWorldScenarios": ["design distributed rate limiter", "optimize database queries", "implement event sourcing", "build API gateway", "create microservices mesh", "design caching layer", "implement distributed locking"]
    },
    "ml": {
      "technologies": ["TensorFlow", "PyTorch", "Apache Spark", "Airflow", "MLflow", "Python", "SQL", "Snowflake", "BigQuery", "Databricks", "Ray", "Feast", "Apache Kafka", "Elasticsearch", "Docker"],
      "tools": ["Jupyter", "Kubeflow", "DVC", "Weights & Biases", "MLflow", "TensorBoard", "Apache Airflow", "Great Expectations", "Kedro", "ClearML", "Neptune", "Grafana"],
      "frameworks": ["Scikit-learn", "XGBoost", "Hugging Face", "LightGBM", "CatBoost", "Optuna", "Hyperopt", "SHAP"],
      "focusAreas": ["model serving and deployment", "feature engineering and selection", "data pipeline orchestration", "model monitoring and observability", "A/B testing and experimentation", "data quality and validation", "MLOps and automation", "model versioning and governance", "real-time inference", "distributed training"],
      "typicalChallenges": ["feature drift detection", "model deployment at scale", "A/B testing design", "data quality issues", "model performance degradation", "cold start problems", "feature store management", "experiment tracking"],
      "keyMetrics": ["model accuracy", "inference latency", "data freshness", "feature drift score", "model training time", "data pipeline uptime", "prediction throughput", "model bias metrics"],
      "realWorldScenarios": ["build real-time recommendation system", "implement A/B testing framework", "design feature store architecture", "create model monitoring dashboard", "build distributed training pipeline", "implement fraud detection system", "design personalization engine"]
    },
    "frontend": {
      "technologies": ["React", "TypeScript", "WebAssembly", "Service Workers", "JavaScript", "HTML5", "CSS3", "GraphQL", "WebSockets", "Progressive Web Apps", "Micro-frontends", "Node.js", "Babel", "ESLint", "Sass"],
      "tools": ["Webpack", "Vite", "Storybook", "Cypress", "Jest", "Playwright", "Chrome DevTools", "Figma", "Sketch", "Lighthouse", "Bundle Analyzer", "Sentry"],
      "frameworks": ["Next.js", "React Query", "Tailwind CSS", "Material-UI", "Styled Components", "Redux Toolkit", "Apollo Client", "React Router"],
      "focusAreas": ["UI performance optimization", "state management architecture", "accessibility and inclusion", "responsive design", "cross-browser compatibility", "SEO optimization", "component library design", "testing strategies", "build optimization", "user experience design"],
      "typicalChallenges": ["bundle size optimization", "real-time data synchronization", "offline functionality", "cross-device compatibility", "performance bottlenecks", "accessibility compliance", "state management complexity", "third-party integration"],
      "keyMetrics": ["First Contentful Paint", "Time to Interactive", "bundle size", "frame rate", "Core Web Vitals", "user engagement", "conversion rate", "accessibility score"],
      "realWorldScenarios": ["implement infinite scrolling with virtualization", "build real-time collaborative editor", "create responsive dashboard", "develop PWA with offline support", "implement micro-frontend architecture", "build accessible component library", "optimize performance for mobile devices"]
    },
    "infrastructure": {
      "technologies": ["Kubernetes", "Terraform", "AWS", "GCP", "Azure", "Docker", "Ansible", "Prometheus", "Grafana", "Jenkins", "GitLab CI", "Vault", "Consul", "Istio", "Helm"],
      "tools": ["Helm", "ArgoCD", "Datadog", "PagerDuty", "Terraform Cloud", "Atlantis", "Spinnaker", "Flagger", "Linkerd", "Jaeger", "New Relic", "CloudFormation"],
      "frameworks": ["CDK", "Pulumi", "Istio", "Envoy", "OpenTelemetry", "Falco", "OPA", "Crossplane"],
      "focusAreas": ["container orchestration", "CI/CD pipeline design", "infrastructure observability", "security and compliance", "disaster recovery planning", "cost optimization", "performance monitoring", "automated scaling", "service mesh management", "GitOps workflows"],
      "typicalChallenges": ["resource scheduling and optimization", "multi-cloud deployment", "disaster recovery automation", "security policy enforcement", "cost management", "performance bottlenecks", "service discovery", "configuration drift"],
      "keyMetrics": ["resource utilization", "MTTR", "deployment frequency", "infrastructure cost", "system uptime", "deployment success rate", "recovery time objective", "security compliance score"],
      "realWorldScenarios": ["design Kubernetes auto-scaling system", "implement blue-green deployment", "build disaster recovery automation", "create multi-cloud strategy", "implement GitOps workflow", "design cost optimization system", "build infrastructure monitoring"]
    },
    "security": {
      "technologies": ["OAuth 2.0", "JWT", "TLS/SSL", "SIEM", "Zero Trust", "PKI", "SAML", "OpenID Connect", "LDAP", "Active Directory", "AWS IAM", "Azure AD", "Encryption", "HashiCorp Vault", "Certificate Management"],
      "tools": ["Vault", "OWASP ZAP", "Splunk", "Falco", "Nessus", "Burp Suite", "Wireshark", "Metasploit", "Nmap", "Qualys", "CrowdStrike", "SentinelOne"],
      "frameworks": ["Spring Security", "Auth0", "Keycloak", "NIST Cybersecurity Framework", "ISO 27001", "SOC 2", "GDPR", "MITRE ATT&CK"],
      "focusAreas": ["threat detection and analysis", "identity and access management", "compliance and governance", "vulnerability management", "incident response", "security architecture", "penetration testing", "security monitoring", "risk assessment", "security awareness training"],
      "typicalChallenges": ["advanced persistent threats", "zero-day vulnerabilities", "insider threats", "compliance violations", "incident response coordination", "security tool integration", "false positive management", "security policy enforcement"],
      "keyMetrics": ["mean time to detection", "mean time to response", "false positive rate", "security coverage", "vulnerability remediation time", "compliance score", "security incident count", "user security training completion"],
      "realWorldScenarios": ["build threat detection pipeline", "implement zero trust architecture", "design incident response automation", "create vulnerability management program", "build security monitoring dashboard", "implement fraud detection system", "design security awareness program"]
    }
  }
}

Do not include any text before or after the JSON.
    `;
    
    // Get the AI response using the prompt generation utility
    const aiResponse = await generateCompanyDataWithPrompt(customPrompt);
    
    // Parse and validate the JSON response from AI
    let companyData;
    try {
      // Extract JSON from the response (handle potential text before/after JSON)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in the AI response");
      }
      
      try {
        companyData = JSON.parse(jsonMatch[0]);
      } catch (jsonError: unknown) {
        console.error("JSON parsing error:", (jsonError instanceof Error ? jsonError.message : String(jsonError)));
        throw new Error(`Failed to parse response JSON: ${(jsonError instanceof Error ? jsonError.message : String(jsonError))}`);
      }
    } catch (parseError: unknown) {
      console.error("Error parsing AI response:", parseError);
      throw new Error(`Failed to parse AI response for ${companyName}: ${(parseError instanceof Error ? parseError.message : String(parseError))}`);
    }

    // Create company object with validated data and defaults (including enhanced fields)
    const company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'> = {
      name: companyName,
      description: companyData.description || `Company specializing in ${companyData.domain || 'technology'}`,
      domain: companyData.domain || "Technology",
      products: Array.isArray(companyData.products) ? companyData.products : [],
      technologies: Array.isArray(companyData.technologies) ? companyData.technologies : [],
      interviewFocus: Array.isArray(companyData.interviewFocus) ? companyData.interviewFocus : [],
      logoUrl: companyData.logoUrl || null,
      // Enhanced context fields
      engineeringChallenges: companyData.engineeringChallenges || undefined,
      scaleMetrics: companyData.scaleMetrics || undefined,
      techStackLayers: companyData.techStackLayers || undefined,
      problemDomains: Array.isArray(companyData.problemDomains) ? companyData.problemDomains : undefined,
      industryBuzzwords: Array.isArray(companyData.industryBuzzwords) ? companyData.industryBuzzwords : undefined,
      notableSystems: Array.isArray(companyData.notableSystems) ? companyData.notableSystems : undefined,
      dataProcessingPatterns: Array.isArray(companyData.dataProcessingPatterns) ? companyData.dataProcessingPatterns : undefined,
      optimizationPriorities: Array.isArray(companyData.optimizationPriorities) ? companyData.optimizationPriorities : undefined,
      analogyPatterns: companyData.analogyPatterns || undefined,
      roleSpecificData: companyData.roleSpecificData || undefined
    };

    // Save company to Firestore with proper error handling
    const companyDataForFirestore = convertCompanyToFirestore(company);
    await docRef.set(companyDataForFirestore);
    console.log(`Created company: ${companyName}`);

    // Retrieve the created company to get complete data with timestamps
    const newDocSnap = await docRef.get();
    if (!newDocSnap.exists) {
      throw new Error(`Failed to retrieve created company: ${companyName}`);
    }

    return convertFirestoreToCompany(newDocSnap);
  } catch (error) {
    console.error(`Error generating company data for ${companyName}:`, error);
    throw error;
  }
} 