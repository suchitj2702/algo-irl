// Alternative sandboxing using Node.js built-in vm module
const vm = require('vm');

/**
 * Executes code in a Node.js vm context
 * 
 * @param {string} code - Code to execute
 * @param {Object} options - Sandbox options
 * @returns {Object} Execution result and metrics
 */
function executeInNodeVm(code, options = {}) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  // Set up output capture
  const output = [];
  
  // Create a sandbox with limited capabilities
  const sandbox = {
    console: {
      log: (...args) => {
        console.log(...args);
        output.push(args.map(String).join(' '));
      },
      error: (...args) => {
        console.error(...args);
        output.push(`ERROR: ${args.map(String).join(' ')}`);
      },
      warn: (...args) => {
        console.warn(...args);
        output.push(`WARN: ${args.map(String).join(' ')}`);
      },
      time: (label) => console.time(String(label)),
      timeEnd: (label) => console.timeEnd(String(label))
    },
    setTimeout: () => {}, // No-op
    setInterval: () => {}, // No-op
    clearTimeout: () => {}, // No-op
    clearInterval: () => {}, // No-op
    ...options.sandbox
  };
  
  // Add special function to capture results
  sandbox.__printResult = (data) => {
    if (typeof data === 'string') {
      output.push(data);
    } else {
      try {
        output.push(JSON.stringify(data));
      } catch (e) {
        output.push(String(data));
      }
    }
  };
  
  // Create context
  const context = vm.createContext(sandbox);
  
  // Set timeout for script execution
  const timeout = options.timeout || 5000;
  
  try {
    // Wrap the code to handle errors and safely return results
    const wrappedCode = `
      try {
        ${code}
        
        // If the code has 'results' exposed, output it
        if (typeof results !== 'undefined') {
          // Make sure we stringify it to get proper JSON
          console.log(JSON.stringify(results));
        }
      } catch (err) {
        console.error('Execution error:', err.message);
        console.log(JSON.stringify({
          passed: false,
          testCasesPassed: 0,
          testCasesTotal: 0,
          error: err.message
        }));
      }
    `;
    
    // Execute the script with timeout
    vm.runInContext(wrappedCode, context, {
      timeout: timeout,
      filename: 'script.js',
      displayErrors: true
    });
    
    // If no JSON results were found in output, provide a fallback
    const hasJsonOutput = output.some(line => 
      (line.trim().startsWith('{') && line.trim().endsWith('}')) ||
      (line.trim().startsWith('[') && line.trim().endsWith(']'))
    );
    
    if (!hasJsonOutput) {
      // Add a default JSON result if none was output
      output.push(JSON.stringify({
        passed: false,
        testCasesPassed: 0,
        testCasesTotal: 0,
        error: 'No valid result was produced from code execution'
      }));
    }
    
    // Calculate execution metrics
    const executionTime = Date.now() - startTime;
    const memoryUsage = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024; // in MB
    
    return {
      output: output.join('\n'),
      error: null,
      metrics: {
        executionTime,
        memoryUsage
      }
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const memoryUsage = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024;
    
    // Handle timeout or other errors
    const errorMessage = error.message || 'Unknown error during execution';
    console.error('VM execution error:', errorMessage);
    
    // Ensure we have a JSON output
    output.push(JSON.stringify({
      passed: false,
      testCasesPassed: 0,
      testCasesTotal: 0,
      error: errorMessage
    }));
    
    return {
      output: output.join('\n'),
      error: errorMessage,
      metrics: {
        executionTime,
        memoryUsage
      }
    };
  }
}

module.exports = {
  executeInNodeVm
}; 