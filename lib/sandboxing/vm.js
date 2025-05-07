// Secure code execution sandbox using isolated-vm
const ivm = require('isolated-vm');

/**
 * Creates a secure isolated-vm sandbox for code execution
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Execution timeout in ms
 * @param {Object} options.sandbox - Context objects to pass to the sandbox
 * @returns {Object} A configured isolated-vm isolate and context
 */
async function createSandbox(options = {}) {
  const {
    timeout = 5000,
    sandbox = {}
  } = options;
  
  // Create a new isolate limited to 128MB
  const isolate = new ivm.Isolate({ memoryLimit: 128 });
  
  // Create a new context within the isolate
  const context = await isolate.createContext();
  
  // Create a jail
  const jail = context.global;
  
  // Set up a console that captures output
  const output = [];
  await jail.set('console', {
    log: new ivm.Reference((...args) => {
      const stringArgs = args.map(String);
      output.push(stringArgs.join(' '));
      console.log.apply(console, stringArgs);
    }),
    error: new ivm.Reference((...args) => {
      const stringArgs = args.map(String);
      output.push(`ERROR: ${stringArgs.join(' ')}`);
      console.error.apply(console, stringArgs);
    }),
    warn: new ivm.Reference((...args) => {
      const stringArgs = args.map(String);
      output.push(`WARN: ${stringArgs.join(' ')}`);
      console.warn.apply(console, stringArgs);
    }),
    time: new ivm.Reference((label) => {
      console.time(String(label));
    }),
    timeEnd: new ivm.Reference((label) => {
      console.timeEnd(String(label));
    })
  });
  
  // Add special function to handle JSON strings
  await jail.set('__printResult', new ivm.Reference((data) => {
    if (typeof data === 'string') {
      output.push(data);
    } else {
      output.push(String(data));
    }
  }));
  
  // Add any custom sandbox properties
  for (const [key, value] of Object.entries(sandbox)) {
    try {
      // Make sure each value is safe to transfer
      const safeValue = typeof value === 'function' 
        ? new ivm.Reference(value)
        : value;
      await jail.set(key, safeValue);
    } catch (err) {
      console.error(`Failed to set sandbox property ${key}:`, err.message);
      // Skip this property rather than failing
    }
  }
  
  return { isolate, context, jail, output };
}

/**
 * Executes code within an isolated-vm sandbox
 * 
 * @param {string} code - Code to execute
 * @param {Object} options - Sandbox options
 * @returns {Object} Result and metrics
 */
async function executeInSandbox(code, options = {}) {
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = Date.now();
  let result = null;
  let error = null;
  
  try {
    // Create the sandbox environment
    const { isolate, context, output } = await createSandbox(options);
    
    // Wrap code with a safe execution and proper JSON stringify for complex objects
    const wrappedCode = `
      try {
        // Helper function to safely serialize non-transferable objects
        function safeStringify(obj) {
          if (obj === undefined) return 'undefined';
          if (obj === null) return 'null';
          
          // Handle special objects that might cause transfer issues
          if (typeof obj === 'function') return '"[Function]"';
          if (obj instanceof Error) return '"' + obj.message + '"';
          
          try {
            // Handle circular references
            const seen = new WeakSet();
            return JSON.stringify(obj, (key, value) => {
              // Handle non-transferable values
              if (typeof value === 'function') return '[Function]';
              if (value instanceof Error) return value.message;
              if (value === undefined) return 'undefined';
              
              // Handle circular references
              if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) return '[Circular]';
                seen.add(value);
              }
              
              return value;
            });
          } catch (e) {
            // If we can't stringify, return a simple representation
            return '"[Object that cannot be serialized]"';
          }
        }
        
        ${code}
        
        // Safely handle the results object
        try {
          if (typeof results === 'object' && results !== null) {
            // Safely serialize the entire results object
            const safeResults = {
              passed: !!results.passed,
              testCasesPassed: Number(results.testCasesPassed) || 0,
              testCasesTotal: Number(results.testCasesTotal) || 0
            };

            // Handle test results array specially
            if (Array.isArray(results.testResults)) {
              safeResults.testResults = results.testResults.map(tr => {
                if (tr && typeof tr === 'object') {
                  const safeTestResult = {
                    testCase: tr.testCase,
                    passed: !!tr.passed
                  };
                  
                  // Handle the actual output specifically to avoid transfer issues
                  try {
                    if (tr.actualOutput === undefined) {
                      safeTestResult.actualOutput = 'undefined';
                    } else if (tr.actualOutput === null) {
                      safeTestResult.actualOutput = null;
                    } else if (typeof tr.actualOutput === 'function') {
                      safeTestResult.actualOutput = '[Function]';
                    } else if (typeof tr.actualOutput === 'object') {
                      // For objects (including arrays), convert to a string representation
                      safeTestResult.actualOutput = safeStringify(tr.actualOutput);
                    } else {
                      // For primitives, use as is
                      safeTestResult.actualOutput = tr.actualOutput;
                    }
                  } catch (e) {
                    safeTestResult.actualOutput = '[Serialization Error]';
                  }
                  
                  return safeTestResult;
                }
                return null;
              }).filter(Boolean);
            }
            
            // Use __printResult to safely pass the result back
            __printResult(JSON.stringify(safeResults));
          } else {
            __printResult(JSON.stringify({
              passed: false,
              testCasesPassed: 0,
              testCasesTotal: 0,
              error: 'Invalid results format'
            }));
          }
        } catch (jsonError) {
          console.error('Error serializing results:', jsonError.message);
          
          // Create a minimal safe result
          __printResult(JSON.stringify({
            passed: false,
            testCasesPassed: 0,
            testCasesTotal: 0,
            error: 'Failed to serialize results: ' + jsonError.message
          }));
        }
      } catch (err) {
        console.error('Execution error:', err.message);
        __printResult(JSON.stringify({
          passed: false,
          testCasesPassed: 0,
          testCasesTotal: 0,
          error: err.message
        }));
      }
    `;
    
    // Execute with timeout
    const timeout = options.timeout || 5000;
    const script = await isolate.compileScript(wrappedCode);
    await script.run(context, { timeout });
    
    // Calculate metrics
    const executionTime = Date.now() - startTime;
    const memoryUsage = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024; // in MB
    
    // Get output
    const outputText = output.join('\n');
    
    // Dispose of the isolate to free memory
    isolate.dispose();
    
    return {
      result,
      output: outputText,
      error: null,
      metrics: {
        executionTime, 
        memoryUsage
      }
    };
  } catch (err) {
    // Handle errors, including timeouts
    error = err.message;
    if (err.stack) {
      console.error(err.stack);
    }
    
    const executionTime = Date.now() - startTime;
    const memoryUsage = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024;
    
    return {
      result: null,
      output: '',
      error: error || 'Unknown error during execution',
      metrics: {
        executionTime,
        memoryUsage
      }
    };
  }
}

module.exports = {
  createSandbox,
  executeInSandbox
}; 