# AlgoIRL: Week 1 Task Breakdown

## Overview
This document outlines the detailed tasks for Week 1 of the AlgoIRL MVP development using Firebase and Vercel. Tasks are organized by day and separated into manual setup tasks and implementable coding tasks suitable for Cursor AI assistance.

## Day 1: Project Initialization and Environment Setup

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
     - Intentionally introduce a TypeScript error and verify it's caught
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

## Day 2: Authentication and Basic Layout

### Coding Tasks (Cursor AI)
1. **Implement Basic Authentication**
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

2. **Create Basic Application Layout**
   - Implement header with navigation
   - Create responsive layout structure
   - Add minimal styling using CSS or Tailwind
   - **Input for Cursor AI**: "Create a basic responsive application layout for a Next.js app with a header, navigation menu, and main content area using Tailwind CSS"
   - **Output**: Layout components with styling
   - **Testing**:
     - Test responsiveness by resizing browser window
     - Check layout on mobile using browser dev tools
     - Verify navigation links work correctly
     - **Verification**: Layout correctly adapts to different screen sizes

## Day 3-4: Data Model and Repository

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
   - Define 20 selected problems from Blind 75
   - **Input for Cursor AI**: "Create a utility function to import and fetch a curated list of 20 LeetCode problems from the Blind 75 collection into a Firestore database"
   - **Output**: Import utility and problem data JSON
   - **Testing**:
     - Run import function and check Firestore for correct data
     - Fetch a specific problem and verify all fields are present
     - **Verification**: Successfully fetch sample problems from Firestore

3. **Company Data Setup**
   - Create company profiles for 5 major tech companies
   - Implement company data retrieval functions
   - **Input for Cursor AI**: "Create a utility to initialize and retrieve data for 5 major tech companies (Meta, Google, Amazon, Microsoft, Apple) in Firestore with fields for company description, domain, and core technologies"
   - **Output**: Company data functions and JSON data
   - **Testing**:
     - Verify company data appears correctly in Firestore
     - Fetch a company and check all fields are present
     - **Verification**: View company data in Firebase console and via fetch functions

## Day 5: API Integration and Routes

### Manual Setup Tasks
1. **Setup OpenAI/Anthropic API Access**
   - Create API account (OpenAI or Anthropic)
   - Generate API keys
   - Store keys securely in Vercel environment variables
   - **Verification**: API key configured in Vercel dashboard

### Coding Tasks (Cursor AI)
1. **API Route Implementation**
   - Create API routes for problem fetching
   - Create API routes for company fetching
   - Implement scenario generation endpoint
   - **Input for Cursor AI**: "Create Next.js API routes for a coding problem app that allows: 1) fetching problems by ID, 2) fetching companies by ID, and 3) generating a scenario by sending a problem ID and company ID"
   - **Output**: API route files with handlers
   - **Testing**:
     - Use browser or Postman to call each API endpoint
     - Test with valid and invalid parameters
     - Create simple test script that calls all endpoints
     - **Verification**: Endpoints return expected JSON responses

2. **AI Integration Setup**
   - Implement AI service wrapper
   - Create prompt template for scenario generation
   - Add basic error handling
   - **Input for Cursor AI**: "Create a service that integrates with OpenAI/Anthropic API to transform a coding problem into a company-specific interview scenario. The service should accept a problem description and company information and return a contextual scenario"
   - **Output**: AI service module with prompt template
   - **Testing**:
     - Create test page that calls the AI service with sample inputs
     - Test with different problem/company combinations
     - Verify response format and content quality
     - **Verification**: AI service returns contextual scenarios without errors

## Day 6: Core UI Components

### Coding Tasks (Cursor AI)
1. **Problem Selection Component**
   - Create problem list component
   - Implement problem card component
   - Add minimal filtering capability
   - **Input for Cursor AI**: "Create React components for displaying and selecting from a list of coding problems, with each problem showing title, difficulty, and category"
   - **Output**: Problem selection components
   - **Testing**:
     - Render component with test data
     - Verify problems display correctly in the list
     - Test selection and filtering functionality
     - **Verification**: Problems display correctly and can be selected

