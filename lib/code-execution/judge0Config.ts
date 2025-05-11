import { SupportedLanguage } from './codeExecutionConfig';

interface Judge0LanguageConfig {
  id: number;
  name: string;
}

interface Judge0Config {
  apiUrl: string;
  apiKey: string;
  callbackUrl?: string;
  languages: Record<SupportedLanguage, Judge0LanguageConfig>;
}

const config: Judge0Config = {
  apiUrl: process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com',
  apiKey: process.env.JUDGE0_API_KEY || '',
  callbackUrl: process.env.JUDGE0_CALLBACK_URL,
  languages: {
    javascript: { id: 63, name: 'JavaScript (Node.js 12.14.0)' },
    typescript: { id: 74, name: 'TypeScript (3.7.4)' },
    python: { id: 71, name: 'Python (3.8.1)' },
    java: { id: 62, name: 'Java (OpenJDK 13.0.1)' },
    csharp: { id: 51, name: 'C# (Mono 6.6.0.161)' },
    cpp: { id: 54, name: 'C++ (GCC 9.2.0)' },
    go: { id: 60, name: 'Go (1.13.5)' }
  }
};

export default config; 