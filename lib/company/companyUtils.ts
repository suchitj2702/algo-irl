import { adminDb } from '../firebase/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Company } from "@/data-types/company";
import { generateCompanyDataWithPrompt } from "@/lib/llmServices/llmUtils";

// Helper function for converting Company objects to Firestore data (Admin SDK)
const convertCompanyToFirestore = (
  modelObject: Partial<Company>
): Record<string, unknown> => {
  const data = { ...modelObject } as Partial<Company>;
  delete data.id;
  
  data.updatedAt = Timestamp.now();
  if (!data.createdAt) {
    data.createdAt = Timestamp.now();
  }
  
  if (data.createdAt instanceof Date) {
    data.createdAt = Timestamp.fromDate(data.createdAt);
  }
  if (data.updatedAt instanceof Date) {
    data.updatedAt = Timestamp.fromDate(data.updatedAt);
  }
  return data as Record<string, unknown>;
};

// Helper function for converting Firestore data to Company objects (Admin SDK)
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
 * Initialize the tech companies in Firestore using AI generation
 * 
 * @returns {Promise<void>}
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
 * Get a company by ID
 * 
 * @param companyId - The ID of the company to retrieve
 * @returns {Promise<Company | null>}
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
 * Get all tech companies
 * 
 * @param options - Optional query parameters
 * @returns {Promise<Company[]>}
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
 * Get companies by domain
 * 
 * @param domain - The domain to filter by
 * @returns {Promise<Company[]>}
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
 * Validates and corrects company name spelling using AI
 * 
 * @param companyName - Potentially misspelled company name
 * @returns {Promise<{correctedName: string, isCorrection: boolean}>} - Corrected name and whether a correction was made
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
 * Generate company details using AI and save to Firestore
 * 
 * @param companyName - The name of the company to generate (potentially misspelled)
 * @returns {Promise<Company>} - The generated company data
 */
export async function generateCompanyDataWithAI(companyName: string): Promise<Company> {
  try {
    // First, validate and possibly correct the company name
    const { correctedName, isCorrection } = await validateCompanyName(companyName);
    
    // Create company ID from the corrected name
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
    
    // Construct prompt for the AI using the corrected name
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
    
    // Get the AI response using the new generateCompanyData method
    const aiResponse = await generateCompanyDataWithPrompt(customPrompt);
    
    // Parse the JSON response
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
    
    // Create company object with the corrected name
    const company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'> = {
      name: correctedName, // Use the corrected name
      description: companyData.description || `Company specializing in ${companyData.domain || 'technology'}`,
      domain: companyData.domain || "Technology",
      products: Array.isArray(companyData.products) ? companyData.products : [],
      technologies: Array.isArray(companyData.technologies) ? companyData.technologies : [],
      interviewFocus: Array.isArray(companyData.interviewFocus) ? companyData.interviewFocus : [],
      logoUrl: companyData.logoUrl || null
    };
    
    // Save company to Firestore
    const companyDataForFirestore = convertCompanyToFirestore(company);
    await docRef.set(companyDataForFirestore);
    console.log(`Created company: ${correctedName}`);
    
    // Get the created company with ID
    const newDocSnap = await docRef.get();
    if (!newDocSnap.exists) {
      throw new Error(`Failed to retrieve created company: ${correctedName}`);
    }
    
    const createdCompany = convertFirestoreToCompany(newDocSnap);
    
    // Return company data with additional property to indicate name correction
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