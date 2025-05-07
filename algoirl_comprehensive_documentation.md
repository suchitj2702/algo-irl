# AlgoIRL - Comprehensive Documentation

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

## Repository Structure

### Root Directory

#### Configuration Files
- **package.json**: Defines project dependencies and scripts, including Next.js, React, Firebase, Monaco Editor, and tools for code execution.
- **package-lock.json**: Lock file for npm dependencies ensuring consistent installations.
- **tsconfig.json**: TypeScript configuration defining compiler options and include/exclude paths.
- **next.config.ts**: Next.js configuration file for customizing the framework behavior.
- **postcss.config.mjs**: PostCSS configuration for CSS processing.
- **vercel.json**: Vercel deployment configuration for the application.
- **.eslintrc.json**: ESLint configuration for code linting.
- **.gitignore**: Specifies files and directories to ignore in Git tracking.
- **.cursorrules**: Configuration for the Cursor IDE.
- **next-env.d.ts**: TypeScript declarations for Next.js.

#### Documentation Files
- **README.md**: Project overview and setup instructions.
- **documentation.md**: Comprehensive API documentation for the project.
- **project_milestones.md**: 4-week project plan with detailed milestones.
- **week1_task_breakdown.md**: Detailed tasks for week 1 of the project.
- **week2_task_breakdown.md**: Detailed tasks for week 2 of the project.
- **week3_task_breakdown.md**: Detailed tasks for week 3 of the project.
- **week4_task_breakdown.md**: Detailed tasks for week 4 of the project.

### Core Application Structure

#### `/app` Directory
Next.js App Router structure with page components and API routes.

- **globals.css**: Global CSS styles for the application.
- **layout.tsx**: Root layout component that wraps all pages, containing global UI elements.
- **page.tsx**: Home page component with hero section and navigation.
- **favicon.ico**: Website favicon.

##### `/app/api` Directory
API routes implemented as serverless functions.

- **/import-problem**
  - **route.ts**: API handler for importing a single problem from LeetCode.
  
- **/import-problems**
  - **route.ts**: API handler for batch importing multiple problems from LeetCode.
  
- **/companies**
  - **route.ts**: API endpoints for retrieving company data.
  
- **/execute-code**
  - **route.ts**: API handler for executing user submitted code in a secure environment.

##### `/app/(auth)` Directory
Authentication-related pages and components.

- **/signin**
  - **page.tsx**: User sign-in page with email/password authentication.
  
- **/signup**
  - **page.tsx**: User registration page with email verification.
  
- **/reset-password**
  - **page.tsx**: Password reset functionality with email confirmation.
  
- **/verify-email**
  - **page.tsx**: Email verification confirmation page.

##### Other App Directories
- **/code-editor-example**
  - **page.tsx**: Example implementation of the Monaco code editor with language selection.
  
- **/submission-example**
  - **page.tsx**: Example of code submission and execution flow.
  
- **/toast-test**
  - **page.tsx**: Test page for notification components.

#### `/lib` Directory
Core functionality and utility functions.

- **firebase.ts**: Firebase initialization with configuration for auth and Firestore.
- **firestoreUtils.ts**: Utilities for Firestore operations, including data conversion and problem import.
- **company.ts**: Company data management functions and initial company profiles.
- **codeExecution.js**: Code execution logic for running user submitted code.
- **languageConfigs.js**: Configuration for supported programming languages.
- **config.js**: Application configuration variables.

##### `/lib/sandboxing` Directory
Code execution sandboxing for security.

- **vm.js**: Virtual machine implementation for code isolation.
- **nodeVm.js**: Node.js-specific VM implementation using the VM2 and isolated-vm packages.

#### `/components` Directory
Reusable UI components.

- **FirebaseStatus.tsx**: Component that displays Firebase connection status.

##### `/components/CodeEditor` Directory
Monaco editor integration components.

- **CodeEditor.tsx**: Base Monaco editor component with syntax highlighting.
- **LanguageSelector.tsx**: Dropdown component for selecting programming languages.
- **CodeEditorWithLanguageSelector.tsx**: Combined component with editor and language selection.
- **index.ts**: Barrel file exporting all code editor components.

##### `/components/execution` Directory
Code execution and test case components.

- Components for test case display, execution results, and performance metrics.

##### `/components/ui` Directory
Shared UI components.

- Basic UI components like buttons, inputs, modals, and notifications.

##### `/components/auth` Directory
Authentication-related components.

- Form components for authentication flows.

##### `/components/layout` Directory
Page layout components.

- Header, footer, navigation, and page container components.

#### `/context` Directory
React context providers for state management.

- **AuthContext.tsx**: Authentication state provider with Firebase auth integration.
  - Manages current user state
  - Provides sign-in/sign-up methods
  - Handles authentication state persistence
  - Implements secure session management

#### `/types` Directory
TypeScript type definitions.

- **entities.ts**: Types for core entities like Problem, Company, and Scenario.
  - Defines the Problem interface with properties for title, difficulty, description, etc.
  - Defines the Company interface with name, description, etc.
  - Defines the Scenario interface linking problems to companies
  - Includes supporting types for test cases, timestamps, etc.

#### `/public` Directory
Static assets served at the root path.

