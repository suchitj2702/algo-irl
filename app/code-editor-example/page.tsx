'use client';

import { useState } from 'react';
import { CodeEditorWithLanguageSelector } from '../../components/CodeEditor';

export default function CodeEditorExample() {
  const [codeState, setCodeState] = useState({
    code: '',
    language: 'javascript',
  });

  const handleCodeChange = (code: string, language: string) => {
    setCodeState({ code, language });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Monaco Editor Example</h1>
      
      <div className="bg-white shadow-md rounded-lg p-4 mb-4">
        <CodeEditorWithLanguageSelector
          initialLanguage="javascript"
          onChange={handleCodeChange}
          height="60vh"
        />
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-2">Current State</h2>
        <div className="bg-gray-100 p-4 rounded overflow-auto max-h-40">
          <p><strong>Language:</strong> {codeState.language}</p>
          <pre className="mt-2 overflow-auto">
            <code>
              {codeState.code}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
} 