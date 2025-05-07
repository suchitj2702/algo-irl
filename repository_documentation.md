# AlgoIRL Repository Documentation

This document provides a detailed overview of each file and directory in the AlgoIRL repository, explaining their purpose and functionality.

## Root Directory

### Configuration Files
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

### Documentation Files
- **README.md**: Project overview and setup instructions.
- **documentation.md**: Comprehensive API documentation for the project.
- **project_milestones.md**: 4-week project plan with detailed milestones.
- **week1_task_breakdown.md**: Detailed tasks for week 1 of the project.
- **week2_task_breakdown.md**: Detailed tasks for week 2 of the project.
- **week3_task_breakdown.md**: Detailed tasks for week 3 of the project.
- **week4_task_breakdown.md**: Detailed tasks for week 4 of the project.
- **algoirl_project_report.md**: Project progress report with implementation details and analysis.

## Core Application Structure

### `/app` Directory
Next.js App Router structure with page components and API routes.

- **globals.css**: Global CSS styles for the application.
- **layout.tsx**: Root layout component that wraps all pages, containing global UI elements.
- **page.tsx**: Home page component with hero section and navigation.
- **favicon.ico**: Website favicon.

#### `/app/api` Directory
API routes implemented as serverless functions.

- **/import-problem**
  - **route.ts**: API handler for importing a single problem from LeetCode.
  
- **/import-problems**
  - **route.ts**: API handler for batch importing multiple problems from LeetCode.
  
- **/companies**
  - **route.ts**: API endpoints for retrieving company data.
  
- **/execute-code**
  - **route.ts**: API handler for executing user submitted code in a secure environment.

#### `/app/(auth)` Directory
Authentication-related pages and components.

- **/signin**
  - **page.tsx**: User sign-in page with email/password authentication.
  
- **/signup**
  - **page.tsx**: User registration page with email verification.
  
- **/reset-password**
  - **page.tsx**: Password reset functionality with email confirmation.
  
- **/verify-email**
  - **page.tsx**: Email verification confirmation page.

#### Other App Directories
- **/code-editor-example**
  - **page.tsx**: Example implementation of the Monaco code editor with language selection.
  
- **/submission-example**
  - **page.tsx**: Example of code submission and execution flow.
  
- **/toast-test**
  - **page.tsx**: Test page for notification components.

### `/lib` Directory
Core functionality and utility functions.

- **firebase.ts**: Firebase initialization with configuration for auth and Firestore.
- **firestoreUtils.ts**: Utilities for Firestore operations, including data conversion and problem import.
- **company.ts**: Company data management functions and initial company profiles.
- **codeExecution.js**: Code execution logic for running user submitted code.
- **languageConfigs.js**: Configuration for supported programming languages.
- **config.js**: Application configuration variables.

#### `/lib/sandboxing` Directory
Code execution sandboxing for security.

- **vm.js**: Virtual machine implementation for code isolation.
- **nodeVm.js**: Node.js-specific VM implementation using the VM2 and isolated-vm packages.

### `/components` Directory
Reusable UI components.

- **FirebaseStatus.tsx**: Component that displays Firebase connection status.

#### `/components/CodeEditor` Directory
Monaco editor integration components.

- **CodeEditor.tsx**: Base Monaco editor component with syntax highlighting.
- **LanguageSelector.tsx**: Dropdown component for selecting programming languages.
- **CodeEditorWithLanguageSelector.tsx**: Combined component with editor and language selection.
- **index.ts**: Barrel file exporting all code editor components.

#### `/components/execution` Directory
Code execution and test case components.

- Components for test case display, execution results, and performance metrics.

#### `/components/ui` Directory
Shared UI components.

- Basic UI components like buttons, inputs, modals, and notifications.

#### `/components/auth` Directory
Authentication-related components.

- Form components for authentication flows.

#### `/components/layout` Directory
Page layout components.

- Header, footer, navigation, and page container components.

### `/context` Directory
React context providers for state management.

- **AuthContext.tsx**: Authentication state provider with Firebase auth integration.
  - Manages current user state
  - Provides sign-in/sign-up methods
  - Handles authentication state persistence
  - Implements secure session management

### `/types` Directory
TypeScript type definitions.

