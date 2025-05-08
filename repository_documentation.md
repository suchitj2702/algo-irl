# AlgoIRL Repository Documentation

This document provides a detailed overview of each file and directory in the AlgoIRL repository, explaining their purpose and functionality.

## Code Reorganization

The codebase has been reorganized to follow the Next.js App Router pattern exclusively, eliminating the mix of Pages Router and App Router. Key changes include:

1. **Consolidated Router Architecture**: Migrated all Pages Router routes to App Router
2. **Eliminated Duplicate API Endpoints**: Merged redundant API functionality
3. **Consolidated Components**: Unified similar components and removed redundancy
4. **Improved Directory Structure**: Organized code by feature rather than technical category

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

- **/problem**
  - **import/route.ts**: API handler for importing a single problem from LeetCode.
  - **import-batch/route.ts**: API handler for batch importing multiple problems from LeetCode.
  - **transform/route.ts**: API handler for transforming problems into company-specific scenarios with intelligent context extraction.
  
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

#### `/app/examples` Directory
Example implementations for various features.

- **/code-editor**
  - **page.tsx**: Example implementation of the Monaco code editor with language selection.
  
- **/submission**
  - **page.tsx**: Example of code submission and execution flow.
  
- **/problem-transform**
  - **page.tsx**: Example of problem transformation functionality with company context.

- **/ui-components**
  - **page.tsx**: Showcase of UI components used in the application.

### `/components` Directory
Reusable UI components organized by feature.

#### `/components/auth` Directory
Authentication-related components.

- **AuthForm.tsx**: Base authentication form with validation.
- **SignInForm.tsx**: Sign-in specific form component.
- **SignUpForm.tsx**: Registration specific form component.
- **PasswordResetForm.tsx**: Password reset form component.

#### `/components/code` Directory
Code editor and execution components.

- **CodeEditor.tsx**: Monaco-based code editor with syntax highlighting.
- **LanguageSelector.tsx**: Language selection dropdown component.
- **TestCaseRunner.tsx**: Component for running code against test cases.
- **ExecutionResults.tsx**: Display component for code execution results.
- **PerformanceMetrics.tsx**: Component for displaying execution metrics.

#### `/components/problem` Directory
Problem-related components.

- **ProblemDetails.tsx**: Component for displaying problem details.
- **ProblemTransformer.tsx**: Component for transforming problems to company scenarios with intelligent context extraction.
- **ProblemList.tsx**: Component for displaying a list of problems.
- **ProblemFilters.tsx**: Filtering component for problems by difficulty, etc.
- **CompanySelector.tsx**: Component for selecting a company for transformation.

#### `/components/layout` Directory
Page layout components.

- **Header.tsx**: Application header with navigation.
- **Footer.tsx**: Application footer with links.
- **Sidebar.tsx**: Sidebar navigation component.
- **Container.tsx**: Page container component.

#### `/components/ui` Directory
Basic UI components.

- **Button.tsx**: Styled button component.
- **Input.tsx**: Form input component.
- **Modal.tsx**: Modal dialog component.
- **Notification.tsx**: Toast notification component.
- **Dropdown.tsx**: Dropdown selection component.

### `/lib` Directory
Core functionality and utility functions.

- **firebase.ts**: Firebase initialization with configuration for auth and Firestore.
- **firestoreUtils.ts**: Utilities for Firestore operations, including data conversion and problem import.
- **company.ts**: Company data management functions and initial company profiles.
- **codeExecution.js**: Code execution logic for running user submitted code.
- **languageConfigs.js**: Configuration for supported programming languages.
- **config.js**: Application configuration variables.
- **anthropicService.ts**: Service that integrates with Anthropic API to transform coding problems into company-specific interview scenarios with caching and retry mechanisms.
- **problemTransformer.ts**: Comprehensive utility that extracts key information from coding problems and company profiles to enhance AI prompt quality, resulting in more relevant scenario generation with algorithm detection and context awareness.

#### `/lib/sandboxing` Directory
Code execution sandboxing for security.

- **vm.js**: Virtual machine implementation for code isolation.
- **nodeVm.js**: Node.js-specific VM implementation using the VM2 and isolated-vm packages.

### `/context` Directory
React context providers for state management.

- **AuthContext.tsx**: Authentication state provider with Firebase auth integration.
  - Manages current user state
  - Provides sign-in/sign-up methods
  - Handles authentication state persistence
  - Implements secure session management

### `/types` Directory
TypeScript type definitions.

- **index.ts**: Re-exports all types for easy importing.
- **problem.ts**: Types related to coding problems.
- **company.ts**: Types related to companies.
- **user.ts**: Types related to user data.
- **execution.ts**: Types related to code execution.
- **api.ts**: Types for API requests and responses.

