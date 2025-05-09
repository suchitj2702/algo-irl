'use client';

import { useState, useRef, useEffect } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import type { UserPreferences } from '../../data-types/user';

// Define the available languages and their labels
export const SUPPORTED_LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'csharp', label: 'C#' },
  { id: 'cpp', label: 'C++' },
  { id: 'go', label: 'Go' },
];

// Define default editor options
const DEFAULT_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  lineNumbers: 'on' as const,
  roundedSelection: false,
  wordWrap: 'on',
  folding: true,
  fontSize: 14,
  tabSize: 2,
};

// Define available themes
export const EDITOR_THEMES = [
  { id: 'vs', label: 'Light' },
  { id: 'vs-dark', label: 'Dark' },
  { id: 'hc-black', label: 'High Contrast Dark' },
  { id: 'hc-light', label: 'High Contrast Light' },
];

export interface CodeEditorProps {
  code: string;
  language: string;
  onChange: (value: string) => void;
  height?: string;
  width?: string;
  preferences?: Partial<UserPreferences>;
}

export default function CodeEditor({
  code,
  language,
  onChange,
  height = '70vh',
  width = '100%',
  preferences,
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Configure editor options based on user preferences
  const editorOptions = {
    ...DEFAULT_OPTIONS,
    fontSize: preferences?.fontSize || DEFAULT_OPTIONS.fontSize,
    tabSize: preferences?.tabSize || DEFAULT_OPTIONS.tabSize,
    lineNumbers: preferences?.showLineNumbers ? 'on' as const : 'off' as const,
  };

  // Handle editor initialization
  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setIsEditorReady(true);
  };

  // Get selected language
  const selectedLanguage = SUPPORTED_LANGUAGES.find(lang => lang.id === language) 
    || SUPPORTED_LANGUAGES[0];

  // Handle editor theme
  const theme = preferences?.codeEditorTheme || 'vs-dark';

  return (
    <div className="code-editor-container">
      <Editor
        height={height}
        width={width}
        language={selectedLanguage.id}
        value={code}
        onChange={(value) => onChange(value || '')}
        onMount={handleEditorDidMount}
        options={editorOptions}
        theme={theme}
        loading={<div className="editor-loading">Loading editor...</div>}
      />
    </div>
  );
} 