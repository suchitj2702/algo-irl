# AlgoIRL: Week 1 Task Breakdown

## Overview
This document outlines the detailed tasks for Week 1 of the AlgoIRL MVP development using Firebase and Vercel. This is a hyper-focused week to deliver the essential MVP with a coding environment in just seven days.

## Day 1: Project Setup & Infrastructure

### Manual Setup Tasks
1. **Create Firebase Project**
   - Create new Firebase project in console
   - Enable Authentication (email only for MVP)
   - Enable Firestore database
   - Note down Firebase project config details
   - **Verification**: Screenshot of Firebase console with project created

2. **Setup Vercel Account**
   - Create/login to Vercel account
   - Connect to GitHub repository
   - **Verification**: Vercel dashboard access

3. **Setup Development Environment**
   - Install Node.js and npm/yarn
   - Install Firebase CLI
   - Install Git
   - **Verification**: Run `node -v`, `npm -v`, `firebase -v` commands successfully

### Coding Tasks (Cursor AI)
1. **Initialize Next.js Project**
   - Create new Next.js project with TypeScript
   - Configure project structure (pages, components, lib folders)
   - Initialize Git repository
   - **Input for Cursor AI**: "Create a Next.js project with TypeScript for a web application called AlgoIRL that will transform coding problems into company-specific scenarios"
   - **Output**: Basic Next.js project structure with TypeScript
   - **Testing**: 
     - Run `npm run dev` and verify the app starts without errors
     - Check browser console for JavaScript errors
     - **Verification**: App loads at localhost:3000 with no console errors

2. **Firebase Client Configuration**
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
1. **Define Data Models**
   - Create TypeScript interfaces for Problem, Company, and Scenario
   - Define Firestore schema structure
   - **Input for Cursor AI**: "Create TypeScript interfaces and Firestore schema for a coding problem preparation app with three main entities: Problem (id, title, difficulty, description, leetcodeLink), Company (id, name, description, domain), and Scenario (id, problemId, companyId, scenario, createdAt)"
   - **Output**: TypeScript interfaces and Firestore schema definitions
   - **Testing**:
     - Create test file that validates type definitions
     - Write simple TypeScript tests with the interfaces
     - **Verification**: No TypeScript errors when creating model objects

2. **Problem Repository Functionality**
   - Create data import utility for problems
   - Implement problem fetching functions
   - Define 10 selected problems from Blind 75
   - **Input for Cursor AI**: "Create a utility function to import and fetch a curated list of 10 LeetCode problems from the Blind 75 collection into a Firestore database"
   - **Output**: Import utility and problem data JSON
   - **Testing**:
     - Run import function and check Firestore for correct data
     - Fetch a specific problem and verify all fields are present
     - **Verification**: Successfully fetch sample problems from Firestore

3. **Company Data Setup**
   - Create company profiles for 3 major tech companies
   - Implement company data retrieval functions
   - **Input for Cursor AI**: "Create a utility to initialize and retrieve data for 3 major tech companies (Google, Amazon, Microsoft) in Firestore with fields for company description, domain, and core technologies"
   - **Output**: Company data functions and JSON data
   - **Testing**:
     - Verify company data appears correctly in Firestore
     - Fetch a company and check all fields are present
     - **Verification**: View company data in Firebase console and via fetch functions

4. **Basic Authentication Implementation**
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
1. **Implement Monaco Editor**
   - Create code editor component using Monaco Editor
   - Implement basic language support
   - Add settings configuration
   - **Input for Cursor AI**: "Create a React component that integrates Monaco Editor for code editing in a Next.js application, with support for multiple programming languages"
   - **Output**: Monaco Editor integration component
   - **Testing**:
     - Verify editor loads and displays correctly
     - Test basic code editing functionality
     - Check syntax highlighting for basic languages
     - **Verification**: Editor allows code input with proper formatting

2. **Language Selection Implementation**
   - Create language selection dropdown
   - Implement language switching
   - Add initial language configurations
   - **Input for Cursor AI**: "Create a language selection component for a code editor that changes the Monaco Editor's language mode and provides appropriate configurations for JavaScript, Python, and Java"
   - **Output**: Language selection component
   - **Testing**:
     - Test language switching functionality
     - Verify syntax highlighting changes with language
     - Check that configurations are applied correctly
     - **Verification**: Editor properly handles different programming languages

3. **Code Submission Interface & UI Components**
   - Implement code submission function
   - Create submission button component
   - Add loading state handling
   - Implement reusable notification system
   - Create UI feedback components
   - Add form validation utilities
   - **Input for Cursor AI**: "Create a code submission interface with reusable notification, loading, and feedback components that provide consistent user experience across the application"
   - **Output**: Code submission and UI feedback components
   - **Testing**:
     - Test submission button functionality
     - Verify loading state displays correctly
     - Check that code is properly collected from editor
     - Test notifications for success/error states
     - Verify form validation functionality
     - **Verification**: Interface provides comprehensive user feedback

