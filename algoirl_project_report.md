# AlgoIRL Project Progress Report

## Project Overview
AlgoIRL is a web application designed to transform coding problems into company-specific interview scenarios. The platform allows users to practice algorithmic problems with realistic contextual scenarios that mirror real-world technical interviews at specific companies.

## Technology Stack
- **Frontend**: Next.js 15.3.1 with React 19
- **Backend**: Next.js API routes (serverless functions)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication
- **Code Editing**: Monaco Editor
- **Code Execution**: Serverless execution environment
- **Deployment**: Vercel

## Current Implementation Progress

### 1. Project Setup & Infrastructure (Completed)
- Next.js application scaffold has been initialized with TypeScript
- Firebase project has been configured with Authentication and Firestore
- Vercel deployment has been set up
- Basic directory structure has been established (app, components, lib, types)

### 2. Data Models & Firebase Integration (Completed)
- TypeScript interfaces have been created for the main entities:
  - Problem: Represents coding problems with properties like title, difficulty, description, etc.
  - Company: Represents tech companies with details like name, description, domain
  - Scenario: Links problems to companies with contextual interview scenarios
- Firebase configurations have been implemented in `lib/firebase.ts`
- Firestore utility functions have been created in `lib/firestoreUtils.ts`

### 3. Problem Repository & Data Foundation (Completed)
- A smart problem import utility has been implemented that only requires LeetCode URLs:
  - `extractSlugFromUrl`: Parses LeetCode URLs to extract problem slugs
  - `problemConverter`: Handles Firestore data conversion for Problem objects
  - Integration with `leetcode-query` library for fetching problem data
  - `fetchAndImportProblemByUrl`: Function to import individual problems
  - `importProblemsFromUrls`: Function with rate limiting for batch imports
- API routes have been created for problem imports:
  - `POST /api/import-problem`: For individual problem imports
  - `POST /api/import-problems`: For batch imports
- Basic authentication flow has been implemented with:
  - Sign-in page
  - Sign-up page
  - Password reset functionality
  - Email verification

### 4. Companies Data (Completed)
- Company profiles for 3 major tech companies have been created
- Company data retrieval functions have been implemented

### 5. Authentication (Completed)
- Authentication context has been set up for state management
- Sign-in, sign-up, and password reset pages have been implemented
- Protected routes configuration has been added

### 6. In Progress Features
Based on the task breakdown and file structure, these features appear to be in progress:
- Code editing environment with Monaco Editor
- Code execution functionality
- Test case validation
- AI scenario generation

## Implementation Details

### Firebase Configuration
The Firebase configuration (`lib/firebase.ts`) initializes Firebase for both client and server-side rendering, setting up authentication and Firestore services with environment variables for security.

### Problem Import Utility
The problem import utility (`lib/firestoreUtils.ts`) is a sophisticated system that:
1. Extracts problem slugs from LeetCode URLs
2. Fetches comprehensive problem data using the `leetcode-query` library
3. Transforms this data to match the application's schema
4. Stores the formatted data in Firestore
5. Includes error handling and validation

### Authentication System
The authentication system includes:
1. User sign-up, sign-in, and password reset flows
2. Email verification
3. Protected routes that redirect unauthenticated users
4. Context provider for authentication state management

### API Routes
Several API routes have been implemented:
1. `/api/import-problem`: Imports a single problem from a LeetCode URL
2. `/api/import-problems`: Batch imports multiple problems from LeetCode URLs
3. `/api/companies`: Endpoints for company data

## Project Milestones

According to the project plan, AlgoIRL is following a 4-week development timeline:

- **Week 1**: Rapid MVP Development (Basic functionality)
- **Week 2**: Feature Enhancement & Content Expansion
- **Week 3**: Mock Interview Chatbot
- **Week 4**: Polish, Optimization & Launch

## Current Status & Next Steps

The project has successfully completed most of the Week 1 milestones, establishing the foundational infrastructure and data management systems. The authentication flow is functional, and the problem repository system is in place.

The next immediate steps are:

1. Completing the code editor implementation with Monaco Editor
2. Implementing code execution functionality
3. Setting up test case validation
4. Integrating AI for scenario generation
5. Creating the main user interface that combines all these components

## Code Analysis & Improvement Recommendations

After a comprehensive review of the codebase, several areas have been identified for potential improvement:

### 1. Firebase Implementation

