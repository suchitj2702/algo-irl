import type { TestCase } from '../../data-types/problem';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MultiTestCaseBuildResult {
  code: string;
  userCodeLineOffset: number;
}

export interface ParsedTestCaseResult {
  /** Test case index */
  i: number;
  /** Output value */
  o: unknown;
  /** Time in milliseconds */
  t: number;
  /** Status: "ok" or "err" */
  s: string;
  /** Error message if status is "err" */
  e: string | null;
}

export interface ParsedMultiTestCaseOutput {
  results: ParsedTestCaseResult[];
  parseError: string | null;
}

// ─── Python wrapper template ─────────────────────────────────────────────────
//
// The wrapper:
// 1. Reads all test cases from stdin as JSON
// 2. For each test case, redirects sys.stdin/stdout/stderr to StringIO
// 3. Runs the original main body (which reads from "stdin" and writes to "stdout")
// 4. Captures output and timing per test case
// 5. Writes structured JSON results to real stdout

const PYTHON_WRAPPER_PREFIX = `
import io as _io
import time as _time

_ALL_INPUT = _io.TextIOWrapper(_io.BufferedReader(_io.FileIO(0)), encoding='utf-8').read()
_PARSED_INPUT = __import__('json').loads(_ALL_INPUT)
_TEST_CASES = _PARSED_INPUT["test_cases"]
_RESULTS = []

for _tc_idx, _tc_data in enumerate(_TEST_CASES):
    _tc_result = {"i": _tc_idx, "o": None, "t": 0.0, "s": "err", "e": None}
    _tc_stdin_str = __import__('json').dumps(_tc_data)
    _tc_stdin_io = _io.StringIO(_tc_stdin_str)
    _tc_stdout_io = _io.StringIO()
    _tc_stderr_io = _io.StringIO()
    _orig_stdin, _orig_stdout, _orig_stderr = __import__('sys').stdin, __import__('sys').stdout, __import__('sys').stderr
    __import__('sys').stdin = _tc_stdin_io
    __import__('sys').stdout = _tc_stdout_io
    __import__('sys').stderr = _tc_stderr_io
    _tc_start = _time.perf_counter()
    try:
`;

const PYTHON_WRAPPER_SUFFIX = `
    except SystemExit:
        pass
    except Exception as _tc_ex:
        _tc_result["e"] = str(_tc_ex)
    finally:
        _tc_result["t"] = round((_time.perf_counter() - _tc_start) * 1000, 3)
        __import__('sys').stdin = _orig_stdin
        __import__('sys').stdout = _orig_stdout
        __import__('sys').stderr = _orig_stderr
    _tc_stdout_val = _tc_stdout_io.getvalue().strip()
    _tc_stderr_val = _tc_stderr_io.getvalue().strip()
    if _tc_stderr_val and not _tc_stdout_val:
        _tc_result["s"] = "err"
        _tc_result["e"] = _tc_stderr_val
    elif _tc_stdout_val:
        try:
            _tc_result["o"] = __import__('json').loads(_tc_stdout_val)
        except (ValueError, __import__('json').JSONDecodeError):
            _tc_result["o"] = _tc_stdout_val
        _tc_result["s"] = "ok"
    elif not _tc_stderr_val and _tc_result["e"] is None:
        _tc_result["o"] = None
        _tc_result["s"] = "ok"
    _RESULTS.append(_tc_result)

_orig_stdout.write(__import__('json').dumps({"results": _RESULTS}))
`;

// ─── JavaScript wrapper template ─────────────────────────────────────────────
//
// For JS, the existing boilerplate uses readline from stdin which is async.
// The multi-TC wrapper reads all input synchronously and loops over test cases,
// directly calling the solution function.

const JS_WRAPPER_PREFIX = `
const _allInput = require('fs').readFileSync('/dev/stdin', 'utf8');
const _parsed = JSON.parse(_allInput);
const _testCases = _parsed.test_cases;
const _results = [];

(async () => {
for (let _i = 0; _i < _testCases.length; _i++) {
  const _tcResult = { i: _i, o: null, t: 0, s: 'err', e: null };
  const _startTime = process.hrtime.bigint();
  try {
    const _inputData = _testCases[_i];
    let _result;
    if (Array.isArray(_inputData)) {
      _result = solution(..._inputData);
    } else if (_inputData !== null && typeof _inputData === 'object' && !Array.isArray(_inputData)) {
      _result = solution(...Object.values(_inputData));
    } else {
      _result = solution(_inputData);
    }
    if (_result instanceof Promise) {
      _result = await _result;
    }
    _tcResult.o = _result !== undefined ? _result : null;
    _tcResult.s = 'ok';
  } catch (_e) {
    _tcResult.s = 'err';
    _tcResult.e = _e instanceof Error ? _e.message : String(_e);
  } finally {
    const _endTime = process.hrtime.bigint();
    _tcResult.t = Number(_endTime - _startTime) / 1e6;
  }
  _results.push(_tcResult);
}
process.stdout.write(JSON.stringify({ results: _results }));
})();
`;