2. **Company Selection Component**
   - Create company selection dropdown
   - Implement company information display
   - **Input for Cursor AI**: "Create a company selection dropdown component that displays information about the selected company once chosen"
   - **Output**: Company selection components
   - **Testing**:
     - Test dropdown functionality with sample data
     - Verify company information displays when selected
     - Test edge cases (no selection, multiple selections)
     - **Verification**: Companies display in dropdown and can be selected

3. **Scenario Display Component**
   - Create scenario display component
   - Add loading state handling
   - Implement basic error handling
   - **Input for Cursor AI**: "Create a component to display an AI-generated interview scenario with loading states and error handling, plus a button to regenerate the scenario if needed"
   - **Output**: Scenario display component
   - **Testing**:
     - Test with sample scenario data
     - Simulate loading states with setTimeout
     - Trigger error states to verify error handling
     - Test regenerate functionality
     - **Verification**: Component handles loading, errors, and content display correctly

## Day 7: Integration and Testing

### Coding Tasks (Cursor AI)
1. **Implement Main Application Flow**
   - Connect all components in main page
   - Add state management for selected problem/company
   - Implement scenario generation flow
   - **Input for Cursor AI**: "Create the main page for a coding interview prep application that allows users to select a problem, choose a company, and then displays a company-specific scenario for that problem"
   - **Output**: Main page implementation with flow between components
   - **Testing**:
     - Walk through complete flow: select problem → select company → generate scenario
     - Test flow with different problem/company combinations
     - **Verification**: Complete application flow works without errors

2. **Create Basic Caching Mechanism**
   - Implement simple caching in Firestore
   - Add cache lookup before generation
   - **Input for Cursor AI**: "Implement a simple caching mechanism that stores generated scenarios in Firestore and checks for existing scenarios before generating new ones"
   - **Output**: Caching implementation code
   - **Testing**:
     - Generate a scenario, then request the same scenario again
     - Verify second request uses cached data (should be faster)
     - Check Firestore for stored scenarios
     - **Verification**: Second generation of same scenario uses cache and is faster

3. **Add Basic Error Handling**
   - Implement error boundary
   - Add user-friendly error messages
   - **Input for Cursor AI**: "Add comprehensive error handling to a Next.js application, including error boundaries and user-friendly error messages"
   - **Output**: Error handling components and utilities
   - **Testing**:
     - Intentionally break API calls to trigger errors
     - Test offline scenarios by disabling network
     - Verify error messages are user-friendly
     - **Verification**: Application displays appropriate error messages in all test cases

### Manual Testing Tasks
1. **Perform End-to-End Testing**
   - Test full authentication flow
   - Verify problem and company selection
   - Test scenario generation with multiple combinations
   - Verify caching works across sessions
   - **Verification**: All flows work together without errors

2. **Deploy Test Version**
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
| 2 | Implement Basic Authentication | Coding | Not Started | |
| 2 | Create Basic Application Layout | Coding | Not Started | |
| 3-4 | Define Data Models | Coding | Not Started | |
| 3-4 | Problem Repository Functionality | Coding | Not Started | |
| 3-4 | Company Data Setup | Coding | Not Started | |
| 5 | Setup OpenAI/Anthropic API Access | Manual | Not Started | |
| 5 | API Route Implementation | Coding | Not Started | |
| 5 | AI Integration Setup | Coding | Not Started | |
| 6 | Problem Selection Component | Coding | Not Started | |
| 6 | Company Selection Component | Coding | Not Started | |
| 6 | Scenario Display Component | Coding | Not Started | |
| 7 | Implement Main Application Flow | Coding | Not Started | |
| 7 | Create Basic Caching Mechanism | Coding | Not Started | |
| 7 | Add Basic Error Handling | Coding | Not Started | |
| 7 | Perform End-to-End Testing | Manual | Not Started | |
| 7 | Deploy Test Version | Manual | Not Started | |

## Additional Test Files (Optional)

You could ask Cursor AI to generate simple test files for key functionality:

1. **Authentication Tests**
   - Input: "Create a simple Jest test file for Firebase authentication in a Next.js app"

2. **API Route Tests**
   - Input: "Create a test file that validates the scenario generation API endpoint using Jest"

3. **Component Tests**
   - Input: "Create React Testing Library tests for the problem selection and company selection components"
