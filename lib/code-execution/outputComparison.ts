/**
 * Intelligent output comparison that handles various data formats.
 *
 * Algorithm:
 * 1. Normalize inputs by trimming whitespace
 * 2. Handle empty string cases
 * 3. Attempt JSON parsing for structured data comparison
 * 4. Fall back to string comparison for non-JSON data
 */
function normalizeAndCompareOutputs(actual: string | null | undefined, expected: string | null | undefined): boolean {
  const normalizedActual = actual?.trim() ?? "";
  const normalizedExpected = expected?.trim() ?? "";

  if (normalizedActual === "" && normalizedExpected === "") return true;
  if (normalizedActual === "" || normalizedExpected === "") return false;

  try {
    const parsedActual = JSON.parse(normalizedActual);
    const parsedExpected = JSON.parse(normalizedExpected);
    return JSON.stringify(parsedActual) === JSON.stringify(parsedExpected);
  } catch {
    return normalizedActual === normalizedExpected;
  }
}

/**
 * Handles test cases with multiple valid expected outputs.
 * Some problems may have multiple correct answers, stored as a JSON array.
 */
function checkMultipleExpectedOutputs(actual: string | null | undefined, expected: string | null | undefined): boolean {
  const normalizedActual = actual?.trim() ?? "";
  const normalizedExpectedString = expected?.trim() ?? "";

  if (!normalizedExpectedString.startsWith('[') || !normalizedExpectedString.endsWith(']')) {
    return false;
  }

  let parsedActual = normalizedActual;
  try {
    if (normalizedActual.startsWith('"') && normalizedActual.endsWith('"')) {
      parsedActual = JSON.parse(normalizedActual);
    }
  } catch {
    parsedActual = normalizedActual;
  }

  try {
    const expectedOutputsArray = JSON.parse(normalizedExpectedString);
    if (!Array.isArray(expectedOutputsArray)) return false;

    for (const singleExpected of expectedOutputsArray) {
      const singleExpectedStr = typeof singleExpected === 'string' ? singleExpected : JSON.stringify(singleExpected);
      if (normalizeAndCompareOutputs(parsedActual, singleExpectedStr)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Compares arrays where element order doesn't matter.
 * Used for problems where the solution can return elements in any order.
 */
function compareUnorderedStringArrays(actual: string | null | undefined, expected: string | null | undefined): boolean {
  const actualStr = actual?.trim() ?? "";
  const expectedStr = expected?.trim() ?? "";

  if (!actualStr.startsWith('[') || !actualStr.endsWith(']') ||
      !expectedStr.startsWith('[') || !expectedStr.endsWith(']')) {
    return false;
  }

  try {
    const actualArray = JSON.parse(actualStr);
    const expectedArray = JSON.parse(expectedStr);

    if (!Array.isArray(actualArray) || !Array.isArray(expectedArray)) return false;
    if (actualArray.length !== expectedArray.length) return false;
    if (actualArray.length === 0) return true;

    const sortedActual = actualArray.map(String).sort();
    const sortedExpected = expectedArray.map(String).sort();

    for (let i = 0; i < sortedActual.length; i++) {
      if (sortedActual[i] !== sortedExpected[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Compares nested arrays where both outer and inner array order doesn't matter.
 * Used for complex problems returning arrays of arrays (e.g., graph problems, combinations).
 */
function compareUnorderedArraysOfArrays(actual: string | null | undefined, expected: string | null | undefined): boolean {
  const actualStr = actual?.trim() ?? "";
  const expectedStr = expected?.trim() ?? "";

  if (!actualStr.startsWith('[') || !actualStr.endsWith(']') ||
      !expectedStr.startsWith('[') || !expectedStr.endsWith(']')) {
    return false;
  }

  try {
    const actualOuterArray = JSON.parse(actualStr);
    const expectedOuterArray = JSON.parse(expectedStr);

    if (!Array.isArray(actualOuterArray) || !Array.isArray(expectedOuterArray)) return false;
    if (actualOuterArray.length !== expectedOuterArray.length) return false;
    if (actualOuterArray.length === 0) return true;

    const getCanonicalInnerArrayString = (innerArray: unknown): string | null => {
      if (!Array.isArray(innerArray)) return null;
      const sortedInnerArray = [...innerArray].sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
      });
      return JSON.stringify(sortedInnerArray);
    };

    const canonicalActualStrings = actualOuterArray.map(getCanonicalInnerArrayString);
    const canonicalExpectedStrings = expectedOuterArray.map(getCanonicalInnerArrayString);

    if (canonicalActualStrings.some(s => s === null) || canonicalExpectedStrings.some(s => s === null)) {
      return false;
    }

    const filteredActualStrings = canonicalActualStrings.filter(s => s !== null) as string[];
    const filteredExpectedStrings = canonicalExpectedStrings.filter(s => s !== null) as string[];

    if (filteredActualStrings.length !== actualOuterArray.length || filteredExpectedStrings.length !== expectedOuterArray.length) {
      return false;
    }

    filteredActualStrings.sort();
    filteredExpectedStrings.sort();

    for (let i = 0; i < filteredActualStrings.length; i++) {
      if (filteredActualStrings[i] !== filteredExpectedStrings[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Single entry point: compares actual vs expected output using multiple strategies.
 * Returns true if any comparison strategy finds a match.
 */
export function compareOutputs(actual: string | null | undefined, expected: string | null | undefined): boolean {
  return (
    normalizeAndCompareOutputs(actual, expected) ||
    checkMultipleExpectedOutputs(actual, expected) ||
    compareUnorderedStringArrays(actual, expected) ||
    compareUnorderedArraysOfArrays(actual, expected)
  );
}
