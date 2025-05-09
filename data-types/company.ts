import { Timestamp } from "firebase/firestore";

export interface Company {
  id: string;
  name: string;
  description: string;
  domain: string;
  products: string[];
  technologies: string[];
  interviewFocus: string[];
  logoUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Non-persistent property to indicate if the company name was corrected
  wasNameCorrected?: boolean;
} 