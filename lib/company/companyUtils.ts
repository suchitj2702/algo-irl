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
    const docRef = db.collection('companies').doc(companyId);
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
    const collectionRef = db.collection('companies');
    
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
    const querySnapshot = await db.collection('companies')
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
 * Validates and corrects company name spelling using AI.
 * This function helps handle user input with potential misspellings or
 * incorrect capitalization of well-known company names.
 * 
 * Algorithm:
 * 1. Send company name to AI with correction instructions
 * 2. AI analyzes name against known company database
 * 3. Returns corrected name if misspelling detected
 * 4. Returns original name if already correct or unrecognized
 * 5. Compare corrected vs original to determine if correction was made
 * 
 * @param companyName - Potentially misspelled company name
 * @returns Promise resolving to object with corrected name and correction flag
 */
async function validateCompanyName(companyName: string): Promise<{correctedName: string, isCorrection: boolean}> {
  try {    
    // Simpler prompt that just asks for the correct name
    const customPrompt = `
      I have a company name that might be misspelled: "${companyName}"
      
      If this is already the correct spelling and capitalization of a well-known company, respond with exactly that name.
      If it appears to be a misspelling or incorrect capitalization of a well-known company, respond with the correct name.
      If it's not recognizable as any known company, respond with exactly the original name.
      
      Respond with ONLY the corrected company name, nothing else.
      
      Examples:
      Input: "Googel" → Output: Google
      Input: "Microsoft" → Output: Microsoft
      Input: "Amazn" → Output: Amazon
      Input: "FaceBook" → Output: Facebook
      Input: "Twittr" → Output: Twitter
    `;
    
    // Get AI response
    const aiResponse = await generateCompanyDataWithPrompt(customPrompt);
    
    // Trim any whitespace and newlines
    const correctedName = aiResponse.trim();
    
    // Check if a correction was made by comparing lowercase versions
    const isCorrection = correctedName.toLowerCase() !== companyName.toLowerCase();
    
    if (isCorrection) {
      console.log(`Corrected company name from "${companyName}" to "${correctedName}"`);
    }
    
    return { correctedName, isCorrection };
  } catch (error) {
    console.error(`Error validating company name "${companyName}":`, error);
    // Fall back to original name if validation fails
    return { correctedName: companyName, isCorrection: false };
  }
}

/**
 * Generates comprehensive company data using AI and saves to Firestore.
 * This is the main function for creating new company records with AI-generated content.
 * 
 * Workflow:
 * 1. Validate and potentially correct the company name using AI
 * 2. Check if company already exists in database
 * 3. If exists, return existing data with correction flag
 * 4. If new, generate comprehensive company data using AI:
 *    - Company description and domain
 *    - List of main products/services
 *    - Key technologies used
 *    - Interview focus areas for engineers
 *    - Logo URL if available
 * 5. Parse AI response and validate JSON format
 * 6. Save to Firestore with proper error handling
 * 7. Return complete company object with metadata
 * 
 * @param companyName - The name of the company to generate (may contain misspellings)
 * @returns Promise resolving to complete Company object with wasNameCorrected flag
 * @throws Error if AI generation fails or database operation fails
 */
export async function generateCompanyDataWithAI(companyName: string): Promise<Company> {
  try {
    // First, validate and possibly correct the company name
    const { correctedName, isCorrection } = await validateCompanyName(companyName);
    
    // Create company ID from the corrected name (normalized for storage)
    const companyId = correctedName.toLowerCase().replace(/\s+/g, '');
    
    // Check if company already exists in Firestore
    const db = adminDb();
    const docRef = db.collection('companies').doc(companyId);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      console.log(`Company ${correctedName} already exists, returning existing data`);
      // Add the isCorrection flag to the returned data
      const existingData = convertFirestoreToCompany(docSnap);
      return {
        ...existingData,
        // Add a non-persistent property to indicate if name was corrected
        wasNameCorrected: isCorrection
      } as Company;
    }
    
    // Construct comprehensive prompt for AI company data generation
    const customPrompt = `
      I need detailed information about the company "${correctedName}" in JSON format. 
      Please provide the following information:
      
      1. A concise description of what the company does
      2. The company's primary domain/industry
      3. List of main products or services (at least 3-5)
      4. List of key technologies used at the company (at least 3-5)
      5. List of typical interview focus areas for engineers at this company (at least 3-5)
      6. A URL to the company's logo (if well-known)
      
      Format your response as valid JSON ONLY with these exact fields:
      {
        "description": "string description here",
        "domain": "string domain here",
        "products": ["product1", "product2", "product3"],
        "technologies": ["tech1", "tech2", "tech3"],
        "interviewFocus": ["focus1", "focus2", "focus3"],
        "logoUrl": "https://example.com/logo.png or null if unknown"
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
      throw new Error(`Failed to parse AI response for ${correctedName}: ${(parseError instanceof Error ? parseError.message : String(parseError))}`);
    }
    
    // Create company object with validated data and defaults
    const company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'> = {
      name: correctedName, // Use the corrected name
      description: companyData.description || `Company specializing in ${companyData.domain || 'technology'}`,
      domain: companyData.domain || "Technology",
      products: Array.isArray(companyData.products) ? companyData.products : [],
      technologies: Array.isArray(companyData.technologies) ? companyData.technologies : [],
      interviewFocus: Array.isArray(companyData.interviewFocus) ? companyData.interviewFocus : [],
      logoUrl: companyData.logoUrl || null
    };
    
    // Save company to Firestore with proper error handling
    const companyDataForFirestore = convertCompanyToFirestore(company);
    await docRef.set(companyDataForFirestore);
    console.log(`Created company: ${correctedName}`);
    
    // Retrieve the created company to get complete data with timestamps
    const newDocSnap = await docRef.get();
    if (!newDocSnap.exists) {
      throw new Error(`Failed to retrieve created company: ${correctedName}`);
    }
    
    const createdCompany = convertFirestoreToCompany(newDocSnap);
    
    // Return company data with additional metadata about name correction
    return {
      ...createdCompany,
      // Add a non-persistent property to indicate if name was corrected
      wasNameCorrected: isCorrection
    } as Company;
  } catch (error) {
    console.error(`Error generating company data for ${companyName}:`, error);
    throw error;
  }
} 