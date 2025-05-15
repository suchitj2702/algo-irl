# AlgoIRL: Week 1 Task Breakdown

## Overview
This document outlines the detailed tasks for Week 1 of the AlgoIRL MVP development using Firebase and Vercel. This is a hyper-focused week to deliver the essential MVP with a coding environment in just seven days.

## Day 1: Project Setup & Infrastructure

### Manual Setup Tasks
1. **Create Firebase Project** ✅
   - Create new Firebase project in console
   - Enable Authentication (email only for MVP)
   - Enable Firestore database
   - Note down Firebase project config details
   - **Verification**: Screenshot of Firebase console with project created

2. **Setup Vercel Account** ✅
   - Create/login to Vercel account
   - Connect to GitHub repository
   - **Verification**: Vercel dashboard access

3. **Setup Development Environment** ✅
   - Install Node.js and npm/yarn
   - Install Firebase CLI
   - Install Git
   - **Verification**: Run `node -v`, `npm -v`, `firebase -v` commands successfully

### Coding Tasks (Cursor AI)
1. **Initialize Next.js Project** ✅
   - Create new Next.js project with TypeScript
   - Configure project structure (pages, components, lib folders)
   - Initialize Git repository
   - **Input for Cursor AI**: "Create a Next.js project with TypeScript for a web application called AlgoIRL that will transform coding problems into company-specific scenarios"
   - **Output**: Basic Next.js project structure with TypeScript
   - **Testing**: 
     - Run `npm run dev` and verify the app starts without errors
     - Check browser console for JavaScript errors
     - **Verification**: App loads at localhost:3000 with no console errors

2. **Firebase Client Configuration** ✅
   - Create Firebase config file
   - Initialize Firebase in application
   - **Input for Cursor AI**: "Create a Firebase configuration file for a Next.js app that initializes Firebase Auth and Firestore"
   - **Output**: Firebase configuration file with initialization code
   - **Testing**:
     - Create a simple component that displays "Firebase Initialized" on success
     - Check browser console for Firebase initialization messages
     - **Verification**: No Firebase initialization errors in console

## Day 2: Problem Repository & Data Foundation

### Coding Tasks (Cursor AI)
1. **Define Data Models** ✅
   - Create TypeScript interfaces for Problem, Company, and Scenario
   - Define Firestore schema structure
   - **Input for Cursor AI**: "Create TypeScript interfaces and Firestore schema for a coding problem preparation app with three main entities: Problem (id, title, difficulty, description, leetcodeLink), Company (id, name, description, domain), and Scenario (id, problemId, companyId, scenario, createdAt)"
   - **Output**: TypeScript interfaces and Firestore schema definitions
   - **Testing**:
     - Create test file that validates type definitions
     - Write simple TypeScript tests with the interfaces
     - **Verification**: No TypeScript errors when creating model objects

2. **Problem Repository Functionality** ✅
   - Create smart problem import utility that only requires LeetCode URLs
   - Implement automatic data extraction from LeetCode
   - Define list of 10 selected problems from Blind 75 (URLs only)
   - **Implementation Details**:
     - Created `extractSlugFromUrl` function for parsing LeetCode URLs
     - Implemented Firestore converter (`problemConverter`) for proper data handling
     - Created AI-powered problem data generation instead of direct LeetCode scraping
     - Created `fetchAndImportProblemByUrl` function for individual imports
     - Built `importProblemsFromUrls` function with rate limiting for batch imports
     - Updated Problem interface to handle language-specific details
     - Implemented test case verification using Judge0
     - **Verification**: Successfully populate Firestore with complete problem data using only URLs

3. **Company Data Setup** ✅
   - Create company profiles for 3 major tech companies
   - Implement company data retrieval functions
   - **Implementation Details**:
     - Created AI-powered company data generation for major tech companies
     - Implemented company name validation and correction
     - Added domain-specific filtering
     - Created comprehensive company profiles with products, technologies, and interview focus
   - **Verification**: View company data in Firebase console and via fetch functions

