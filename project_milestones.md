# AlgoIRL: Project Milestones (4-Week Plan)

## Week 1: Rapid MVP Development
**Timeline**: Days 1-7

### Description
Hyper-focused development of the essential MVP with coding environment in just one week.

### Daily Tasks

#### Day 1: Project Setup & Infrastructure
- ✅ Initialize Git repository with minimal structure
- ✅ Set up Firebase project with Authentication and Firestore
- ✅ Configure Vercel deployment
- ✅ Create Next.js application scaffold
- ✅ Implement initial Firestore schema

#### Day 2: Problem Repository & Data Foundation
- ✅ Create smart problem import utility that only requires LeetCode URLs
   - ✅ Implement `extractSlugFromUrl` for LeetCode URL parsing
   - ✅ Set up Firestore converter (`problemConverter`) for proper data handling
   - ✅ Add `leetcode-query` library integration for fetching problem data
   - ✅ Create `fetchAndImportProblemByUrl` for individual problem imports
   - ✅ Build `importProblemsFromUrls` with rate limiting for batch imports
- ✅ Import 10 curated problems from Blind 75
- ✅ Create data for 3 major tech companies
- ✅ Set up basic API routes for data retrieval
   - ✅ Implement `POST /api/import-problem` for individual problem imports
   - ✅ Implement `POST /api/import-problems` for batch imports
   - ✅ Create Postman collection for API testing
- ✅ Implement minimal authentication flow

#### Day 3: Coding Environment Basic Implementation
- Integrate Monaco Editor component
- Implement language selection
- Create basic code submission interface
- Set up initial serverless function for code execution

#### Day 4: Code Execution & Test Cases
- Implement test case validation logic
- Add execution results display
- Create runtime/memory usage tracking
- Build basic test feedback system

#### Day 5: AI Integration
- Integrate with OpenAI/Anthropic API
- Implement scenario generation prompts
- Create simple caching mechanism
- Build problem-to-scenario transformation

#### Day 6: UI Integration & Core Flow
- Implement unified problem display with coding environment
- Create company selection interface
- Build scenario display component
- Connect all components in main user flow

#### Day 7: Testing & MVP Launch
- Fix critical bugs and issues
- Implement minimal error handling
- Test end-to-end user flow
- Deploy MVP to production

### Deliverables
- Functional MVP with 10 curated problems
- Working code editor with execution capability
- Basic company-specific scenario generation
- Essential user authentication
- End-to-end user flow for problem solving

## Week 2: Feature Enhancement & Content Expansion
**Timeline**: Days 8-14

### Description
Expand content and enhance core features based on initial MVP feedback.

### Focus Areas
1. **Content Expansion**
   - Add 20 more problems from Blind 75
   - Increase to 8 major tech companies
   - Improve problem categorization
   - Enhance test cases for all problems

2. **Coding Environment Improvements**
   - Add syntax highlighting for more languages
   - Implement code auto-save functionality
   - Create custom test case input
   - Enhance execution results display

3. **User Experience Enhancements**
   - Implement responsive design improvements
   - Add basic user profile and history
   - Create simple favorites functionality
   - Implement basic progress tracking

4. **Performance Optimization**
   - Improve scenario generation caching
   - Optimize code execution functions
   - Enhance loading states and feedback
   - Implement basic error recovery

### Deliverables
- Expanded problem repository (30 problems)
- Enhanced coding environment functionality
- Basic user profile and history features
- Improved overall performance and reliability

## Week 3: Mock Interview Chatbot
**Timeline**: Days 15-21

### Description
Implement AI-powered mock interview functionality with realistic conversation flow.

### Focus Areas
1. **Mock Interviewer Implementation**
   - Create interview conversation model
   - Implement problem-specific questions
   - Develop follow-up question generation
   - Build conversational state management

2. **Solution Evaluation System**
   - Implement code quality assessment
   - Create approach evaluation logic
   - Add complexity analysis feedback
   - Develop improvement suggestions

3. **Interview Experience**
   - Build interview chat interface
   - Create interviewer persona options
   - Implement difficulty level selection
   - Add interview session management

4. **Performance Tracking**
   - Create interview history storage
   - Implement performance metrics
   - Add progress visualization
   - Build strengths/weaknesses analysis

### Deliverables
- Fully functional mock interview chatbot
- Solution evaluation and feedback system
- Interactive interview experience
- Performance tracking and analytics

## Week 4: Polish, Optimization & Launch
**Timeline**: Days 22-28

### Description
Final refinement, optimization, and preparation for public launch.

### Focus Areas
1. **Testing & Bug Fixing**
   - Perform comprehensive testing
   - Fix all critical and major bugs
   - Implement advanced error handling
   - Conduct performance testing

2. **Content Finalization**
   - Expand to 40 total problems
   - Add 2 more companies (10 total)
   - Create curated problem collections
   - Optimize all AI prompts

3. **Analytics & Monitoring**
   - Implement user activity tracking
   - Add performance monitoring
   - Create basic admin dashboard
   - Set up alerting for critical issues

4. **Launch Preparation**
   - Create user documentation
   - Implement onboarding flow
   - Prepare marketing materials
   - Deploy final version to production

### Deliverables
- Production-ready application
- Comprehensive problem repository
- Complete mock interview system
- Analytics and monitoring infrastructure
- User documentation and onboarding

## Success Metrics

### MVP Success Metrics (Week 1)
- MVP released within 7-day timeframe
- Core functionality working (problem transformation + coding environment)
- Working code execution for at least 3 languages
- At least 10 problems implemented
- Support for 3 major tech companies

### Final Success Metrics (Week 4)
- 40 quality problems from Blind 75 collection
- Support for 10 tech companies
- Fully functional mock interview system
- Comprehensive user experience
- Stable and performant application