// ─── Core transformation functions ───────────────────────────────────────────

/**
 * Transforms combined code (user code + boilerplate) into a multi-test-case
 * version that runs all test cases in a single Judge0 execution.
 *
 * For Python: splits at `if __name__` boundary, wraps the main body in a loop
 * with stdin/stdout/stderr redirection via StringIO.
 *
 * For JavaScript: replaces the readline-based stdin reading with a synchronous
 * loop that directly calls solution().
 *
 * @returns Build result with transformed code and user code line offset, or null if transformation fails
 */
export function buildMultiTestCaseCode(
  combinedCode: string,
  language: string
): MultiTestCaseBuildResult | null {
  switch (language) {
    case 'python':
      return buildPythonMultiTestCase(combinedCode);
    case 'javascript':
      return buildJavaScriptMultiTestCase(combinedCode);
    default:
      return null;
  }
}

/**
 * Python transformation: splits at `if __name__` and wraps the main body
 * in the multi-test-case loop with stdin/stdout/stderr redirection.
 */
function buildPythonMultiTestCase(combinedCode: string): MultiTestCaseBuildResult | null {
  // Find the `if __name__ == '__main__':` boundary
  const mainGuardRegex = /^if\s+__name__\s*==\s*['"]__main__['"]\s*:/m;
  const match = combinedCode.match(mainGuardRegex);

  if (!match || match.index === undefined) {
    return null;
  }

  // Everything before `if __name__` = definitions (imports, helpers, user code)
  const definitionsSection = combinedCode.substring(0, match.index).trimEnd();

  // Everything after `if __name__:` = main body
  const afterGuard = combinedCode.substring(match.index + match[0].length);

  // Dedent the main body by finding its base indentation level
  const mainBody = dedentPython(afterGuard);

  // Indent the main body to sit inside the try block (8 spaces: for loop + try)
  const indentedMainBody = indentPython(mainBody, 8);

  const finalCode = `${definitionsSection}\n${PYTHON_WRAPPER_PREFIX}${indentedMainBody}${PYTHON_WRAPPER_SUFFIX}`;

  // userCodeLineOffset = 0 because the definitions section (containing user code)
  // starts at line 1 of the final code. The wrapper comes AFTER definitions,
  // so user code line numbers are unchanged.
  const userCodeLineOffset = 0;

  return { code: finalCode, userCodeLineOffset };
}

/**
 * JavaScript transformation: replaces the readline-based boilerplate main function
 * with a synchronous loop that directly calls solution().
 *
 * The user's solution function definition is preserved. The async main() and
 * readline infrastructure is replaced with the multi-TC wrapper.
 */
function buildJavaScriptMultiTestCase(combinedCode: string): MultiTestCaseBuildResult | null {
  // The JS boilerplate from languageConfigs.ts has a clear pattern:
  //   [USER CODE PLACEHOLDER / user code]
  //   async function main() { ... readline ... solution(...) ... }
  //   main().catch(...)
  //
  // We need to extract just the user code (before `async function main`)
  // and replace the rest with the multi-TC wrapper.

  // Try to find the async main function boundary
  const mainFnRegex = /^async\s+function\s+main\s*\(\s*\)/m;
  const match = combinedCode.match(mainFnRegex);

  if (!match || match.index === undefined) {
    // No async function main() found — try alternate patterns
    // Some JS boilerplates might use different structure
    return null;
  }

  // Everything before async function main() = user code + any imports
  const userCodeSection = combinedCode.substring(0, match.index).trimEnd();

  const finalCode = `${userCodeSection}\n${JS_WRAPPER_PREFIX}`;
  const userCodeLineOffset = 0;

  return { code: finalCode, userCodeLineOffset };
}

// ─── Stdin packing ───────────────────────────────────────────────────────────

/**
 * Packs all test cases into a single stdin payload for multi-test-case execution.
 * Each test case's stdin is parsed from JSON and collected into an array.
 */
export function packTestCasesIntoStdin(testCases: TestCase[]): string {
  const parsedTestCases = testCases.map(tc => {
    try {
      return JSON.parse(tc.stdin);
    } catch {
      // If stdin is not valid JSON, pass as raw string
      return tc.stdin;
    }
  });

  return JSON.stringify({ test_cases: parsedTestCases });
}

// ─── Output parsing ──────────────────────────────────────────────────────────

/**
 * Parses the structured JSON output from multi-test-case execution.
 * Handles partial output when the process was killed mid-execution (TLE/MLE).
 */
export function parseMultiTestCaseOutput(
  stdout: string | null | undefined,
  stderr: string | null | undefined,
  expectedCount: number
): ParsedMultiTestCaseOutput {
  if (!stdout || !stdout.trim()) {
    return {
      results: [],
      parseError: stderr || 'No output produced',
    };
  }

  const trimmed = stdout.trim();

  // Try full JSON parse first
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && Array.isArray(parsed.results)) {
      return { results: parsed.results, parseError: null };
    }
    return { results: [], parseError: 'Output missing "results" array' };
  } catch {
    // JSON parse failed — try to salvage partial results from truncated output
    const partialResults = extractPartialResults(trimmed);
    if (partialResults.length > 0) {
      return {
        results: partialResults,
        parseError: `Output was truncated. Recovered ${partialResults.length}/${expectedCount} results.`,
      };
    }
    return {
      results: [],
      parseError: `Failed to parse output: ${trimmed.substring(0, 200)}`,
    };
  }
}