4. **Basic Authentication Implementation** ✅
   - Create authentication context
   - Implement sign-in page with email
   - Setup authentication state management
   - **Input for Cursor AI**: "Create a basic authentication system using Firebase Auth in a Next.js app with a sign-in page and context provider"
   - **Output**: Authentication components and context
   - **Testing**:
     - Test sign-in flow with valid credentials
     - Test sign-in with invalid credentials
     - Verify authentication state persists on page reload
     - **Verification**: Successfully sign in and observe authentication state change

## Day 3: Coding Environment Basic Implementation

### Coding Tasks (Cursor AI)
1. **Implement Monaco Editor** ✅
   - Create code editor component using Monaco Editor
   - Implement basic language support
   - Add settings configuration
   - **Implementation Details**:
     - Created CodeEditor.tsx component with Monaco integration
     - Implemented theme support and configuration options
     - Added key bindings and editor customization
   - **Verification**: Editor allows code input with proper formatting

2. **Language Selection Implementation** ✅
   - Create language selection dropdown
   - Implement language switching
   - Add initial language configurations
   - **Implementation Details**:
     - Created LanguageSelector.tsx component
     - Added support for multiple programming languages
     - Implemented language detection and syntax highlighting
     - Created combined CodeEditorWithLanguageSelector.tsx component
   - **Verification**: Editor properly handles different programming languages

3. **Code Submission Interface & UI Components** ✅
   - Implement code submission function
   - Create submission button component
   - Add loading state handling
   - Implement reusable notification system
   - Create UI feedback components
   - Add form validation utilities
   - **Implementation Details**:
     - Created modular UI components in the ui directory
     - Implemented responsive design principles
     - Added loading states and error handling
   - **Verification**: Interface provides comprehensive user feedback

## Day 4: Code Execution & Test Cases

### Manual Setup Tasks
1. **Set Up Serverless Code Execution** ✅
   - Create Next.js API route for code execution
   - Configure execution environment
   - **Implementation Details**:
     - Integrated with Judge0 API instead of VM2
     - Set up API keys and configuration
   - **Verification**: API route responds to test requests

### Coding Tasks (Cursor AI)
1. **Implement Code Execution Function** ✅
   - Create serverless function for code execution
   - Implement language-specific execution logic
   - Add basic security sandboxing
   - **Implementation Details**:
     - Created Judge0Client.ts for API interaction
     - Implemented batch submission for efficiency
     - Added retry logic and error handling
     - Created response processing utilities
   - **Verification**: API successfully executes code and returns results

2. **Test Case Implementation** ✅
   - Create test case data model
   - Implement test case execution logic
   - Add results comparison functionality
   - **Implementation Details**:
     - Updated test case model to use stdin/stdout format
     - Implemented test case validation
     - Added batch test execution
     - Created result aggregation logic
   - **Verification**: Test cases correctly identify valid and invalid solutions

3. **Results Display Component** ✅
   - Create execution results component
   - Implement test case results display
   - Add runtime and memory usage metrics
   - **Implementation Details**:
     - Created comprehensive results interface
     - Added performance metric display
     - Implemented detailed error reporting
   - **Verification**: Component clearly displays execution results and metrics

## Day 5: AI Integration

### Manual Setup Tasks
1. **Setup AI Service Access** ✅
   - Create API accounts (Anthropic, OpenAI, Google)
   - Generate API keys
   - Store keys securely in Vercel environment variables
   - **Implementation Details**:
     - Set up multiple AI provider access for redundancy
     - Configured rate limits and monitoring
   - **Verification**: API keys configured in Vercel dashboard

### Coding Tasks (Cursor AI)
1. **Implement AI Service** ✅
   - Create AI service wrapper
   - Implement prompt template for scenario generation
   - Add error handling and retry logic
   - **Implementation Details**:
     - Created individual service files for each AI provider
     - Implemented common interface through llmUtils.ts
     - Added retry logic and error handling
     - Created task-specific prompt templates
   - **Verification**: Service generates contextual scenarios without errors

2. **Scenario Generation Implementation** ✅
   - Create scenario generation endpoint
   - Implement company-specific context enhancement
   - Add basic caching mechanism
   - **Implementation Details**:
     - Implemented problem transformation in problemTransformer.ts
     - Created caching system with TTL
     - Added context enrichment for companies
   - **Verification**: Endpoint returns high-quality, company-specific scenarios

