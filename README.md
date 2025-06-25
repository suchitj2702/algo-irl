# Algo IRL - Algorithm In Real Life

Transform coding interview problems into real-world scenarios tailored to specific companies. Practice algorithms in contexts that mirror actual work environments.

## ✨ Key Features

- **🎯 Company-Specific Problem Transformation** - Converts LeetCode-style problems into real-world scenarios based on company domains
- **⚡ Real-time Code Execution** - Execute code with multiple test cases using Judge0 API
- **🤖 AI-Powered Transformations** - Leverages Anthropic Claude, OpenAI GPT, and Google Gemini for intelligent problem adaptation
- **💻 Multi-Language Support** - Currently supports JavaScript and Python with extensible architecture
- **📚 Blind 75 Problems** - Access to curated Blind 75 algorithm problems
- **🔒 Enterprise-Grade Security** - Rate limiting, CORS protection, input sanitization, and request signing
- **🚀 High Performance** - Built on Next.js 15 with React 19 for optimal performance
- **☁️ Scalable Architecture** - Firebase/Firestore backend with serverless API routes

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - Latest React with server components
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **Monaco Editor** - VS Code-powered code editor

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Firebase Admin SDK** - Server-side Firebase operations
- **Firestore** - NoSQL database for problems and companies
- **Judge0 CE API** - Code execution engine

### AI Integrations
- **Anthropic Claude** - Advanced problem transformation
- **OpenAI GPT** - Alternative AI transformation
- **Google Gemini** - Additional AI capabilities

### Infrastructure
- **Vercel** - Deployment and hosting
- **Firebase** - Authentication and database
- **RapidAPI** - Judge0 API access

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/algo-irl.git
   cd algo-irl
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.example .env.local
   ```

4. **Configure Firebase**
   - Create a Firebase project
   - Download service account key
   - Place as `service-account-key.json` in root (git-ignored)

5. **Run development server**
   ```bash
   npm run dev
   ```

6. **Open application**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Environment Variables

Create a `.env.local` file with the following variables:

```env
# Judge0 Configuration
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your_judge0_api_key
JUDGE0_CALLBACK_URL=https://yourdomain.com/api/execute-code/judge0-callback

# AI Services
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id

# Firebase Admin (choose one method)
# Method 1: Environment variable with service account JSON
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
# Method 2: Google Application Default Credentials
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
# Method 3: Place service-account-key.json in project root
```

## 📸 Screenshots

<details>
<summary>Click to view screenshots</summary>

### Problem Transformation
![Problem Transformation](screenshots/problem-transformation.png)
*Transform LeetCode problems into company-specific scenarios*

### Code Editor
![Code Editor](screenshots/code-editor.png)
*Monaco-powered code editor with syntax highlighting*

### Test Results
![Test Results](screenshots/test-results.png)
*Real-time test case execution and results*

### Company Selection
![Company Selection](screenshots/company-selection.png)
*Choose from various tech companies or add custom ones*

</details>

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
   ```bash
   git fork https://github.com/yourusername/algo-irl.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```

4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```

5. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

### Code Style

- Use ESLint configuration provided
- Follow existing code patterns
- Comment complex logic
- Keep functions focused and small

## 📄 License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2024 Algo IRL

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 💡 Future Enhancements
- [ ] Customized company specific practice tracks
- [ ] Support for more programming languages (Java, C++, Go)
- [ ] User authentication and progress tracking
- [ ] Problem difficulty recommendations
- [ ] Interview simulation mode
- [ ] Code optimization suggestions
- [ ] Collaborative coding sessions

## 🙏 Acknowledgments

- [Judge0](https://judge0.com/) for the code execution engine
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the code editor
- [Firebase](https://firebase.google.com/) for backend infrastructure
- [Vercel](https://vercel.com/) for hosting and deployment

---