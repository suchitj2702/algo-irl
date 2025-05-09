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

// Company data for initialization
const techCompanies: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: "Google",
    description: "Technology company specializing in search, cloud computing, advertising, and software services",
    domain: "Search, Cloud, Software Services",
    products: ["Google Search", "Gmail", "Google Cloud", "Android", "YouTube", "Google Maps"],
    technologies: ["Go", "Java", "Python", "Kubernetes", "TensorFlow", "BigQuery"],
    interviewFocus: ["System Design", "Algorithm Efficiency", "Code Quality", "Scale"],
    logoUrl: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png"
  },
  {
    name: "Amazon",
    description: "Multinational technology and e-commerce company focusing on cloud computing, digital streaming, and artificial intelligence",
    domain: "E-commerce, Cloud Computing, AI",
    products: ["Amazon.com", "AWS", "Alexa", "Amazon Prime", "Kindle"],
    technologies: ["Java", "Go", "Python", "AWS Services", "DynamoDB", "Lambda"],
    interviewFocus: ["Leadership Principles", "Scalability", "System Design", "Operational Excellence"],
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/1024px-Amazon_logo.svg.png"
  },
  {
    name: "Microsoft",
    description: "Technology corporation that produces computer software, consumer electronics, personal computers, and related services",
    domain: "Cloud Computing, Software, Operating Systems",
    products: ["Windows", "Office 365", "Azure", "GitHub", "LinkedIn", "Xbox"],
    technologies: ["C#", ".NET", "TypeScript", "Azure", "React", "SQL Server"],
    interviewFocus: ["System Design", "Problem Solving", "Collaboration", "Technical Depth"],
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/1024px-Microsoft_logo.svg.png"
  }
];

/**
 * Initialize the tech companies in Firestore
 * 
 * @returns {Promise<void>}
 */
export async function initializeTechCompanies(): Promise<void> {
  try {
    // Add each company to Firestore
    for (const company of techCompanies) {
      const companyId = company.name.toLowerCase().replace(/\s+/g, '');
      const companyDocRef = doc(companiesCollectionRef, companyId).withConverter(companyConverter);
      
      // Check if company already exists
      const docSnap = await getDoc(companyDocRef);
      
      if (!docSnap.exists()) {
        // Create new company document
        await setDoc(companyDocRef, company);
        console.log(`Created company: ${company.name}`);
      } else {
        console.log(`Company ${company.name} already exists, skipping initialization`);
      }
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