## Day 4: Code Execution & Test Cases

### Manual Setup Tasks
1. **Set Up Serverless Code Execution**
   - Create Next.js API route for code execution
   - Configure execution environment
   - **Verification**: API route responds to test requests

### Coding Tasks (Cursor AI)
1. **Implement Code Execution Function**
   - Create serverless function for code execution
   - Implement language-specific execution logic
   - Add basic security sandboxing
   - **Input for Cursor AI**: "Create a Next.js API route that executes submitted code in JavaScript, Python, and Java, with appropriate security measures and error handling"
   - **Output**: Code execution API implementation
   - **Testing**:
     - Submit test code in different languages
     - Verify execution results are returned
     - Test error handling with invalid code
     - **Verification**: API successfully executes code and returns results

2. **Test Case Implementation**
   - Create test case data model
   - Implement test case execution logic
   - Add results comparison functionality
   - **Input for Cursor AI**: "Create a system to define test cases for coding problems, execute user code against those test cases, and compare the results with expected outputs"
   - **Output**: Test case execution implementation
   - **Testing**:
     - Run test cases with valid solutions
     - Test with incorrect solutions
     - Verify comparison logic works correctly
     - **Verification**: Test cases correctly identify valid and invalid solutions

3. **Results Display Component**
   - Create execution results component
   - Implement test case results display
   - Add runtime and memory usage metrics
   - **Input for Cursor AI**: "Create a React component that displays code execution results, including test case outputs, runtime metrics, and memory usage, with appropriate formatting for both successful and failed cases"
   - **Output**: Results display component
   - **Testing**:
     - Test display with various execution results
     - Verify metrics are displayed correctly
     - Check formatting for different result types
     - **Verification**: Component clearly displays execution results and metrics

## Day 5: AI Integration

### Manual Setup Tasks
1. **Setup OpenAI/Anthropic API Access**
   - Create API account (OpenAI or Anthropic)
   - Generate API keys
   - Store keys securely in Vercel environment variables
   - **Verification**: API key configured in Vercel dashboard

### Coding Tasks (Cursor AI)
1. **Implement AI Service**
   - Create AI service wrapper
   - Implement prompt template for scenario generation
   - Add error handling and retry logic
   - **Input for Cursor AI**: "Create a service that integrates with OpenAI/Anthropic API to transform a coding problem into a company-specific interview scenario, with appropriate error handling and retry mechanisms"
   - **Output**: AI service implementation
   - **Testing**:
     - Test with sample problem and company data
     - Verify scenario generation quality
     - Check error handling functionality
     - **Verification**: Service generates contextual scenarios without errors

2. **Scenario Generation Implementation**
   - Create scenario generation endpoint
   - Implement company-specific context enhancement
   - Add basic caching mechanism
   - **Input for Cursor AI**: "Create a Next.js API route that generates company-specific scenarios for coding problems using AI, with a caching mechanism to avoid redundant generations"
   - **Output**: Scenario generation API endpoint
   - **Testing**:
     - Generate scenarios for different problem-company combinations
     - Verify caching works for repeated requests
     - Test with various problem types
     - **Verification**: Endpoint returns high-quality, company-specific scenarios

3. **Problem Transformation Logic**
   - Implement context extraction from problems
   - Create company background formatter
   - Add scenario quality verification
   - **Input for Cursor AI**: "Create a utility that extracts key information from coding problems and company profiles to enhance AI prompt quality, resulting in more relevant scenario generation"
   - **Output**: Problem transformation utilities
   - **Testing**:
     - Test with various problem types
     - Verify context extraction accuracy
     - Check enhanced prompt quality
     - **Verification**: Utilities improve scenario generation relevance and quality

## Day 6: UI Integration & Core Flow

### Coding Tasks (Cursor AI)
1. **Problem Display Component**
   - Create unified problem display component
   - Integrate coding environment
   - Add scenario display section
   - **Input for Cursor AI**: "Create a comprehensive problem display component that shows the problem details, company-specific scenario, and integrated code editor with test execution capability"
   - **Output**: Unified problem display component
   - **Testing**:
     - Test component with sample problem and scenario
     - Verify all sections display correctly
     - Check interactions between sections
     - **Verification**: Component displays complete problem-solving experience

2. **Company Selection Interface**
   - Create company selection component
   - Implement company information display
   - Add company selection handling
   - **Input for Cursor AI**: "Create a company selection component that allows users to choose a company, displays relevant company information, and triggers scenario generation for the selected problem-company combination"
   - **Output**: Company selection component
   - **Testing**:
     - Test company selection functionality
     - Verify company information displays correctly
     - Check that selection triggers scenario generation
     - **Verification**: Users can select companies and see relevant scenarios