3. **Problem Transformation Logic** ✅
   - Implement context extraction from problems
   - Create company background formatter
   - Add scenario quality verification
   - **Implementation Details**:
     - Created detailed prompt engineering
     - Implemented context extraction and enhancement
     - Added response validation and quality checks
   - **Verification**: Utilities improve scenario generation relevance and quality

## Day 6: UI Integration & Core Flow

### Coding Tasks (Cursor AI)
1. **Problem Display Component** ✅
   - Create unified problem display component
   - Integrate coding environment
   - Add scenario display section
   - **Implementation Details**:
     - Created problem display components in components/problem directory
     - Integrated scenario display with problem context
     - Added responsive design for different screen sizes
   - **Verification**: Component displays complete problem-solving experience

2. **Company Selection Interface** ✅
   - Create company selection component
   - Implement company information display
   - Add company selection handling
   - **Implementation Details**:
     - Created company selection UI
     - Added company details modal
     - Implemented selection state management
   - **Verification**: Users can select companies and see relevant scenarios

3. **Main Application Flow** ✅
   - Connect all components in main page
   - Implement state management for selected problem/company
   - Add navigation between problems
   - **Implementation Details**:
     - Implemented core application flow in app/page.tsx
     - Added state management for user selections
     - Created seamless navigation experience
   - **Verification**: Complete application flow works without errors

## Day 7: Testing & MVP Launch

### Coding Tasks (Cursor AI)
1. **Error Handling & Application Shell** ✅
   - Create comprehensive error boundaries
   - Implement user-friendly error messages
   - Add error recovery strategies
   - Create application layout component
   - Implement navigation header and footer
   - Add responsive layout container
   - **Implementation Details**:
     - Created layout components in components/layout directory
     - Implemented error boundaries and fallbacks
     - Added consistent error messaging
   - **Verification**: Application provides consistent layout with graceful error handling

2. **Performance Optimization** ✅
   - Implement code splitting
   - Add loading state indicators
   - Optimize component rendering
   - **Implementation Details**:
     - Added dynamic imports for code splitting
     - Implemented optimized data fetching
     - Added loading states throughout the application
   - **Verification**: Application demonstrates improved load and interaction performance

3. **Final Integration Testing** ✅
   - Create end-to-end test script
   - Implement critical path verification
   - Add user flow validation
   - **Verification**: Application passes all critical tests

### Manual Testing Tasks
1. **Perform End-to-End Testing** ✅
   - Test full authentication flow
   - Verify problem and company selection
   - Test scenario generation with multiple combinations
   - Test code execution with various solutions
   - **Verification**: All flows work together without errors

2. **Deploy MVP Version** ✅
   - Push code to GitHub
   - Verify Vercel deployment
   - Test application on multiple devices
   - **Verification**: Working application URL from Vercel that functions on mobile and desktop

## API Testing with Postman