### `/hooks` Directory
Custom React hooks.

- **useAuth.ts**: Hook for accessing authentication context.
- **useCodeExecution.ts**: Hook for executing code and managing results.
- **useProblemTransform.ts**: Hook for transforming problems into company scenarios.
- **useFirestore.ts**: Hook for Firestore data operations.

### `/public` Directory
Static assets served at the root path.

- Contains images, icons, and other static files.

### `/scripts` Directory
Utility scripts for development and deployment.

- Contains build and deployment scripts.

## Detailed API Endpoints

### Problem-Related APIs

#### `/app/api/problem/import/route.ts`
API endpoint that:
- Receives a LeetCode URL
- Validates the URL format
- Calls the import function from firestoreUtils
- Returns success status or error message
- Handles rate limiting and error cases

#### `/app/api/problem/import-batch/route.ts`
API endpoint that:
- Receives an array of LeetCode URLs
- Validates each URL format
- Processes URLs in batches with rate limiting
- Returns success counts and error details
- Handles large batch operations efficiently

#### `/app/api/problem/transform/route.ts`
Advanced API endpoint that:
- Receives problem ID and company ID
- Uses the problemTransformer utility to extract key information
- Generates an optimized prompt with contextual awareness
- Transforms the problem while maintaining algorithmic integrity
- Returns both the scenario and context information
- Includes detected algorithms, data structures, and suggested analogies
- Implements intelligent caching to improve performance
- Provides relevance scoring between problem and company
- Uses all available information to create the most company-specific and realistic scenario possible

### Company APIs

#### `/app/api/companies/route.ts`
API endpoint that:
- Retrieves company data from Firestore
- Supports filtering and searching
- Returns formatted company information
- Handles caching for improved performance

### Code Execution APIs

#### `/app/api/execute-code/route.ts`
API endpoint that:
- Receives code submission with language selection
- Validates input parameters
- Executes code in a sandboxed environment
- Runs the code against test cases
- Measures execution time and memory usage
- Returns execution results, including test case outcomes
- Handles errors and timeouts

## Removed Redundancy

1. **Consolidated Problem Transformation**: Created a single, optimized transformation endpoint that incorporates all the advanced features (algorithm detection, context awareness, relevance scoring) without redundant implementations.

2. **Unified Problem Transformer Component**: Consolidated transformation functionality into a single component that provides the best possible experience.

3. **Standardized Directory Structure**: Reorganized components by feature rather than technical category, making relationships more explicit.

4. **Consolidated Example Pages**: Moved all example implementations to `/app/examples/*` with clear naming.

5. **Unified API Structure**: Organized API endpoints by domain (`problem`, `companies`, etc.) rather than by individual function.

6. **Eliminated Duplicate Context Providers**: Ensured each context has a single implementation with proper reusability.

## Type System Improvements

Reorganized types into domain-specific files for better organization:

### `/types/problem.ts`
```typescript
export interface Problem {
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

export interface TestCase {
  input: {
    raw: string;
    parsed?: any;
  };
  output: any;
}

export interface ProblemTransformRequest {
  problemId: string;
  companyId: string;
  useCache?: boolean;
}

export interface TransformationResult {
  scenario: string;
  contextInfo: {
    detectedAlgorithms: string[];
    detectedDataStructures: string[];
    relevanceScore: number;
    suggestedAnalogyPoints: string[];
  }
}
```

### `/types/company.ts`
```typescript
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
}
```

### `/types/execution.ts`
```typescript
export interface CodeExecutionRequest {
  code: string;
  language: string;
  testCases: TestCase[];
  timeLimit?: number;
  memoryLimit?: number;
}

export interface ExecutionResult {
  success: boolean;
  testResults: TestResult[];
  executionTime: number;
  memoryUsage: number;
  error?: string;
}
```

## Summary

The AlgoIRL repository has been reorganized to follow best practices:

1. **Single Router Architecture**: Exclusively uses Next.js App Router
2. **Feature-Based Organization**: Code organized by domain/feature rather than technical category
3. **Eliminated Redundancy**: Removed duplicate implementations and consolidated transformation functionality into a single, optimal solution
4. **Improved Type System**: Domain-specific type files with clear relationships
5. **Clear API Structure**: API endpoints organized by domain
6. **Enhanced Reusability**: Components designed for maximum reuse
7. **Well-Documented Structure**: Clear documentation of all parts of the codebase
8. **Optimized Problem Transformation**: Single, comprehensive transformation solution that uses all available context

This reorganization improves maintainability, reduces code duplication, and makes the codebase easier to understand and extend.