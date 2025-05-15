# AlgoIRL Repository Documentation

## Overview
AlgoIRL is an interactive platform for practicing algorithm and data structure problems with real-time feedback and a sandboxed code execution environment. The platform transforms traditional algorithm problems into company-specific interview scenarios to provide a more realistic interview preparation experience.

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS
- **Backend**: Next.js API routes with TypeScript
- **Code Execution**: Judge0 API integration for secure code execution
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **AI Integration**: Multiple AI providers (Anthropic Claude, OpenAI, Google Gemini) for problem transformation and company-specific scenarios

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
  - `/[problemId]/route.ts`: Get problem by ID
  - `/import-batch/route.ts`: Batch import problems
  - `/transform/route.ts`: Transform problems to company-specific scenarios

- `/companies`: Company management endpoints
  - `/initialize/route.ts`: Initialize and generate company data
    - `GET`: Retrieves company data
    - `POST`: Generates company data for a specified company name using AI

- `/execute-code/route.ts`: Code execution endpoint that integrates with Judge0
- `/execution/[submissionId]/route.ts`: Retrieves results for a code execution

##### `/app/authentication` Directory - Authentication Pages

User authentication and account management pages

#### `/components` Directory - UI Components

- `/authentication`: Authentication-related components
  - Login, register, and password reset forms

- `/code-editor`: Code editor components
  - **CodeEditor.tsx**: Monaco editor integration
  - **LanguageSelector.tsx**: Programming language selection
  - **CodeEditorWithLanguageSelector.tsx**: Combined editor component

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
  - **codeExecution.ts**: Main orchestration logic for code execution
  - **judge0Client.ts**: Client for interacting with Judge0 API
  - **languageConfigs.ts**: Configuration for supported programming languages
  - **judge0Config.ts**: Judge0 API configuration
  - **codeExecutionUtils.ts**: Helper functions for code execution

- `/firebase`: Firebase configuration and utilities
  - Authentication
  - Firestore database access

- `/company`: Company data management
  - **companyUtils.ts**: Company profiles and data management
  - **companyGenerationPrompts.ts**: Prompts for company data generation

- `/problem`: Problem management utilities
  - **problemDatastoreUtils.ts**: Problem import and database interactions
  - **problemTransformer.ts**: Problem transformation utilities

- `/llmServices`: AI service integration
  - **anthropicService.ts**: Anthropic Claude integration
  - **openAiService.ts**: OpenAI integration
  - **geminiService.ts**: Google Gemini integration
  - **llmUtils.ts**: Common utilities for AI services, including prompt templates and caching

#### `/data-types` Directory - TypeScript Type Definitions

- **problem.ts**: Problem-related types
- **company.ts**: Company-related types
- **execution.ts**: Code execution types
- **user.ts**: User data types
- **api.ts**: API request/response types

### Public Assets

- `/public`: Static assets including images and icons

## Key Features

### Smart Problem Import
The platform uses AI to populate a comprehensive problem repository:

1. Accepts LeetCode problem URLs as input
2. Extracts problem slugs from URLs
3. Uses multiple AI models to generate detailed problem data including:
   - Problem descriptions and constraints
   - Test cases with inputs and expected outputs
   - Multiple solution approaches and complexity analysis
   - Language-specific boilerplate code and solution templates
4. Implements test case verification using Judge0
5. Features rate limiting and error handling

### AI-Powered Problem Transformation
The platform transforms traditional algorithm problems into company-specific interview scenarios using AI:

1. Analyzes the problem to identify key algorithms and data structures
2. Integrates company context (products, technologies, domain)
3. Creates a realistic interview scenario tailored to the company
4. Provides additional context details for enhanced realism
5. Implements caching for efficient reuse of scenarios

### Judge0 Code Execution Environment
The platform provides a secure code execution environment through Judge0 API integration:

1. Supports multiple programming languages (JavaScript, Python, Java, C++, Go, Ruby)
2. Executes code against test cases with secure sandboxing
3. Provides performance metrics (execution time, memory usage)
4. Implements batch submission for efficient processing
5. Handles various submission states and errors gracefully

### Multi-Model AI Integration
The platform integrates with multiple AI providers:

1. Anthropic Claude: Primary provider for high-quality problem transformation
2. OpenAI: Alternative provider for AI tasks with fallback capabilities
3. Google Gemini: Additional provider for specific tasks
4. Unified interface with provider-specific adapters
5. Comprehensive caching system to reduce API costs and improve performance
6. Task-specific prompt templates for optimized results

### Company Data Management
The platform includes comprehensive company data management:

1. AI-generated company profiles with rich metadata
2. Domain-specific categorization and filtering
3. Company name validation and correction
4. Custom company support for personalized scenarios

## API Endpoints

### Problem Management

#### `POST /api/problem/import-batch`
- Imports multiple problems from LeetCode URLs
- Uses AI to generate comprehensive problem data
- Validates and stores problems in Firestore
- Returns success count and any errors

#### `GET /api/problem/[problemId]`
- Retrieves a specific problem by ID
- Returns complete problem details including test cases and language-specific details

#### `POST /api/problem/transform`
- Transforms a problem to a company-specific scenario
- Requires problem ID and company ID
- Supports caching with optional cache bypass
- Returns transformed scenario with context details

### Code Execution

#### `POST /api/execute-code`
- Executes user code using Judge0 API
- Accepts code, language, and problem ID
- Processes code with language-specific templates
- Returns submission ID for polling results

#### `GET /api/execution/[submissionId]`
- Retrieves results for a code execution submission
- Returns execution status, test results, and performance metrics
- Handles various execution states (pending, completed, error)

### Company Data

#### `GET /api/companies`
- Retrieves a list of available companies
- Supports filtering by domain or other parameters

#### `GET /api/companies/[id]`
- Retrieves details for a specific company

#### `POST /api/companies/initialize`
- Generates and stores company data for a specified company using AI
- Implements name correction for misspelled company names
- Returns generated company data with rich metadata

## Type System

### Problem Types
```typescript
interface Problem {
  id: string;
  title: string;
  difficulty: ProblemDifficulty;
  categories: string[];
  description: string;
  constraints: string[];
  leetcodeLink?: string;
  isBlind75: boolean;
  testCases: TestCase[];
  solutionApproach: string | null;
  timeComplexity: string | null;
  spaceComplexity: string | null;
  languageSpecificDetails: Record<string, LanguageSpecificProblemDetails>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface TestCase {
  stdin: string;
  expectedStdout: string;
  explanation?: string;
  isSample?: boolean;
}

interface LanguageSpecificProblemDetails {
  solutionFunctionNameOrClassName: string;
  solutionStructureHint: string;
  defaultUserCode: string;
  boilerplateCodeWithPlaceholder: string;
  optimizedSolutionCode: string;
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
  logoUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Execution Types
```typescript
interface CodeExecutionRequest {
  code: string;
  language: string;
  problemId?: string;
  customTestCases?: TestCase[];
}

interface ExecutionResult {
  status: "pending" | "completed" | "error";
  passed?: boolean;
  results?: {
    testResults: TestCaseResult[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      executionTime: number;
      memoryUsage: number;
    }
  };
  error?: string;
}

interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  executionTime: number;
  error?: string;
}
```

## Development Workflow

1. **Local Development**: Run `npm run dev` to start the development server
2. **Building**: Run `npm run build` to create a production build
3. **Deployment**: Deploy to Vercel for production hosting

## Security Considerations

1. **Code Execution**: User code is executed securely through Judge0 API in isolated containers
2. **Authentication**: Firebase Auth handles secure user authentication
3. **Data Validation**: All user inputs are validated before processing
4. **Error Handling**: Comprehensive error handling with user-friendly messages
5. **Rate Limiting**: API endpoints implement rate limiting and retry mechanisms for reliability

## LLM Service Architecture

The platform implements a flexible LLM service architecture for AI tasks:

### AI Provider Services

1. **AnthropicService**
   - Integrates with Anthropic's Claude API
   - Supports Claude Sonnet and Haiku models
   - Includes specialized prompt handling
   - Implements token usage optimization

2. **OpenAiService**
   - Integrates with OpenAI's API
   - Supports GPT-4 and other models
   - Maintains consistent interface with other providers

3. **GeminiService**
   - Integrates with Google's Gemini API
   - Provides additional capabilities for specific tasks

### Task-Based API

The platform implements a task-based approach for AI interactions:

1. **executeLlmTask**: Central function for executing AI tasks
   - Accepts task type, prompt data, and system prompt
   - Routes to appropriate provider based on configuration
   - Implements caching with TTL
   - Handles errors with retries and fallbacks

2. **Task Types**
   - **problemGeneration**: Creates detailed problem data
   - **companyGeneration**: Generates rich company profiles
   - **scenarioGeneration**: Transforms problems to company scenarios

### Caching Strategy

The platform implements a comprehensive caching strategy:

1. **Task-Specific Caching**: Different cache TTLs based on task type
2. **Cache Invalidation**: Supports force refresh when needed
3. **Cache Monitoring**: Tracks cache hits/misses for optimization