### Setup Postman for API Testing
1. **Download and Install Postman** ✅
   - Download Postman from [postman.com](https://www.postman.com/downloads/)
   - Create a free Postman account if needed
   - **Verification**: Postman runs and can create collections

2. **Create AlgoIRL API Collection** ✅
   - Create a new collection named "AlgoIRL API"
   - Set up environment variables for:
     - `baseUrl`: Your development server URL (e.g., `http://localhost:3000`)
     - `authToken`: For authenticated requests (if implemented)
   - **Verification**: Collection created with environment variables

### Problem Import API Testing

1. **Single Problem Import** ✅
   - **Request Setup**:
     - Method: `POST`
     - URL: `{{baseUrl}}/api/import-problem`
     - Headers:
       - Content-Type: `application/json`
     - Body (raw JSON):
       ```json
       {
         "url": "https://leetcode.com/problems/two-sum/"
       }
       ```
   - **Expected Response**:
     ```json
     {
       "success": true,
       "slug": "two-sum"
     }
     ```
   - **Testing**:
     - Verify response structure matches expected format
     - Check Firestore to confirm problem was imported correctly
     - Test with invalid URLs to verify error handling
     - **Verification**: Problem successfully imported into Firestore

2. **Batch Problem Import** ✅
   - **Request Setup**:
     - Method: `POST`
     - URL: `{{baseUrl}}/api/import-problems`
     - Headers:
       - Content-Type: `application/json`
     - Body (raw JSON):
       ```json
       {
         "urls": [
           "https://leetcode.com/problems/valid-parentheses/",
           "https://leetcode.com/problems/merge-two-sorted-lists/",
           "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/"
         ]
       }
       ```
   - **Expected Response**:
     ```json
     {
       "success": true,
       "successCount": 3,
       "errors": []
     }
     ```
   - **Testing**:
     - Monitor API response for success counts
     - Include intentionally invalid URLs to test error handling
     - Check rate limiting behavior with many URLs
     - **Verification**: Multiple problems successfully imported with proper error handling

3. **Error Handling Tests** ✅
   - Test with malformed JSON
   - Test with empty URL array
   - Test with invalid LeetCode URLs
   - Test with non-existent LeetCode problems
   - **Verification**: All error cases properly handled with appropriate error messages

### Save and Export Postman Collection
1. **Save Requests** ✅
   - Save all test requests with descriptive names
   - Include example responses for reference
   - Add descriptions to request details

2. **Export Collection** ✅
   - Export the collection for sharing with team members
   - Document how to import and use the collection
   - **Verification**: Collection can be imported and used by other team members

## Task Tracking Table

| Day | Task | Type | Status | Notes |
|-----|------|------|--------|-------|
| 1 | Create Firebase Project | Manual | ✅ Completed | |
| 1 | Setup Vercel Account | Manual | ✅ Completed | |
| 1 | Setup Development Environment | Manual | ✅ Completed | |
| 1 | Initialize Next.js Project | Coding | ✅ Completed | |
| 1 | Firebase Client Configuration | Coding | ✅ Completed | |
| 2 | Define Data Models | Coding | ✅ Completed | Added Problem, Company and Scenario interfaces |
| 2 | Problem Repository Functionality | Coding | ✅ Completed | Used AI-powered problem generation instead of direct scraping |
| 2 | Company Data Setup | Coding | ✅ Completed | Implemented AI-powered company data generation |
| 2 | Basic Authentication Implementation | Coding | ✅ Completed | |
| 2 | Setup Postman for API Testing | Manual | ✅ Completed | Created collection for testing problem import APIs |
| 3 | Implement Monaco Editor | Coding | ✅ Completed | Created modular editor components |
| 3 | Language Selection Implementation | Coding | ✅ Completed | Added support for multiple languages |
| 3 | Code Submission Interface | Coding | ✅ Completed | Implemented responsive UI components |
| 4 | Set Up Serverless Code Execution | Manual | ✅ Completed | Integrated with Judge0 instead of VM2 |
| 4 | Implement Code Execution Function | Coding | ✅ Completed | Created Judge0Client for API interaction |
| 4 | Test Case Implementation | Coding | ✅ Completed | Updated to stdin/stdout format |
| 4 | Results Display Component | Coding | ✅ Completed | Added comprehensive results interface |
| 5 | Setup AI Service Access | Manual | ✅ Completed | Set up multiple AI providers |
| 5 | Implement AI Service | Coding | ✅ Completed | Created modular AI service architecture |
| 5 | Scenario Generation Implementation | Coding | ✅ Completed | Added caching and context enrichment |
| 5 | Problem Transformation Logic | Coding | ✅ Completed | Created detailed prompt engineering |
| 6 | Problem Display Component | Coding | ✅ Completed | Integrated scenario display |
| 6 | Company Selection Interface | Coding | ✅ Completed | Added company details modal |
| 6 | Main Application Flow | Coding | ✅ Completed | Implemented core flow in page.tsx |
| 7 | Error Handling Implementation | Coding | ✅ Completed | Added error boundaries and fallbacks |
| 7 | Performance Optimization | Coding | ✅ Completed | Implemented code splitting and loading states |
| 7 | Final Integration Testing | Coding | ✅ Completed | Verified all critical paths |
| 7 | Perform End-to-End Testing | Manual | ✅ Completed | Tested all user flows |
| 7 | Deploy MVP Version | Manual | ✅ Completed | Deployed to Vercel |