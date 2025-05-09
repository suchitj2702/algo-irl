# AlgoIRL Repository Documentation

## Overview
AlgoIRL is an interactive platform for practicing algorithm and data structure problems with real-time feedback and a sandboxed code execution environment. The platform transforms traditional algorithm problems into company-specific interview scenarios to provide a more realistic interview preparation experience.

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS
- **Backend**: Next.js API routes with TypeScript
- **Code Execution**: VM2 for sandboxed code execution
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **AI Integration**: Anthropic AI for problem transformation

## Repository Structure

### Root Configuration Files
- **package.json**: Defines project dependencies and scripts
- **tsconfig.json**: TypeScript configuration
- **next.config.ts**: Next.js configuration
- **postcss.config.mjs**: PostCSS configuration for TailwindCSS
- **vercel.json**: Vercel deployment configuration
- **.eslintrc.json**: ESLint configuration
- **.gitignore**: Git ignore rules

### Core Application Structure

#### `/app` Directory (Next.js App Router)

- **layout.tsx**: Root layout component
- **page.tsx**: Home page component
- **globals.css**: Global styles
- **favicon.ico**: Application favicon

##### `/app/api` Directory - API Routes

- `/problem`: Problem management endpoints
  - `/import/route.ts`: Import problems from LeetCode
  - `/import-batch/route.ts`: Batch import problems
  - `/transform/route.ts`: Transform problems to company-specific scenarios

- `/companies`: Company management endpoints
  - `/initialize/route.ts`: Initialize company data
    - `GET`: Initializes predefined tech companies
    - `POST`: Generates company data for a specified company name using AI

- `/execute-code/route.ts`: Code execution endpoint

##### `/app/examples` Directory - Example Implementations

Example pages demonstrating various features and components

##### `/app/authentication` Directory - Authentication Pages

User authentication and account management pages

#### `/components` Directory - UI Components

- `/authentication`: Authentication-related components
  - Login, register, and password reset forms

- `/code-editor`: Code editor components
  - Monaco editor integration
  - Language selection
  - Test case execution

- `/layout`: Layout components
  - Header, footer, navigation
  - Page containers and layouts

- `/problem`: Problem-related components
  - Problem display
  - Problem transformation
  - Problem lists and filters

- `/ui`: Reusable UI components
  - Buttons, inputs, modals
  - Form elements and feedback components

#### `/lib` Directory - Core Functionality

- `/code-execution`: Code execution utilities
  - Language configuration
  - Execution environment

- `/sandboxing`: Secure code execution sandbox
  - VM2 integration
  - Execution isolation

- `/firebase`: Firebase configuration and utilities
  - Authentication
  - Firestore database access

- `/company`: Company data management
  - Company profiles
  - Industry data

- `/problem`: Problem management utilities
  - Problem import
  - Problem transformation

- `/llmServices`: AI service integration
  - Anthropic API integration
  - Prompt generation and handling
  - Two specialized functions for different tasks:
    - Problem transformation (using claude-3-7-sonnet model)
    - Company data generation (using faster claude-3-5-haiku model)

#### `/data-types` Directory - TypeScript Type Definitions

- **problem.ts**: Problem-related types
- **company.ts**: Company-related types
- **execution.ts**: Code execution types
- **user.ts**: User data types
- **api.ts**: API request/response types

### Public Assets

- `/public`: Static assets including images and icons

## Key Features

### Problem Transformation
The platform uses AI to transform traditional algorithm problems into company-specific interview scenarios. The transformation process:

1. Analyzes the problem to identify key algorithms and data structures
2. Integrates company context (products, technologies, domain)
3. Creates a realistic interview scenario tailored to the company

### Code Execution Environment
The platform provides a secure sandbox for executing user code:

1. Supports multiple programming languages
2. Runs code against test cases
3. Provides performance metrics (execution time, memory usage)
4. Ensures security through VM2 sandboxing

### Authentication System
User authentication is handled through Firebase Auth:

1. Email/password authentication
2. Profile management
3. Secure session handling

### AI-Powered Company Data Generation
The platform uses Anthropic's AI to automatically generate company data:

1. Accepts a company name as input
2. Intelligently corrects misspelled company names (e.g., "Googel" → "Google")
3. Uses the faster claude-3-5-haiku model to generate comprehensive company details
4. Structures the data according to the Company interface
5. Stores the data in Firestore for later use
6. Uses specialized caching for company data to improve performance and reduce API calls

## API Endpoints

### Problem Management

#### `POST /api/problem/import`
- Imports a single problem from LeetCode
- Accepts LeetCode URL
- Returns imported problem data

#### `POST /api/problem/import-batch`
- Imports multiple problems from LeetCode
- Accepts array of LeetCode URLs
- Returns batch import results

#### `POST /api/problem/transform`
- Transforms a problem to a company-specific scenario
- Accepts problem ID and company ID
- Returns transformed scenario with context information

### Code Execution

#### `POST /api/execute-code`
- Executes user code in a secure sandbox
- Accepts code, language, and test cases
- Returns execution results and performance metrics

### Company Data

#### `GET /api/companies/initialize`
- Initializes the database with predefined tech company data
- Returns success status and message

#### `POST /api/companies/initialize`
- Generates and stores company data for a specified company using AI
- Accepts company name in the request body (tolerates misspellings)
- Automatically corrects misspelled company names
- Returns generated company information, correction status, and success message

## Type System

### Problem Types
```typescript
interface Problem {
  id: string;
  title: string;
  difficulty: string;
  categories: string[];
  description: string;
  constraints: string[];
  leetcodeLink?: string;
  testCases: TestCase[];
  // Additional fields...
}

interface TestCase {
  input: {
    raw: string;
    parsed?: any;
  };
  output: any;
}
```

### Company Types
```typescript
interface Company {
  id: string;
  name: string;
  description: string;
  domain: string;
  products: string[];
  technologies: string[];
  interviewFocus: string[];
  // Additional fields...
}
```

### Execution Types
```typescript
interface CodeExecutionRequest {
  code: string;
  language: string;
  testCases: TestCase[];
  timeLimit?: number;
  memoryLimit?: number;
}

interface ExecutionResult {
  success: boolean;
  testResults: TestResult[];
  executionTime: number;
  memoryUsage: number;
  error?: string;
}
```

## Development Workflow

1. **Local Development**: Run `npm run dev` to start the development server
2. **Building**: Run `npm run build` to create a production build
3. **Deployment**: Deploy to Vercel for production hosting

## Security Considerations

1. **Code Execution**: User code is executed in a secure sandbox using VM2
2. **Authentication**: Firebase Auth handles secure user authentication
3. **Data Validation**: All user inputs are validated before processing
4. **Rate Limiting**: API endpoints implement rate limiting to prevent abuse

## AnthropicService

The AnthropicService handles integration with Anthropic's Claude AI models for different tasks:

### Key Methods

#### `transformWithCustomPrompt`
- Uses claude-3-7-sonnet model for high-quality problem transformation
- Transforms algorithm problems into company-specific interview scenarios
- Includes specialized caching for transformed problems

#### `generateCompanyData`
- Uses claude-3-5-haiku model for faster company data generation
- Creates detailed company profiles from company names
- Utilizes separate cache for company data
- Optimized for the company data generation tasks

### Shared Features
- Error handling with formatted error messages
- Automatic retries for API failures
- Configurable caching with 24-hour expiry
- Memory-efficient storage of responses