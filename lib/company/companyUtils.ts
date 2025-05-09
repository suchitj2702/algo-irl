import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  limit, 
  Timestamp,
  DocumentData,
  FirestoreDataConverter,
  WithFieldValue,
  PartialWithFieldValue,
  SetOptions,
  serverTimestamp,
  CollectionReference,
  Query
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { Company } from "@/data-types/company";
import { AnthropicService } from "@/lib/llmServices/anthropicService";

// Firestore collection reference
const companiesCollectionRef = collection(db, "companies");

// Helper function for converting Company objects to Firestore data
const convertCompanyToFirestore = (
  modelObject: WithFieldValue<Company> | PartialWithFieldValue<Company>,
  options?: SetOptions
): DocumentData => {
  const data = { ...modelObject } as any;
  delete data.id;
  const isMerge = options &&
    ('merge' in options && options.merge ||
    ('mergeFields' in options && Array.isArray(options.mergeFields) && options.mergeFields.length > 0));
  data.updatedAt = serverTimestamp();
  if (!isMerge && !data.createdAt) {
    data.createdAt = serverTimestamp();
  }
  if (data.createdAt instanceof Date) {
    data.createdAt = Timestamp.fromDate(data.createdAt);
  }
  if (data.updatedAt instanceof Date) {
    data.updatedAt = Timestamp.fromDate(data.updatedAt);
  }
  return data;
};

// Firestore Data Converter for Company objects
const companyConverter: FirestoreDataConverter<Company> = {
  toFirestore(
    modelObject: WithFieldValue<Company> | PartialWithFieldValue<Company>,
    options?: SetOptions
  ): DocumentData {
    return convertCompanyToFirestore(modelObject, options);
  },
  fromFirestore(snapshot, options): Company {
    const data = snapshot.data(options)!;
    return {
      id: snapshot.id,
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
  }
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
      const company = await generateCompanyDataWithAI(companyName);
      
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
    const companyDocRef = doc(companiesCollectionRef, companyId).withConverter(companyConverter);
    const docSnap = await getDoc(companyDocRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
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
    const companiesRef = collection(db, "companies").withConverter(companyConverter);
    let companiesQuery: Query<Company> = companiesRef;
    
    if (options?.limit) {
      companiesQuery = query(companiesRef, limit(options.limit));
    }
    
    const querySnapshot = await getDocs(companiesQuery);
    const companies: Company[] = [];
    
    querySnapshot.forEach((doc) => {
      companies.push(doc.data());
    });
    
    return companies;
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
    const companiesRef = collection(db, "companies").withConverter(companyConverter);
    const companiesQuery = query(
      companiesRef,
      where("domain", "==", domain)
    );
    
    const querySnapshot = await getDocs(companiesQuery);
    const companies: Company[] = [];
    
    querySnapshot.forEach((doc) => {
      companies.push(doc.data());
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
    // Create an instance of the AnthropicService
    const anthropicService = new AnthropicService();
    
    // Create a cache key for this validation
    const cacheKey = `company-validation-${companyName.toLowerCase()}`;
    
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
    const aiResponse = await anthropicService.generateCompanyData({
      customPrompt,
      cacheKey,
      useCache: true
    });
    
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
    const companyDocRef = doc(companiesCollectionRef, companyId).withConverter(companyConverter);
    const docSnap = await getDoc(companyDocRef);
    
    if (docSnap.exists()) {
      console.log(`Company ${correctedName} already exists, returning existing data`);
      // Add the isCorrection flag to the returned data
      const existingData = docSnap.data();
      return {
        ...existingData,
        // Add a non-persistent property to indicate if name was corrected
        wasNameCorrected: isCorrection
      } as Company;
    }
    
    // Create an instance of the AnthropicService
    const anthropicService = new AnthropicService();
    
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
    
    // Create a cache key using the corrected company name
    const cacheKey = `company-${companyId}`;
    
    // Get the AI response using the new generateCompanyData method
    const aiResponse = await anthropicService.generateCompanyData({
      customPrompt,
      cacheKey,
      useCache: true
    });
    
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
      } catch (jsonError: any) {
        console.error("JSON parsing error:", jsonError.message);
        throw new Error(`Failed to parse response JSON: ${jsonError.message}`);
      }
    } catch (parseError: any) {
      console.error("Error parsing AI response:", parseError);
      throw new Error(`Failed to parse AI response for ${correctedName}: ${parseError.message}`);
    }
    
    // Create company object with the corrected name
    const company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'> = {
      name: correctedName, // Use the corrected name
      description: companyData.description || `Company specializing in ${companyData.domain || 'technology'}`,
      domain: companyData.domain || "Technology",
      products: Array.isArray(companyData.products) ? companyData.products : [],
      technologies: Array.isArray(companyData.technologies) ? companyData.technologies : [],
      interviewFocus: Array.isArray(companyData.interviewFocus) ? companyData.interviewFocus : [],
      logoUrl: companyData.logoUrl || undefined
    };
    
    // Save company to Firestore
    await setDoc(companyDocRef, company);
    console.log(`Created company: ${correctedName}`);
    
    // Get the created company with ID
    const newDocSnap = await getDoc(companyDocRef);
    if (!newDocSnap.exists()) {
      throw new Error(`Failed to retrieve created company: ${correctedName}`);
    }
    
    const createdCompany = newDocSnap.data();
    
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