**Current State:**
- Basic Firebase configuration with environment variables
- Standard initialization for authentication and Firestore
- Simple data converters for Firestore

**Recommendations:**
- Implement Firebase Admin SDK on the server side for better security
- Add caching layer for Firestore queries to improve performance
- Consider implementing optimistic UI updates to enhance user experience
- Add proper Firebase error handling and retry mechanisms for network issues
- Create a more robust authentication state persistence strategy

### 2. Data Fetching & Management

**Current State:**
- Direct Firestore queries in component code
- Basic rate limiting for batch imports
- Simple error handling

**Recommendations:**
- Implement a data fetching layer with SWR or React Query for caching and revalidation
- Create a more sophisticated rate limiting system based on Firebase quotas
- Add proper data pagination for problem listings
- Implement background processing for batch imports with progress tracking
- Consider using Firestore transactions for complex multi-document updates

### 3. Code Execution Environment (Open-Ended Implementation)

**Current State:**
- Basic serverless function structure in place
- Initial code execution files present but implementation incomplete

**Proposed Implementation:**
- **Secure Sandboxing:** Implement a container-based approach (Docker) for code execution
- **Language Support:**
  - JavaScript: Use isolated-vm for V8 isolation
  - Python: Employ a serverless Python runtime with resource limitations
  - Java: Implement JDK compilation and execution in isolated environments
- **Memory & Time Constraints:** Set strict resource limits (256MB memory, 5-second timeout)
- **Security Measures:**
  - Block network access from execution environment
  - Implement input sanitization
  - Set up filesystem isolation
  - Apply CPU and memory quotas
- **Execution Flow:**
  1. Code submission from client
  2. Server-side validation and sanitization
  3. Language-specific compilation (if needed)
  4. Execution in isolated environment
  5. Capture stdout, stderr, execution time, and memory usage
  6. Clean up resources
  7. Return results to client

### 4. Monaco Editor Integration (Open-Ended Implementation)

**Current State:**
- Basic editor example in place but not fully integrated

**Proposed Implementation:**
- **Advanced Features:**
  - Implement language-specific autocomplete
  - Add code snippets for common algorithms
  - Create customizable themes
  - Implement keyboard shortcuts matching popular IDEs
  - Enable linting integration
- **Performance Optimization:**
  - Lazy-load Monaco Editor to reduce initial bundle size
  - Implement editor state persistence to avoid losing work
  - Optimize editor reloads when switching problems
- **Accessibility:**
  - Add keyboard navigation support
  - Implement screen reader compatibility
  - Support high-contrast themes

### 5. AI Scenario Generation (Open-Ended Implementation)

**Current State:**
- Not yet implemented, planning stage only

**Proposed Implementation:**
- **Integration Options:**
  - OpenAI API with GPT-4 for high-quality scenarios
  - Anthropic Claude API as an alternative
  - Potential for local models in the future
- **Prompting Strategy:**
  - Create detailed system prompts with company background
  - Include problem description and constraints
  - Specify persona and interview style based on company
  - Use few-shot examples for consistent quality
- **Optimization:**
  - Implement aggressive caching to minimize API costs
  - Add background generation to precompute scenarios
  - Create fallback scenarios for API failures
  - Implement quality scoring to filter poor generations

### 6. Test Case Execution (Open-Ended Implementation)

**Current State:**
- Basic structure planned but not implemented

**Proposed Implementation:**
- **Test Case Design:**
  - Standard input/output format for all languages
  - Support for complex data structures (arrays, trees, linked lists)
  - Special case handling for edge conditions
- **Execution Strategy:**
  - Execute against all test cases in parallel
  - Implement early termination for failing cases
  - Support custom test cases added by users
- **Feedback System:**
  - Provide detailed error messages and line numbers
  - Show differences between expected and actual outputs
  - Offer performance metrics (time complexity analysis)
  - Suggest optimizations based on execution patterns

## Conclusion

The project is following a logical progression, building the foundation before moving to more complex features. The use of Firebase for authentication and data storage provides a scalable backend, while Next.js offers a robust framework for the frontend and API routes. The modular approach to code organization suggests good software engineering practices.

The careful implementation of the problem import utility that only requires LeetCode URLs is particularly notable, as it will minimize maintenance efforts while providing a rich dataset for the application.

With the recommended improvements and detailed implementation plans for open-ended features, AlgoIRL has the potential to become a robust and valuable tool for technical interview preparation. 