/**
 * Attempts to extract individual test case results from truncated JSON output.
 * This handles the case where the process was killed mid-execution (TLE/MLE)
 * and the output JSON is incomplete.
 */
function extractPartialResults(truncatedOutput: string): ParsedTestCaseResult[] {
  const results: ParsedTestCaseResult[] = [];

  // Try to find individual result objects in the truncated output
  // Pattern: {"i":0,"o":...,"t":...,"s":"ok","e":null}
  const resultPattern = /\{"i":\d+,"o":.*?,"t":\d+\.?\d*,"s":"(?:ok|err)","e":(?:null|"[^"]*")\}/g;
  let match;

  while ((match = resultPattern.exec(truncatedOutput)) !== null) {
    try {
      const result = JSON.parse(match[0]);
      results.push(result);
    } catch {
      // Skip malformed results
    }
  }

  // If regex approach didn't work, try splitting by the index pattern
  if (results.length === 0) {
    // Look for complete objects between {"i": markers
    const objectStarts: number[] = [];
    const searchStr = '{"i":';
    let searchIdx = 0;
    while ((searchIdx = truncatedOutput.indexOf(searchStr, searchIdx)) !== -1) {
      objectStarts.push(searchIdx);
      searchIdx += searchStr.length;
    }

    for (let i = 0; i < objectStarts.length; i++) {
      const start = objectStarts[i];
      const end = i + 1 < objectStarts.length
        ? objectStarts[i + 1]
        : truncatedOutput.length;
      const segment = truncatedOutput.substring(start, end).replace(/,\s*$/, '');

      try {
        const result = JSON.parse(segment);
        if (typeof result.i === 'number' && typeof result.s === 'string') {
          results.push(result);
        }
      } catch {
        // Skip incomplete segments
      }
    }
  }

  return results;
}

// ─── Error line number adjustment ────────────────────────────────────────────

/**
 * Adjusts line numbers in error stack traces to match the user's original code.
 * Subtracts the offset (wrapper + boilerplate lines before user code) from
 * any line numbers found in the error output.
 */
export function adjustErrorLineNumbers(
  errorText: string | null | undefined,
  offset: number,
  language: string
): string | null {
  if (!errorText || offset === 0) return errorText ?? null;

  switch (language) {
    case 'python':
      return adjustPythonLineNumbers(errorText, offset);
    case 'javascript':
      return adjustJavaScriptLineNumbers(errorText, offset);
    default:
      return errorText;
  }
}

/**
 * Adjusts Python traceback line numbers.
 * Pattern: "line 42" in "File ..., line 42, in ..."
 */
function adjustPythonLineNumbers(errorText: string, offset: number): string {
  return errorText.replace(
    /(?<=line\s)\d+/g,
    (match) => {
      const lineNum = parseInt(match, 10);
      const adjusted = lineNum - offset;
      return adjusted > 0 ? String(adjusted) : match;
    }
  );
}

/**
 * Adjusts JavaScript error line numbers.
 * Pattern: "filename:42" in stack traces
 */
function adjustJavaScriptLineNumbers(errorText: string, offset: number): string {
  return errorText.replace(
    /(?<=:)\d+(?=:\d+\)?)/g,
    (match) => {
      const lineNum = parseInt(match, 10);
      const adjusted = lineNum - offset;
      return adjusted > 0 ? String(adjusted) : match;
    }
  );
}

// ─── Python indentation helpers ──────────────────────────────────────────────

/**
 * Removes the common leading indentation from a block of Python code.
 * This is used to extract the main body from inside `if __name__:` and
 * prepare it for re-indentation inside the wrapper's try block.
 */
function dedentPython(code: string): string {
  const lines = code.split('\n');

  // Find the minimum indentation among non-empty lines
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length ?? 0;
    if (leadingSpaces < minIndent) {
      minIndent = leadingSpaces;
    }
  }

  if (minIndent === Infinity || minIndent === 0) {
    return code;
  }

  return lines
    .map(line => {
      if (line.trim().length === 0) return '';
      return line.substring(minIndent);
    })
    .join('\n');
}

/**
 * Adds the specified number of spaces of indentation to each non-empty line.
 */
function indentPython(code: string, spaces: number): string {
  const indent = ' '.repeat(spaces);
  return code
    .split('\n')
    .map(line => (line.trim().length === 0 ? '' : indent + line))
    .join('\n');
}
