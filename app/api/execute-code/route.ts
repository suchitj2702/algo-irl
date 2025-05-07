import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { promisify } from 'util';
import type { ExecutionResults, TestCase, TestCaseResult } from '../../../types/entities';

// Promisify exec for easier async/await usage
const execAsync = promisify(exec);

// Set strict execution limits
const EXECUTION_TIMEOUT = 5000; // 5 seconds
const MAX_BUFFER = 1024 * 1024; // 1MB output limit

// Define language-specific execution commands
const languageConfigs = {
  javascript: {
    fileExtension: '.js',
    prepareCommand: () => 'node',
    validateCode: (code: string) => {
      // Check for potentially dangerous operations
      const dangerousPatterns = [
        /process\.exit/i,
        /require\s*\(\s*['"]child_process['"]\s*\)/i,
        /require\s*\(\s*['"]fs['"]\s*\)/i,
        /require\s*\(\s*['"]path['"]\s*\)/i,
        /require\s*\(\s*['"]os['"]\s*\)/i,
        /require\s*\(\s*['"]net['"]\s*\)/i,
        /eval\s*\(/i,
        /Function\s*\(/i,
        /setTimeout\s*\(/i,
        /setInterval\s*\(/i,
        /process\.env/i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          throw new Error(`Forbidden code pattern detected: ${pattern.toString()}`);
        }
      }
      return code;
    },
    generateWrapperCode: (code: string, testCases: TestCase[]) => {
      // Create a wrapper that tests the solution with the provided test cases
      return `
        ${code}
        
        // Test cases runner
        const testCases = ${JSON.stringify(testCases)};
        const results = {
          passed: true,
          testCasesPassed: 0,
          testCasesTotal: testCases.length,
          testResults: []
        };
        
        console.time('execution');
        for (let i = 0; i < testCases.length; i++) {
          try {
            const testCase = testCases[i];
            const input = testCase.input;
            const expected = testCase.output;
            
            // Assuming solution is the main function
            let result;
            if (typeof solution === 'function') {
              if (input.nums) {
                if (input.target !== undefined) {
                  result = solution(input.nums, input.target);
                } else {
                  result = solution(input.nums);
                }
              } else {
                result = solution(...Object.values(input));
              }
            }
            
            // Compare result with expected output
            let passed = false;
            if (Array.isArray(expected) && Array.isArray(result)) {
              // For arrays, compare values regardless of order if needed
              passed = result.length === expected.length && 
                      result.every(val => expected.includes(val));
            } else {
              passed = JSON.stringify(result) === JSON.stringify(expected);
            }
            
            // Store test result
            results.testResults.push({
              testCase: testCase,
              passed: passed,
              actualOutput: result
            });
            
            if (passed) {
              results.testCasesPassed++;
            } else {
              results.passed = false;
            }
          } catch (error) {
            results.passed = false;
            results.testResults.push({
              testCase: testCases[i],
              passed: false,
              actualOutput: error.message
            });
            console.error('Test case error:', error.message);
          }
        }
        console.timeEnd('execution');
        
        console.log(JSON.stringify(results));
      `;
    }
  },
  typescript: {
    fileExtension: '.ts',
    prepareCommand: () => 'npx ts-node',
    validateCode: (code: string) => {
      // Check for potentially dangerous operations (same as JavaScript)
      const dangerousPatterns = [
        /process\.exit/i,
        /require\s*\(\s*['"]child_process['"]\s*\)/i,
        /require\s*\(\s*['"]fs['"]\s*\)/i,
        /require\s*\(\s*['"]path['"]\s*\)/i,
        /require\s*\(\s*['"]os['"]\s*\)/i,
        /require\s*\(\s*['"]net['"]\s*\)/i,
        /eval\s*\(/i,
        /Function\s*\(/i,
        /setTimeout\s*\(/i,
        /setInterval\s*\(/i,
        /process\.env/i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          throw new Error(`Forbidden code pattern detected: ${pattern.toString()}`);
        }
      }
      return code;
    },
    generateWrapperCode: (code: string, testCases: TestCase[]) => {
      // Create a wrapper that tests the solution with the provided test cases
      return `
        ${code}
        
        // Test cases runner
        const testCases: any[] = ${JSON.stringify(testCases)};
        const results: {
          passed: boolean;
          testCasesPassed: number;
          testCasesTotal: number;
          testResults: Array<{
            testCase: any;
            passed: boolean;
            actualOutput: any;
          }>;
        } = {
          passed: true,
          testCasesPassed: 0,
          testCasesTotal: testCases.length,
          testResults: []
        };
        
        console.time('execution');
        for (let i = 0; i < testCases.length; i++) {
          try {
            const testCase = testCases[i];
            const input = testCase.input;
            const expected = testCase.output;
            
            // Assuming solution is the main function
            let result: any;
            if (typeof solution === 'function') {
              if (input.nums) {
                if (input.target !== undefined) {
                  result = solution(input.nums, input.target);
                } else {
                  result = solution(input.nums);
                }
              } else {
                result = solution(...Object.values(input));
              }
            }
            
            // Compare result with expected output
            let passed = false;
            if (Array.isArray(expected) && Array.isArray(result)) {
              // For arrays, compare values regardless of order if needed
              passed = result.length === expected.length && 
                      result.every(val => expected.includes(val));
            } else {
              passed = JSON.stringify(result) === JSON.stringify(expected);
            }
            
            // Store test result
            results.testResults.push({
              testCase: testCase,
              passed: passed,
              actualOutput: result
            });
            
            if (passed) {
              results.testCasesPassed++;
            } else {
              results.passed = false;
            }
          } catch (error: any) {
            results.passed = false;
            results.testResults.push({
              testCase: testCases[i],
              passed: false,
              actualOutput: error.message
            });
            console.error('Test case error:', error.message);
          }
        }
        console.timeEnd('execution');
        
        console.log(JSON.stringify(results));
      `;
    }
  },
  python: {
    fileExtension: '.py',
    prepareCommand: () => 'python3',
    validateCode: (code: string) => {
      // Check for potentially dangerous operations
      const dangerousPatterns = [
        /import\s+os/i,
        /import\s+sys/i,
        /import\s+subprocess/i,
        /import\s+shutil/i,
        /import\s+pathlib/i,
        /eval\s*\(/i,
        /exec\s*\(/i,
        /__import__\s*\(/i,
        /open\s*\(/i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          throw new Error(`Forbidden code pattern detected: ${pattern.toString()}`);
        }
      }
      return code;
    },
    generateWrapperCode: (code: string, testCases: TestCase[]) => {
      return `
import json
import time

${code}

# Test cases runner
test_cases = ${JSON.stringify(testCases)}
results = {
    "passed": True,
    "testCasesPassed": 0,
    "testCasesTotal": len(test_cases),
    "testResults": []
}

start_time = time.time()
for i, test_case in enumerate(test_cases):
    try:
        input_data = test_case["input"]
        expected = test_case["output"]
        
        # Assuming solution is the main function
        if "nums" in input_data:
            if "target" in input_data:
                result = solution(input_data["nums"], input_data["target"])
            else:
                result = solution(input_data["nums"])
        else:
            result = solution(*list(input_data.values()))
        
        # Compare result with expected output
        passed = False
        if isinstance(expected, list) and isinstance(result, list):
            # For arrays, compare values regardless of order if needed
            passed = len(result) == len(expected) and all(val in expected for val in result)
        else:
            passed = result == expected
        
        # Store test result
        results["testResults"].append({
            "testCase": test_case,
            "passed": passed,
            "actualOutput": result
        })
        
        if passed:
            results["testCasesPassed"] += 1
        else:
            results["passed"] = False
    except Exception as e:
        results["passed"] = False
        results["testResults"].append({
            "testCase": test_case,
            "passed": False,
            "actualOutput": str(e)
        })
        print(f"Error: {str(e)}")

execution_time = (time.time() - start_time) * 1000  # Convert to ms
results["executionTime"] = execution_time

print(json.dumps(results))
      `;
    }
  },
  java: {
    fileExtension: '.java',
    prepareCommand: (filename: string = '') => `javac ${filename}.java && java ${filename}`,
    validateCode: (code: string) => {
      // Check for potentially dangerous operations
      const dangerousPatterns = [
        /System\.exit/i,
        /Runtime\.getRuntime\(\)\.exec/i,
        /ProcessBuilder/i,
        /java\.io\.File/i,
        /java\.nio\.file/i,
        /javax\.script/i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          throw new Error(`Forbidden code pattern detected: ${pattern.toString()}`);
        }
      }
      
      // Java code must be wrapped in a class
      if (!code.includes("class Solution")) {
        code = `class Solution {\n${code}\n}`;
      }
      
      return code;
    },
    generateWrapperCode: (code: string, testCases: TestCase[]) => {
      const className = "CodeExecution";
      // Create a Java wrapper to test the solution
      return `
import java.util.*;
import org.json.simple.*;

${code}

public class ${className} {
    public static void main(String[] args) {
        Solution solution = new Solution();
        
        JSONArray testCases = new JSONArray();
        ${testCases.map((tc, i) => `
        // Test case ${i + 1}
        JSONObject testCase${i} = new JSONObject();
        JSONObject input${i} = new JSONObject();
        ${Object.entries(tc.input).map(([key, value]) => {
          if (Array.isArray(value)) {
            return `
            JSONArray ${key}${i} = new JSONArray();
            ${value.map((v, j) => `${key}${i}.add(${typeof v === 'number' ? v : `"${v}"`});`).join('\n')}
            input${i}.put("${key}", ${key}${i});
            `;
          } else {
            return `input${i}.put("${key}", ${typeof value === 'number' ? value : `"${value}"`});`;
          }
        }).join('\n')}
        testCase${i}.put("input", input${i});
        
        JSONArray output${i} = new JSONArray();
        ${Array.isArray(tc.output) ? 
          tc.output.map((v, j) => `output${i}.add(${typeof v === 'number' ? v : `"${v}"`});`).join('\n') : 
          `output${i}.add(${typeof tc.output === 'number' ? tc.output : `"${tc.output}"`});`
        }
        testCase${i}.put("output", output${i});
        testCases.add(testCase${i});
        `).join('\n')}
        
        JSONObject results = new JSONObject();
        results.put("passed", true);
        results.put("testCasesPassed", 0);
        results.put("testCasesTotal", testCases.size());
        
        long startTime = System.currentTimeMillis();
        for (int i = 0; i < testCases.size(); i++) {
            try {
                JSONObject testCase = (JSONObject) testCases.get(i);
                JSONObject input = (JSONObject) testCase.get("input");
                JSONArray expected = (JSONArray) testCase.get("output");
                
                // Call solution method based on input parameters
                Object result = null;
                if (input.containsKey("nums")) {
                    JSONArray numsArray = (JSONArray) input.get("nums");
                    int[] nums = new int[numsArray.size()];
                    for (int j = 0; j < numsArray.size(); j++) {
                        nums[j] = ((Long)numsArray.get(j)).intValue();
                    }
                    
                    if (input.containsKey("target")) {
                        int target = ((Long)input.get("target")).intValue();
                        result = solution.solution(nums, target);
                    } else {
                        result = solution.solution(nums);
                    }
                } else {
                    // Handle other parameter types as needed
                }
                
                // Compare result with expected output
                boolean passed = false;
                if (result instanceof int[]) {
                    int[] resultArr = (int[]) result;
                    if (resultArr.length == expected.size()) {
                        passed = true;
                        for (int j = 0; j < resultArr.length; j++) {
                            if (!expected.contains(resultArr[j])) {
                                passed = false;
                                break;
                            }
                        }
                    }
                } else {
                    passed = expected.contains(result);
                }
                
                if (passed) {
                    results.put("testCasesPassed", ((Long)results.get("testCasesPassed")) + 1);
                } else {
                    results.put("passed", false);
                    break;
                }
            } catch (Exception e) {
                results.put("passed", false);
                System.err.println("Error: " + e.getMessage());
                break;
            }
        }
        
        long executionTime = System.currentTimeMillis() - startTime;
        results.put("executionTime", executionTime);
        
        System.out.println(results.toJSONString());
    }
}`;
    }
  },
  csharp: {
    fileExtension: '.cs',
    prepareCommand: (filename: string = '') => `dotnet script ${filename}.cs`,
    validateCode: (code: string) => {
      // Check for potentially dangerous operations
      const dangerousPatterns = [
        /System\.Diagnostics\.Process/i,
        /System\.IO\.File/i,
        /System\.Environment/i,
        /System\.Reflection/i,
        /System\.Runtime\.InteropServices/i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          throw new Error(`Forbidden code pattern detected: ${pattern.toString()}`);
        }
      }
      
      return code;
    },
    generateWrapperCode: (code: string, testCases: TestCase[]) => {
      return `
#r "nuget: Newtonsoft.Json, 13.0.1"
using System;
using System.Collections.Generic;
using System.Linq;
using System.Diagnostics;
using Newtonsoft.Json;

${code}

class Program
{
    static void Main()
    {
        var solution = new Solution();
        var results = new Dictionary<string, object>
        {
            { "passed", true },
            { "testCasesPassed", 0 },
            { "testCasesTotal", ${testCases.length} },
            { "testResults", new List<Dictionary<string, object>>() }
        };
        
        var stopwatch = Stopwatch.StartNew();
        
        ${testCases.map((tc, i) => `
        // Test case ${i + 1}
        try
        {
            var testCase = new Dictionary<string, object>();
            var input = new Dictionary<string, object>();
            
            // Set up input
            ${Object.entries(tc.input).map(([key, value]) => {
              if (Array.isArray(value)) {
                return `var ${key} = new int[] {${value.join(', ')}};
                input["${key}"] = ${key};`;
              } else {
                return `var ${key} = ${value};
                input["${key}"] = ${key};`;
              }
            }).join('\n')}
            
            testCase["input"] = input;
            testCase["output"] = new int[] {${Array.isArray(tc.output) ? tc.output.join(', ') : tc.output}};
            ${tc.explanation ? `testCase["explanation"] = "${tc.explanation}";` : ''}
            
            // Execute solution
            int[] result = ${Object.entries(tc.input).some(([key]) => key === 'target') ? 
              `solution.Solution(${Object.entries(tc.input).find(([key]) => key === 'nums')?.[1]}, ${Object.entries(tc.input).find(([key]) => key === 'target')?.[1]})` :
              `solution.Solution(${Object.entries(tc.input).find(([key]) => key === 'nums')?.[1]})`};
            
            // Check result
            bool passed = false;
            int[] expected = new int[] {${Array.isArray(tc.output) ? tc.output.join(', ') : tc.output}};
            
            if (result.Length == expected.Length)
            {
                // Check if arrays contain the same elements (order might be different)
                passed = true;
                foreach (var val in result)
                {
                    if (!expected.Contains(val))
                    {
                        passed = false;
                        break;
                    }
                }
            }
            
            var testResult = new Dictionary<string, object>
            {
                { "testCase", testCase },
                { "passed", passed },
                { "actualOutput", result }
            };
            
            ((List<Dictionary<string, object>>)results["testResults"]).Add(testResult);
            
            if (passed)
            {
                results["testCasesPassed"] = ((int)results["testCasesPassed"]) + 1;
            }
            else
            {
                results["passed"] = false;
            }
        }
        catch (Exception e)
        {
            var testCase = new Dictionary<string, object>();
            var input = new Dictionary<string, object>();
            
            // Add basic test case info for error case
            ${Object.entries(tc.input).map(([key, value]) => {
              if (Array.isArray(value)) {
                return `input["${key}"] = "array";`;
              } else {
                return `input["${key}"] = ${value};`;
              }
            }).join('\n')}
            
            testCase["input"] = input;
            testCase["output"] = "array";
            
            var testResult = new Dictionary<string, object>
            {
                { "testCase", testCase },
                { "passed", false },
                { "actualOutput", e.Message }
            };
            
            ((List<Dictionary<string, object>>)results["testResults"]).Add(testResult);
            results["passed"] = false;
            Console.Error.WriteLine($"Error: {e.Message}");
        }
        `).join('\n')}
        
        stopwatch.Stop();
        results["executionTime"] = stopwatch.ElapsedMilliseconds;
        
        Console.WriteLine(JsonConvert.SerializeObject(results));
    }
}`;
    }
  },
  cpp: {
    fileExtension: '.cpp',
    prepareCommand: (filename: string = '') => `g++ -std=c++17 ${filename}.cpp -o ${filename} && ./${filename}`,
    validateCode: (code: string) => {
      // Check for potentially dangerous operations
      const dangerousPatterns = [
        /system\s*\(/i,
        /popen\s*\(/i,
        /<fstream>/i,
        /<filesystem>/i,
        /<cstdlib>/i,
        /execl\s*\(/i,
        /fork\s*\(/i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          throw new Error(`Forbidden code pattern detected: ${pattern.toString()}`);
        }
      }
      
      return code;
    },
    generateWrapperCode: (code: string, testCases: TestCase[]) => {
      return `
#include <iostream>
#include <vector>
#include <string>
#include <chrono>
#include <algorithm>
#include <sstream>

${code}

std::string vectorToString(const std::vector<int>& vec) {
    std::stringstream ss;
    ss << "[";
    for (size_t i = 0; i < vec.size(); ++i) {
        ss << vec[i];
        if (i < vec.size() - 1) {
            ss << ", ";
        }
    }
    ss << "]";
    return ss.str();
}

int main() {
    Solution solution;
    bool passed = true;
    int testCasesPassed = 0;
    int testCasesTotal = ${testCases.length};
    
    auto startTime = std::chrono::high_resolution_clock::now();
    
    std::cout << "{" << std::endl;
    std::cout << "  \\"passed\\": ";
    
    std::cout << "  \\"testResults\\": [" << std::endl;
    ${testCases.map((tc, i) => `
    // Test case ${i + 1}
    {
        bool testPassed = false;
        try {
            // Set up input
            std::vector<int> nums = {${tc.input.nums.join(', ')}};
            ${tc.input.target !== undefined ? `int target = ${tc.input.target};` : ''}
            
            // Execute solution
            std::vector<int> result = ${tc.input.target !== undefined ? 
              `solution.solution(nums, target)` : 
              `solution.solution(nums)`};
            
            // Check result
            std::vector<int> expected = {${Array.isArray(tc.output) ? tc.output.join(', ') : tc.output}};
            
            if (result.size() == expected.size()) {
                testPassed = true;
                for (const auto& val : result) {
                    if (std::find(expected.begin(), expected.end(), val) == expected.end()) {
                        testPassed = false;
                        break;
                    }
                }
            }
            
            if (testPassed) {
                testCasesPassed++;
            } else {
                passed = false;
            }
            
            std::cout << "    {" << std::endl;
            std::cout << "      \\"testCase\\": {" << std::endl;
            std::cout << "        \\"input\\": {" << std::endl;
            std::cout << "          \\"nums\\": \\"" << vectorToString(nums) << "\\"" << std::endl;
            ${tc.input.target !== undefined ? `std::cout << "          ,\\"target\\": \\"" << target << "\\"" << std::endl;` : ''}
            std::cout << "        }," << std::endl;
            std::cout << "        \\"output\\": \\"" << vectorToString(expected) << "\\"" << std::endl;
            ${tc.explanation ? `std::cout << "        ,\\"explanation\\": \\"${tc.explanation}\\"" << std::endl;` : ''}
            std::cout << "      }," << std::endl;
            std::cout << "      \\"passed\\": " << (testPassed ? "true" : "false") << "," << std::endl;
            std::cout << "      \\"actualOutput\\": \\"" << vectorToString(result) << "\\"" << std::endl;
            std::cout << "    }" << (${i} < ${testCases.length - 1} ? "," : "") << std::endl;
        }
        catch (const std::exception& e) {
            passed = false;
            
            std::cout << "    {" << std::endl;
            std::cout << "      \\"testCase\\": {" << std::endl;
            std::cout << "        \\"input\\": {" << std::endl;
            std::cout << "          \\"nums\\": \\"array\\"" << std::endl;
            ${tc.input.target !== undefined ? `std::cout << "          ,\\"target\\": \\"${tc.input.target}\\"" << std::endl;` : ''}
            std::cout << "        }," << std::endl;
            std::cout << "        \\"output\\": \\"array\\"" << std::endl;
            std::cout << "      }," << std::endl;
            std::cout << "      \\"passed\\": false," << std::endl;
            std::cout << "      \\"actualOutput\\": \\"Error: " << e.what() << "\\"" << std::endl;
            std::cout << "    }" << (${i} < ${testCases.length - 1} ? "," : "") << std::endl;
        }
    }
    `).join('\n')}
    std::cout << "  ]," << std::endl;
    
    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();
    
    std::cout << "  \\"passed\\": " << (passed ? "true" : "false") << "," << std::endl;
    std::cout << "  \\"testCasesPassed\\": " << testCasesPassed << "," << std::endl;
    std::cout << "  \\"testCasesTotal\\": " << testCasesTotal << "," << std::endl;
    std::cout << "  \\"executionTime\\": " << duration << std::endl;
    std::cout << "}" << std::endl;
    
    return 0;
}`;
    }
  },
  go: {
    fileExtension: '.go',
    prepareCommand: (filename: string = '') => `go run ${filename}.go`,
    validateCode: (code: string) => {
      // Check for potentially dangerous operations
      const dangerousPatterns = [
        /os\./i,
        /exec\./i,
        /ioutil\./i,
        /filepath\./i,
        /syscall\./i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          throw new Error(`Forbidden code pattern detected: ${pattern.toString()}`);
        }
      }
      
      return code;
    },
    generateWrapperCode: (code: string, testCases: TestCase[]) => {
      return `
package main

import (
	"encoding/json"
	"fmt"
	"time"
)

${code}

type TestCase struct {
	Input       map[string]interface{} \`json:"input"\`
	Output      interface{}            \`json:"output"\`
	Explanation string                 \`json:"explanation,omitempty"\`
}

type TestResult struct {
	TestCase    TestCase    \`json:"testCase"\`
	Passed      bool        \`json:"passed"\`
	ActualOutput interface{} \`json:"actualOutput"\`
}

type Results struct {
	Passed         bool         \`json:"passed"\`
	TestCasesPassed int          \`json:"testCasesPassed"\`
	TestCasesTotal  int          \`json:"testCasesTotal"\`
	ExecutionTime   int64        \`json:"executionTime"\`
	TestResults     []TestResult \`json:"testResults"\`
}

func arrayToInterface(arr []int) []interface{} {
	result := make([]interface{}, len(arr))
	for i, v := range arr {
		result[i] = v
	}
	return result
}

func main() {
	results := Results{
		Passed:         true,
		TestCasesPassed: 0,
		TestCasesTotal:  ${testCases.length},
		TestResults:     []TestResult{},
	}
	
	startTime := time.Now()
	
	${testCases.map((tc, i) => `
	// Test case ${i + 1}
	{
		testCase := TestCase{
			Input: map[string]interface{}{
				${Object.entries(tc.input).map(([key, value]) => {
					if (Array.isArray(value)) {
						return `"${key}": []interface{}{${value.join(', ')}},`;
					} else {
						return `"${key}": ${value},`;
					}
				}).join('\n\t\t\t\t')}
			},
			Output: []interface{}{${Array.isArray(tc.output) ? tc.output.join(', ') : tc.output}},
			${tc.explanation ? `Explanation: "${tc.explanation}",` : ''}
		}
		
		var result []int
		var err error
		
		// Execute solution safely
		func() {
			defer func() {
				if r := recover(); r != nil {
					err = fmt.Errorf("panic: %v", r)
				}
			}()
			
			${Object.entries(tc.input).some(([key]) => key === 'target') ? 
				`result = solution(
					${Object.entries(tc.input).find(([key]) => key === 'nums')?.[1].map((n: number) => n).join(', ')},
					${Object.entries(tc.input).find(([key]) => key === 'target')?.[1]}
				)` : 
				`result = solution(${Object.entries(tc.input).find(([key]) => key === 'nums')?.[1].map((n: number) => n).join(', ')})`
			}
		}()
		
		testResult := TestResult{
			TestCase: testCase,
			Passed:   false,
		}
		
		if err != nil {
			testResult.ActualOutput = err.Error()
		} else {
			testResult.ActualOutput = result
			
			// Check if arrays contain the same elements
			expected := []int{${Array.isArray(tc.output) ? tc.output.join(', ') : tc.output}}
			
			if len(result) == len(expected) {
				passed := true
				found := false
				
				for _, val := range result {
					found = false
					for _, exp := range expected {
						if val == exp {
							found = true
							break
						}
					}
					if !found {
						passed = false
						break
					}
				}
				
				if passed {
					testResult.Passed = true
					results.TestCasesPassed++
				}
			}
		}
		
		if !testResult.Passed {
			results.Passed = false
		}
		
		results.TestResults = append(results.TestResults, testResult)
	}
	`).join('\n\t')}
	
	results.ExecutionTime = time.Since(startTime).Milliseconds()
	
	// Output results as JSON
	jsonResult, _ := json.Marshal(results)
	fmt.Println(string(jsonResult))
}`;
    }
  },
};

async function executeCode(code: string, language: string, testCases: TestCase[]): Promise<ExecutionResults> {
  // Create a unique ID for this execution
  const executionId = uuidv4();
  
  // Get language configuration
  const langConfig = languageConfigs[language as keyof typeof languageConfigs];
  if (!langConfig) {
    throw new Error(`Unsupported language: ${language}`);
  }
  
  try {
    // Create temporary directory and files
    const tempDir = path.join(process.cwd(), 'tmp', executionId);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Validate code for security
    const validatedCode = langConfig.validateCode(code);
    
    // Generate wrapper code with test cases
    const wrapperCode = langConfig.generateWrapperCode(validatedCode, testCases);
    
    // Write code to temp file
    const fileExtension = langConfig.fileExtension;
    const filename = `solution_${executionId}`;
    const filePath = path.join(tempDir, `${filename}${fileExtension}`);
    await fs.writeFile(filePath, wrapperCode);
    
    // Execute code with proper command
    const executeCmd = language === 'java' 
      ? langConfig.prepareCommand(filename)
      : `${langConfig.prepareCommand()} ${filePath}`;
    
    // Execute with timeout and memory limits
    const { stdout, stderr } = await execAsync(executeCmd, {
      cwd: tempDir,
      timeout: EXECUTION_TIMEOUT,
      maxBuffer: MAX_BUFFER,
    });
    
    // Parse results
    let results: ExecutionResults;
    try {
      // Extract the JSON results from stdout
      const outputLines = stdout.trim().split('\n');
      const jsonLine = outputLines.find(line => line.trim().startsWith('{') && line.trim().endsWith('}'));
      
      if (jsonLine) {
        const parsedResults = JSON.parse(jsonLine);
        results = {
          passed: parsedResults.passed || false,
          testCasesPassed: parsedResults.testCasesPassed || 0,
          testCasesTotal: testCases.length,
          executionTime: parsedResults.executionTime || null,
          memoryUsage: null, // Memory usage is harder to measure accurately
          error: null,
        };
      } else {
        throw new Error('Could not parse execution results');
      }
    } catch (parseError) {
      console.error('Error parsing execution results:', parseError);
      results = {
        passed: false,
        testCasesPassed: 0,
        testCasesTotal: testCases.length,
        executionTime: null,
        memoryUsage: null,
        error: stderr || 'Error parsing execution results',
      };
    }
    
    // Clean up temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError);
    }
    
    return results;
    
  } catch (error: any) {
    console.error('Code execution error:', error);
    
    // Determine the appropriate error message
    let errorMessage: string;
    if (error.killed && error.signal === 'SIGTERM') {
      errorMessage = `Execution timed out after ${EXECUTION_TIMEOUT / 1000} seconds`;
    } else if (error.message.includes('Forbidden code pattern')) {
      errorMessage = error.message;
    } else {
      errorMessage = error.stderr || error.message || 'An unknown error occurred during execution';
    }
    
    return {
      passed: false,
      testCasesPassed: 0,
      testCasesTotal: testCases.length,
      executionTime: null,
      memoryUsage: null,
      error: errorMessage,
    };
  }
}

async function fetchTestCasesForProblem(problemId: string): Promise<TestCase[]> {
  // In a real implementation, you would fetch test cases from Firestore
  // For now, we'll just return mock test cases for the two-sum problem
  if (problemId === 'two-sum') {
    return [
      {
        input: { nums: [2, 7, 11, 15], target: 9 },
        output: [0, 1],
        explanation: "Because nums[0] + nums[1] = 2 + 7 = 9, we return [0, 1]."
      },
      {
        input: { nums: [3, 2, 4], target: 6 },
        output: [1, 2],
        explanation: "Because nums[1] + nums[2] = 2 + 4 = 6, we return [1, 2]."
      },
      {
        input: { nums: [3, 3], target: 6 },
        output: [0, 1],
        explanation: "Because nums[0] + nums[1] = 3 + 3 = 6, we return [0, 1]."
      }
    ];
  }
  
  return [];
}

/**
 * DEPRECATED: This API route has been replaced by a serverless function implementation
 * at /pages/api/code/execute.js
 * 
 * Please update your API calls to use the new endpoint at /api/code/execute
 */
export async function POST(request: NextRequest) {
  return NextResponse.redirect(new URL('/api/code/execute', request.url), 308);
} 