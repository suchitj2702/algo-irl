import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult, Content, GenerationConfig } from "@google/generative-ai";

// Constants for Gemini Service
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

export class GeminiService {
    private client: GoogleGenerativeAI;
    private modelCache: { [modelName: string]: GenerativeModel } = {};

    constructor(apiKey?: string) {
        const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;
        if (!effectiveApiKey) {
            throw new Error('Gemini API key is required. Set GEMINI_API_KEY environment variable or pass it to the constructor.');
        }
        this.client = new GoogleGenerativeAI(effectiveApiKey);
    }

    private getModel(modelName: string): GenerativeModel {
        if (!this.modelCache[modelName]) {
            this.modelCache[modelName] = this.client.getGenerativeModel({ model: modelName });
        }
        return this.modelCache[modelName];
    }

    /**
     * Helper function to call Gemini API with retry logic.
     */
    // Make this public
    public async callGeminiModel(modelName: string, prompt: string, systemInstructionText?: string): Promise<string> {
        let retries = 0;
        const model = this.getModel(modelName);

        const generationConfig: GenerationConfig = {
            temperature: 1, 
        };
        
        // System instructions are passed as a Content object with role: "system"
        const systemInstructionParts: Content[] | undefined = systemInstructionText
            ? [{ role: "system", parts: [{ text: systemInstructionText }] }]
            : undefined;

        while (retries <= MAX_RETRIES) {
            try {
                const result: GenerateContentResult = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: generationConfig,
                    ...(systemInstructionParts && { systemInstruction: systemInstructionParts[0] }) // Pass the first (and only) Content object
                });

                const response = result.response;
                const responseText = response.text(); 

                if (!responseText) {
                    const blockReason = response.candidates?.[0]?.finishReason;
                    const safetyRatings = response.candidates?.[0]?.safetyRatings;
                    console.warn(`Gemini API call to model ${modelName} returned no text content. Reason: ${blockReason}. Safety: ${JSON.stringify(safetyRatings)}`);
                    throw new Error(`Gemini API call failed or returned no text. Block Reason: ${blockReason}`);
                }
                return responseText;

            } catch (error: any) {
                retries++;
                if (retries > MAX_RETRIES) {
                    console.error(`Failed Gemini API call to model ${modelName} after ${MAX_RETRIES} retries. Error: ${error}`);
                    throw error; 
                }
                console.warn(`Gemini API call to ${modelName} failed (attempt ${retries}/${MAX_RETRIES}), retrying in ${RETRY_DELAY * retries}ms... Error: ${error}`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
            }
        }
        throw new Error(`Failed to get response from Gemini model ${modelName} after maximum retries`);
    }
    
    // Removed fetchProblemDataFromUrl - orchestration now in problemDatastoreUtils
    // Removed extractSlugFromUrl - to be centralized
}

// Export default instance
export default new GeminiService(); 