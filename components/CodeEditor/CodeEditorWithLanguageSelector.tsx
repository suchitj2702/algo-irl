'use client';

import { useState } from 'react';
import { CodeEditor } from './index';
import { LanguageSelector } from './index';
import type { UserPreferences } from '../../types/entities';

const DEFAULT_CODE_TEMPLATES: Record<string, string> = {
  javascript: `// Two Sum Problem
// Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.

function solution(nums, target) {
  // Your solution here
  // Example: return [0, 1] if nums[0] + nums[1] equals target
  
  return [];
}
`,
  typescript: `// Two Sum Problem
// Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.

function solution(nums: number[], target: number): number[] {
  // Your solution here
  // Example: return [0, 1] if nums[0] + nums[1] equals target
  
  return [];
}
`,
  python: `# Two Sum Problem
# Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.

def solution(nums, target):
    # Your solution here
    # Example: return [0, 1] if nums[0] + nums[1] equals target
    
    return []
`,
  java: `// Two Sum Problem
// Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.

class Solution {
    public int[] solution(int[] nums, int target) {
        // Your solution here
        // Example: return new int[]{0, 1} if nums[0] + nums[1] equals target
        
        return new int[0];
    }
}
`,
  csharp: `// Two Sum Problem
// Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.

public class Solution {
    public int[] Solution(int[] nums, int target) {
        // Your solution here
        // Example: return new int[]{0, 1} if nums[0] + nums[1] equals target
        
        return new int[0];
    }
}
`,
  cpp: `// Two Sum Problem
// Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.

class Solution {
public:
    vector<int> solution(vector<int>& nums, int target) {
        // Your solution here
        // Example: return {0, 1} if nums[0] + nums[1] equals target
        
        return {};
    }
};
`,
  go: `// Two Sum Problem
// Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.

func solution(nums []int, target int) []int {
    // Your solution here
    // Example: return []int{0, 1} if nums[0] + nums[1] equals target
    
    return []int{}
}
`,
};

interface CodeEditorWithLanguageSelectorProps {
  initialCode?: string;
  initialLanguage?: string;
  onChange?: (code: string, language: string) => void;
  height?: string;
  width?: string;
  preferences?: Partial<UserPreferences>;
}

export default function CodeEditorWithLanguageSelector({
  initialCode = '',
  initialLanguage = 'javascript',
  onChange,
  height,
  width,
  preferences,
}: CodeEditorWithLanguageSelectorProps) {
  const [language, setLanguage] = useState(initialLanguage);
  const [code, setCode] = useState(initialCode || DEFAULT_CODE_TEMPLATES[initialLanguage] || '');

  // Update code when language changes
  const handleLanguageChange = (newLanguage: string) => {
    // If code is either empty or matches one of the templates, replace it with new template
    const isUsingTemplate = 
      code === '' || 
      Object.values(DEFAULT_CODE_TEMPLATES).includes(code) || 
      code === DEFAULT_CODE_TEMPLATES[language];
    
    // Set the new code template if appropriate
    const newCode = isUsingTemplate ? DEFAULT_CODE_TEMPLATES[newLanguage] || '' : code;
    
    setLanguage(newLanguage);
    setCode(newCode);
    
    if (onChange) {
      onChange(newCode, newLanguage);
    }
  };

  // Handle code changes
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (onChange) {
      onChange(newCode, language);
    }
  };

  return (
    <div className="code-editor-with-selector">
      <div className="mb-2">
        <LanguageSelector
          selectedLanguage={language}
          onLanguageChange={handleLanguageChange}
          className="w-48"
        />
      </div>
      <CodeEditor
        code={code}
        language={language}
        onChange={handleCodeChange}
        height={height}
        width={width}
        preferences={preferences}
      />
    </div>
  );
} 