3. **Main Application Flow**
   - Connect all components in main page
   - Implement state management for selected problem/company
   - Add navigation between problems
   - **Input for Cursor AI**: "Create the main page for a coding interview prep application that connects problem selection, company selection, scenario display, and code execution components into a coherent user flow"
   - **Output**: Main application flow implementation
   - **Testing**:
     - Walk through complete flow: select problem → select company → view scenario → write code → execute tests
     - Test flow with different problem-company combinations
     - Check state persistence during navigation
     - **Verification**: Complete application flow works without errors

## Day 7: Testing & MVP Launch

### Coding Tasks (Cursor AI)
1. **Error Handling & Application Shell**
   - Create comprehensive error boundaries
   - Implement user-friendly error messages
   - Add error recovery strategies
   - Create application layout component
   - Implement navigation header and footer
   - Add responsive layout container
   - **Input for Cursor AI**: "Implement a complete application shell with responsive layout, navigation, and comprehensive error handling including error boundaries, user-friendly messages, and recovery mechanisms"
   - **Output**: Application shell and error handling implementation
   - **Testing**:
     - Test layout on various screen sizes
     - Verify navigation functionality
     - Intentionally trigger various errors
     - Verify error messages are user-friendly
     - Check recovery mechanisms work correctly
     - **Verification**: Application provides consistent layout with graceful error handling

2. **Performance Optimization**
   - Implement code splitting
   - Add loading state indicators
   - Optimize component rendering
   - **Input for Cursor AI**: "Optimize a Next.js application's performance by implementing code splitting, efficient loading states, and React component optimizations"
   - **Output**: Performance optimization implementation
   - **Testing**:
     - Measure application load times
     - Test component render performance
     - Check loading state behavior
     - **Verification**: Application demonstrates improved load and interaction performance

3. **Final Integration Testing**
   - Create end-to-end test script
   - Implement critical path verification
   - Add user flow validation
   - **Input for Cursor AI**: "Create a comprehensive testing script for a coding interview preparation application that verifies all critical user flows and functionality"
   - **Output**: Testing script and documentation
   - **Testing**:
     - Execute complete test script
     - Verify all critical paths function correctly
     - Check edge cases and error scenarios
     - **Verification**: Application passes all critical tests

### Manual Testing Tasks
1. **Perform End-to-End Testing**
   - Test full authentication flow
   - Verify problem and company selection
   - Test scenario generation with multiple combinations
   - Test code execution with various solutions
   - **Verification**: All flows work together without errors

2. **Deploy MVP Version**
   - Push code to GitHub
   - Verify Vercel deployment
   - Test application on multiple devices
   - **Verification**: Working application URL from Vercel that functions on mobile and desktop

## Task Tracking Table

| Day | Task | Type | Status | Notes |
|-----|------|------|--------|-------|
| 1 | Create Firebase Project | Manual | Not Started | |
| 1 | Setup Vercel Account | Manual | Not Started | |
| 1 | Setup Development Environment | Manual | Not Started | |
| 1 | Initialize Next.js Project | Coding | Not Started | |
| 1 | Firebase Client Configuration | Coding | Not Started | |
| 2 | Define Data Models | Coding | Not Started | |
| 2 | Problem Repository Functionality | Coding | Not Started | |
| 2 | Company Data Setup | Coding | Not Started | |
| 2 | Basic Authentication Implementation | Coding | Not Started | |
| 3 | Implement Monaco Editor | Coding | Not Started | |
| 3 | Language Selection Implementation | Coding | Not Started | |
| 3 | Code Submission Interface | Coding | Not Started | |
| 4 | Set Up Serverless Code Execution | Manual | Not Started | |
| 4 | Implement Code Execution Function | Coding | Not Started | |
| 4 | Test Case Implementation | Coding | Not Started | |
| 4 | Results Display Component | Coding | Not Started | |
| 5 | Setup OpenAI/Anthropic API Access | Manual | Not Started | |
| 5 | Implement AI Service | Coding | Not Started | |
| 5 | Scenario Generation Implementation | Coding | Not Started | |
| 5 | Problem Transformation Logic | Coding | Not Started | |
| 6 | Problem Display Component | Coding | Not Started | |
| 6 | Company Selection Interface | Coding | Not Started | |
| 6 | Main Application Flow | Coding | Not Started | |
| 7 | Error Handling Implementation | Coding | Not Started | |
| 7 | Performance Optimization | Coding | Not Started | |
| 7 | Final Integration Testing | Coding | Not Started | |
| 7 | Perform End-to-End Testing | Manual | Not Started | |
| 7 | Deploy MVP Version | Manual | Not Started | |