- **entities.ts**: Types for core entities like Problem, Company, and Scenario.
  - Defines the Problem interface with properties for title, difficulty, description, etc.
  - Defines the Company interface with name, description, etc.
  - Defines the Scenario interface linking problems to companies
  - Includes supporting types for test cases, timestamps, etc.

### `/public` Directory
Static assets served at the root path.

- Contains images, icons, and other static files.

### `/scripts` Directory
Utility scripts for development and deployment.

- Contains build and deployment scripts.

## Detailed File Analysis

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

### Code Execution

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

#### `/lib/sandboxing/nodeVm.js`
Node.js-specific VM implementation that:
- Uses VM2 and isolated-vm for secure code execution
- Provides stronger isolation than the built-in Node.js VM
- Handles JavaScript-specific security considerations
- Implements memory and CPU usage monitoring

### Components

#### `/components/CodeEditor/CodeEditor.tsx`
Monaco editor component that:
- Initializes the Monaco Editor instance
- Configures editor options (line numbers, theme, etc.)
- Handles code changes and updates
- Implements code formatting
- Provides methods for getting and setting editor content

#### `/components/CodeEditor/LanguageSelector.tsx`
Language selection component that:
- Renders a dropdown for supported languages
- Handles language selection changes
- Updates editor configuration based on selected language
- Provides language-specific templates

#### `/components/CodeEditor/CodeEditorWithLanguageSelector.tsx`
Combined component that:
- Integrates the code editor and language selector
- Manages state between the two components
- Provides a unified interface for code editing
- Handles code submission events

#### `/components/FirebaseStatus.tsx`
Firebase status component that:
- Checks Firebase connection status
- Displays connection state to users
- Provides visual feedback for authentication state

### API Routes

#### `/app/api/import-problem/route.ts`
API endpoint that:
- Receives a LeetCode URL
- Validates the URL format
- Calls the import function from firestoreUtils
- Returns success status or error message
- Handles rate limiting and error cases

#### `/app/api/import-problems/route.ts`
API endpoint that:
- Receives an array of LeetCode URLs
- Validates each URL format
- Processes URLs in batches with rate limiting
- Returns success counts and error details
- Handles large batch operations efficiently

#### `/app/api/companies/route.ts`
API endpoint that:
- Retrieves company data from Firestore
- Supports filtering and searching
- Returns formatted company information
- Handles caching for improved performance

#### `/app/api/execute-code/route.ts`
API endpoint that:
- Receives code submission with language selection
- Validates input parameters
- Executes code in a sandboxed environment
- Runs the code against test cases
- Measures execution time and memory usage
- Returns execution results, including test case outcomes
- Handles errors and timeouts

### Authentication Pages

#### `/app/(auth)/signin/page.tsx`
Sign-in page that:
- Renders a form for email/password authentication
- Handles form validation and error states
- Uses AuthContext to perform authentication
- Redirects to home page on successful sign-in
- Provides password reset link
- Handles authentication errors with user-friendly messages

#### `/app/(auth)/signup/page.tsx`
Sign-up page that:
- Renders a registration form
- Implements form validation for email and password
- Handles creating new user accounts
- Sends email verification
- Displays appropriate success/error messages
- Redirects to appropriate page based on registration outcome

#### `/app/(auth)/reset-password/page.tsx`
Password reset page that:
- Provides form for entering email address
- Handles sending password reset emails
- Displays success/error messages
- Includes link back to sign-in page

#### `/app/(auth)/verify-email/page.tsx`
Email verification page that:
- Processes email verification links
- Confirms user email verification
- Updates user profile in Firebase
- Displays verification status to the user

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

## Summary

The AlgoIRL repository follows a well-structured organization with clear separation of concerns:

1. **App Router Structure**: Next.js app directory structure with pages and API routes
2. **Component Library**: Reusable UI components organized by function
3. **Utility Functions**: Core functionality in the lib directory
4. **Type System**: Strong TypeScript typing for all entities
5. **State Management**: React context for application state
6. **API Layer**: Well-defined API routes as serverless functions
7. **Documentation**: Comprehensive documentation and project planning

This architecture supports the application's goal of transforming coding problems into company-specific interview scenarios, with a focus on code execution, problem management, and authentication. 