# API Documentation

## Base URL
- **Production**: `https://your-backend-app.vercel.app`
- **Development**: `http://localhost:3000`

## Authentication
Currently, the API does not require authentication. All endpoints are publicly accessible.

## Available API Endpoints

This backend exposes only the following 4 API endpoints:

### 1. Code Execution

#### Execute Code
- **Endpoint**: `POST /api/execute-code`
- **Description**: Submit code for execution with test cases
- **Request Body**:
```json
{
  "code": "string (required) - The user's code solution",
  "language": "string (required) - Programming language (e.g., 'javascript', 'python', 'java')",
  "testCases": "array (required) - Array of test case objects",
  "boilerplateCode": "string (required) - Template/boilerplate code"
}
```

- **Test Case Object Structure**:
```json
{
  "stdin": "string or array - Input for the test case",
  "expectedStdout": "string or array - Expected output"
}
```

- **Response**:
```json
{
  "submissionId": "string - Unique ID for polling results",
  "message": "string - Success message"
}
```

#### Check Execution Status
- **Endpoint**: `GET /api/execute-code/status/{submissionId}`
- **Description**: Poll for execution results using the submission ID
- **Path Parameters**:
  - `submissionId`: The ID returned from the execute-code endpoint
- **Response**:
```json
{
  "status": "string - 'pending', 'completed', 'error'",
  "results": "object - Execution results (when completed)",
  "passed": "boolean - Whether all test cases passed",
  "testCasesPassed": "number - Number of test cases that passed",
  "testCasesTotal": "number - Total number of test cases",
  "executionTime": "number - Execution time in ms",
  "memoryUsage": "number - Memory usage in KB"
}
```

### 2. Problem Preparation

#### Prepare Problem Data
- **Endpoint**: `POST /api/problem/prepare`
- **Description**: Prepare and process problem data for the system
- **Request Body**: (Structure depends on your implementation)
- **Response**: (Structure depends on your implementation)

### 3. Company Initialization

#### Initialize Companies
- **Endpoint**: `POST /api/companies/initialize`
- **Description**: Initialize company data in the system
- **Request Body**: (Structure depends on your implementation)
- **Response**: (Structure depends on your implementation)

## Error Responses

All endpoints return errors in the following format:
```json
{
  "error": "string - Error message",
  "status": "string - Error status (optional)"
}
```

### Blocked Endpoints
All other API endpoints will return:
```json
{
  "error": "API endpoint not available"
}
```
**Status Code**: `404`

## HTTP Status Codes
- `200`: Success
- `400`: Bad Request (invalid input)
- `404`: Not Found / Endpoint not available
- `500`: Internal Server Error

## CORS Configuration
The API is configured to accept requests from any origin (`*`) for the exposed endpoints only.

## Example Frontend Integration

### JavaScript/TypeScript Example
```javascript
const API_BASE_URL = 'https://your-backend-app.vercel.app';

// Execute code
async function executeCode(code, language, testCases, boilerplateCode) {
  const response = await fetch(`${API_BASE_URL}/api/execute-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      language,
      testCases,
      boilerplateCode
    })
  });
  
  return await response.json();
}

// Poll for results
async function checkExecutionStatus(submissionId) {
  const response = await fetch(`${API_BASE_URL}/api/execute-code/status/${submissionId}`);
  return await response.json();
}

// Initialize companies
async function initializeCompanies(companyData) {
  const response = await fetch(`${API_BASE_URL}/api/companies/initialize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(companyData)
  });
  
  return await response.json();
}

// Prepare problem data
async function prepareProblem(problemData) {
  const response = await fetch(`${API_BASE_URL}/api/problem/prepare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(problemData)
  });
  
  return await response.json();
}
```

### React Hook Example
```javascript
import { useState } from 'react';

function useCodeExecution() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState(null);
  
  const executeCode = async (code, language, testCases, boilerplateCode) => {
    setIsExecuting(true);
    try {
      const submission = await executeCode(code, language, testCases, boilerplateCode);
      
      // Poll for results
      const pollResults = async () => {
        const status = await checkExecutionStatus(submission.submissionId);
        if (status.status === 'completed') {
          setResults(status);
          setIsExecuting(false);
        } else if (status.status === 'error') {
          setResults(status);
          setIsExecuting(false);
        } else {
          setTimeout(pollResults, 1000); // Poll every second
        }
      };
      
      pollResults();
    } catch (error) {
      setIsExecuting(false);
      setResults({ error: error.message });
    }
  };
  
  return { executeCode, isExecuting, results };
}
```

## Security Notes

- Only the 4 specified endpoints are accessible
- All other API routes are blocked and return 404 errors
- CORS is enabled only for the exposed endpoints
- Environment variables and sensitive data are protected 