// Defines language-specific driver templates and configurations for Judge0.
import judge0Config from './judge0Config';

// Simple local type, assuming Judge0Language from data-types might not be available or is structured differently.
interface Judge0LanguageInfo {
  id: number;
  name: string; // Or other relevant properties from judge0Config.languages.* values
}

export const USER_CODE_PLACEHOLDER = '// {{USER_CODE_PLACEHOLDER}}';
export const USER_CODE_PLACEHOLDER_PYTHON = '# {{USER_CODE_PLACEHOLDER}}';

export interface LanguageDriver {
  languageId: number;
  driverTemplate: string;
  userCodePlaceholder: string;
}

const JAVASCRIPT_DRIVER_TEMPLATE = `
${USER_CODE_PLACEHOLDER}

async function main() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  let SCRIPT_INPUT = "";
  for await (const line of readline) {
    SCRIPT_INPUT += line;
  }

  try {
    const inputData = JSON.parse(SCRIPT_INPUT);
    let result;

    if (typeof solution !== 'function') {
      // Output error to stderr for Judge0 to capture
      console.error("Error: 'solution' function not found or not a function.");
      process.exit(1);
    }

    // Determine how to call the solution function based on inputData type
    if (Array.isArray(inputData)) {
      result = solution(...inputData); // Spread if inputData is an array (for multiple args)
    } else {
      result = solution(inputData); // Pass as a single argument otherwise (for single object/primitive)
    }
    
    // Handle promises returned by async solution functions
    if (result instanceof Promise) {
        result = await result;
    }

    // Output result to stdout for Judge0
    process.stdout.write(JSON.stringify(result !== undefined ? result : null));
  } catch (e) {
    // Output error details to stderr for Judge0
    if (e instanceof Error) {
        console.error(\`Execution Error: \${e.message}\`);
        if (e.stack) {
            console.error(e.stack);
        }
    } else {
        console.error("An unknown error occurred during execution.");
    }
    process.exit(1); // Indicate failure to Judge0
  }
}

// Execute the main function and catch any unhandled promise rejections from main itself
main().catch(err => {
    if (err instanceof Error) {
        console.error(\`Unhandled Rejection in main: \${err.message}\`);
        if (err.stack) {
            console.error(err.stack);
        }
    } else {
        console.error("An unknown error occurred in main async function.");
    }
    process.exit(1);
});
`;

const PYTHON_DRIVER_TEMPLATE = `
import sys
import json
import traceback

${USER_CODE_PLACEHOLDER_PYTHON}

def main():
    input_str = sys.stdin.read()
    try:
        input_data = json.loads(input_str)
        
        if 'solution' not in globals() or not callable(globals()['solution']):
            sys.stderr.write("Error: 'solution' function not found or not callable.\\n")
            sys.exit(1)
        # Determine how to call the solution function based on input_data type
        
        if isinstance(input_data, dict):
            actual_output = solution(**input_data)  # Unpack if dict (for keyword args)
        elif isinstance(input_data, list):
            actual_output = solution(*input_data)   # Unpack if list (for positional args)
        else:
            actual_output = solution(input_data)    # Pass as a single argument otherwise
        
        sys.stdout.write(json.dumps(actual_output, separators=(',', ':')))

    except Exception as e:
        error_message = "Execution Error: " + str(e) + "\\n" + traceback.format_exc()
        sys.stderr.write(error_message)
        sys.exit(1)

if __name__ == '__main__':
    main()
`;

// Use Record<string, LanguageDriver> for type safety
export const languageDrivers: Record<string, LanguageDriver | undefined> = {
  javascript: {
    languageId: judge0Config.languages.javascript.id,
    driverTemplate: JAVASCRIPT_DRIVER_TEMPLATE,
    userCodePlaceholder: USER_CODE_PLACEHOLDER,
  },
  python: {
    languageId: judge0Config.languages.python.id,
    driverTemplate: PYTHON_DRIVER_TEMPLATE,
    userCodePlaceholder: USER_CODE_PLACEHOLDER_PYTHON,
  }
};

export function getLanguageId(language: string): number {
  const langConfig = judge0Config.languages[language as keyof typeof judge0Config.languages];
  if (!langConfig || typeof langConfig.id === 'undefined') {
    throw new Error(`Unsupported language or ID not configured in judge0Config: ${language}`);
  }
  return langConfig.id;
}

export function getDriverDetails(language: string): LanguageDriver {
  const driver = languageDrivers[language];
  if (!driver) {
    throw new Error(`No driver template found for language: ${language}. Supported: ${Object.keys(languageDrivers).join(', ')}`);
  }
  return driver;
} 