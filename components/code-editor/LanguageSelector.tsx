'use client';

import { useState } from 'react';
import { SUPPORTED_LANGUAGES } from './CodeEditor';

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (languageId: string) => void;
  className?: string;
}

export default function LanguageSelector({
  selectedLanguage,
  onLanguageChange,
  className = '',
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Find the currently selected language
  const currentLanguage = SUPPORTED_LANGUAGES.find(
    (lang) => lang.id === selectedLanguage
  ) || SUPPORTED_LANGUAGES[0];

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleLanguageSelect = (languageId: string) => {
    onLanguageChange(languageId);
    setIsOpen(false);
  };

  return (
    <div className={`language-selector relative ${className}`}>
      <button
        type="button"
        className="flex items-center justify-between w-full px-4 py-2 text-sm border rounded-md shadow-sm focus:outline-none"
        onClick={toggleDropdown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{currentLanguage.label}</span>
        <svg
          className="w-5 h-5 ml-2 -mr-1"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg">
          <ul
            className="py-1 overflow-auto text-sm max-h-56"
            role="listbox"
            aria-labelledby="language-selector"
          >
            {SUPPORTED_LANGUAGES.map((language) => (
              <li
                key={language.id}
                className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                  language.id === selectedLanguage ? 'bg-blue-100' : ''
                }`}
                onClick={() => handleLanguageSelect(language.id)}
                role="option"
                aria-selected={language.id === selectedLanguage}
              >
                {language.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 