#### `/scripts` Directory
Utility scripts for development and deployment.

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

## Detailed Implementation Analysis

### Core Application Files

#### `/app/layout.tsx`
Root layout component that:
- Implements the HTML structure with metadata
- Includes global styles
- Wraps the application with context providers
- Handles dark/light mode

#### `/app/page.tsx`
Home page component that:
- Renders the landing page for the application
- Displays Firebase connection status
- Provides navigation links to documentation and deployment

#### `/context/AuthContext.tsx`
Authentication context provider that:
- Manages user authentication state
- Provides sign-in, sign-up, and sign-out functionality
- Handles password reset and email verification
- Exposes current user information to components
- Implements secure authentication persistence
- Provides protected route functionality

### Firebase Integration

#### `/lib/firebase.ts`
Firebase initialization that:
- Configures Firebase with environment variables
- Initializes Firebase App, Authentication, and Firestore
- Exports configured instances for use across the application
- Handles SSR compatibility with Next.js

#### `/lib/firestoreUtils.ts`
Firestore utility functions that:
- Parse LeetCode URLs to extract problem slugs (`extractSlugFromUrl`)
- Convert between application models and Firestore data (`problemConverter`)
- Import problems from LeetCode using the API (`fetchAndImportProblemByUrl`)
- Handle batch imports with rate limiting (`importProblemsFromUrls`)
- Provide CRUD operations for problems and other entities
- Implement error handling for Firestore operations
- Process and format problem data from LeetCode

#### `/lib/company.ts`
Company data management that:
- Defines initial company profiles for major tech companies
- Provides functions to retrieve company information
- Implements company data import and update functionality
- Handles company-specific data formatting

### Code Execution Implementation

#### `/lib/codeExecution.js`
Code execution functionality that:
- Handles code submission for different languages
- Manages the execution environment setup
- Runs code against test cases
- Captures execution results and performance metrics
- Implements timeouts for long-running code
- Provides error handling for compilation and runtime errors
- Formats execution results for display

#### `/lib/languageConfigs.js`
Language configuration that:
- Defines supported programming languages (JavaScript, Python, Java)
- Specifies compilation and execution commands for each language
- Provides language-specific templates and code snippets
- Configures Monaco Editor for each language
- Defines syntax highlighting rules
- Implements language-specific test case formatting

#### `/lib/sandboxing/vm.js`
Code sandboxing implementation that:
- Creates isolated environments for code execution
- Prevents malicious code from accessing system resources
- Implements resource limits (CPU, memory)
- Handles timeouts for infinite loops
- Captures console output and error messages

#### `/components/CodeEditor/CodeEditor.tsx`
Monaco editor component that:
- Initializes the Monaco Editor instance
- Configures editor options (line numbers, theme, etc.)
- Handles code changes and updates
- Implements code formatting
- Provides methods for getting and setting editor content

### API Implementation

#### `/app/api/import-problem/route.ts`
API endpoint that:
- Receives a LeetCode URL
- Validates the URL format
- Calls the import function from firestoreUtils
- Returns success status or error message
- Handles rate limiting and error cases

#### `/app/api/execute-code/route.ts`
API endpoint that:
- Receives code submission with language selection
- Validates input parameters
- Executes code in a sandboxed environment
- Runs the code against test cases
- Measures execution time and memory usage
- Returns execution results, including test case outcomes
- Handles errors and timeouts

## Type Definitions

### `/types/entities.ts`
Core type definitions that include:

#### Problem Interface
```typescript
interface Problem {
  id: string;
  title: string;
  difficulty: ProblemDifficulty;
  categories: string[];
  description: string;
  constraints: string[];
  leetcodeLink: string;
  isBlind75: boolean;
  testCases: TestCase[];
  solutionApproach: string | null;
  timeComplexity: string | null;
  spaceComplexity: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Company Interface
```typescript
interface Company {
  id: string;
  name: string;
  description: string;
  domain: string;
  logoUrl?: string;
  technologies: string[];
  interviewStyle: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Scenario Interface
```typescript
interface Scenario {
  id: string;
  problemId: string;
  companyId: string;
  scenario: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### TestCase Interface
```typescript
interface TestCase {
  input: {
    raw: string;
    parsed?: any;
  };
  output: any;
}
```

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

The AlgoIRL project demonstrates a well-structured architecture with clear separation of concerns:

1. **App Router Structure**: Next.js app directory structure with pages and API routes
2. **Component Library**: Reusable UI components organized by function
3. **Utility Functions**: Core functionality in the lib directory
4. **Type System**: Strong TypeScript typing for all entities
5. **State Management**: React context for application state
6. **API Layer**: Well-defined API routes as serverless functions

The project is following a logical progression, building the foundation before moving to more complex features. The use of Firebase for authentication and data storage provides a scalable backend, while Next.js offers a robust framework for the frontend and API routes. The modular approach to code organization suggests good software engineering practices.

The careful implementation of the problem import utility that only requires LeetCode URLs is particularly notable, as it will minimize maintenance efforts while providing a rich dataset for the application.

With the recommended improvements and detailed implementation plans for open-ended features, AlgoIRL has the potential to become a robust and valuable tool for technical interview preparation. 