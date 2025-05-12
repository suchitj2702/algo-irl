# Refactoring Code Execution for User-Focused Solutions

## 1. Overview

The current code execution system requires users to write significant boilerplate (e.g., tree construction, input parsing wrappers) in addition to the core algorithmic solution. This project aims to refactor the system so that users only need to focus on implementing the specified function or class, similar to platforms like LeetCode.

This will be achieved by:
1.  Storing problem-specific boilerplate code and refined test cases in the database (Firestore).
2.  Modifying the backend to combine user-submitted solution code with this boilerplate before sending it to the execution engine (Judge0).
3.  Updating the frontend example page to fetch problems and their components (starter code, test case info) from the database.

## 2. Detailed Plan

### Phase 1: Database Schema Definition and Data Migration Strategy

**Goal:** Define a robust Firestore schema for problems that separates boilerplate, user solution, and test cases, and plan for migrating existing/example problems.

**Tasks:**

1.  **Define/Refine Firestore Problem Schema:**
    *   A `problems` collection where each document represents a coding problem.
    *   **Key fields per problem document:**
        *   `problemId`: (string) Unique identifier.
        *   `title`: (string) Problem name (e.g., "Binary Tree Level Order Traversal").
        *   `description`: (string, Markdown supported) Detailed problem statement. This *must* clearly specify:
            *   The expected function signature or class structure the user needs to implement.
            *   Any helper classes/structs provided (e.g., `TreeNode`).
            *   Input format for the core function/method.
            *   Expected output format from the core function/method.
        *   `difficulty`: (string) e.g., "Easy", "Medium", "Hard".
        *   `tags`: (array of strings) e.g., ["Trees", "BFS", "Data Structures"].
        *   `constraints`: (string, Markdown supported) e.g., "Node values are between -100 and 100."
        *   `languageSpecificDetails`: (map) Keys are language identifiers (e.g., "python", "javascript", "java").
            *   `[language_code]: {`
                *   `solutionFunctionNameOrClassName`: (string) The name of the function or class the user implements (e.g., "levelOrder", "LRUCache").
                *   `solutionStructureHint`: (string) A display string for the user, e.g., "Python: `def levelOrder(self, root: Optional[TreeNode]) -> List[List[int]]:`".
                *   `boilerplateCodeWithPlaceholder`: (string) The complete runnable code for Judge0, including all necessary imports, helper class definitions (like `TreeNode` if not user's task to define), and a driver section. This code will contain a distinct placeholder (e.g., `%%USER_CODE_PYTHON%%`, `%%USER_CODE_JAVASCRIPT%%`) where the user's solution will be injected. The driver section will:
                    1.  Parse `stdin` (which will be a JSON string for structured inputs).
                    2.  Prepare arguments for the user's function/class.
                    3.  Invoke the user's function/class.
                    4.  Serialize the result to a JSON string and print to `stdout`.
                *   `defaultUserCode`: (string) The initial skeleton code provided to the user in the editor (e.g., function definition with `pass` or basic class structure). This is the "reference solution" part.
            *   `}`
        *   `testCases`: (array of maps) Judge0-compatible test cases.
            *   `{`
                *   `name`: (string, optional) e.g., "Sample Case 1", "Hidden Case 3".
                *   `stdin`: (string) Input string fed to the combined (boilerplate + user) code via standard input. For structured inputs (like trees, arrays, custom objects), this will be a JSON string.
                *   `expectedStdout`: (string) The exact expected standard output. For structured outputs, this will also be a JSON string.
                *   `isSample`: (boolean) If true, this test case (input, expected output, explanation) can be shown to the user on the problem page.
                *   `explanation`: (string, optional, Markdown supported) Explanation for sample test cases.
                *   `maxCpuTimeLimit`: (number, optional) Seconds for this specific test case.
                *   `maxMemoryLimit`: (number, optional) MB for this specific test case.
            *   `}`

2.  **Data Migration/Population Strategy:**
    *   Identify initial set of problems (e.g., from `app/examples/code-execution/page.tsx`).
    *   For each problem and each supported language:
        *   Manually separate the existing full solution into:
            *   `defaultUserCode` (the core logic).
            *   `boilerplateCodeWithPlaceholder` (the surrounding driver, imports, helper classes, and placeholder).
        *   Update the `description` to reflect the new user expectation.
        *   Transform existing `testCases` into the new `stdin`/`expectedStdout` JSON format.
        *   Create a script or manually populate Firestore with these structured problem documents.

3.  **Update LLM Interaction for Problem Generation:**
    *   Analyze existing prompts/logic used to interact with the LLM (e.g., in `anthropicService.ts` or related utilities) for generating problem data.
    *   Modify prompts to instruct the LLM to generate content for the new and updated fields in the `Problem` schema, specifically:
        *   `description`: Ensure it includes hints about the expected function/class signature.
        *   `languageSpecificDetails` (for each target language, starting with Python):
            *   `solutionFunctionNameOrClassName`
            *   `solutionStructureHint`
            *   `defaultUserCode` (the core, user-focused solution)
            *   `boilerplateCodeWithPlaceholder` (the driver code with the `%%USER_CODE_LANG%%` placeholder)
        *   `testCases`: Ensure `stdin` and `expectedStdout` are generated as JSON strings.
        *   Language-agnostic fields like `solutionApproach`, `timeComplexity`, `spaceComplexity`.
    *   Adjust any parsing logic that consumes the LLM's output to correctly map to the new schema.
    *   Test the updated LLM interaction to ensure it reliably generates data in the correct new format for at least one example problem.

### Phase 2: Backend API and Code Execution Logic Update

**Goal:** Modify backend services to fetch problem details from Firestore and correctly combine user code with boilerplate for execution.

**Tasks:**

1.  **Create/Update Problem API Endpoints:**
    *   `/api/problems`: GET endpoint to list available problems (fetching `problemId`, `title`, `difficulty`, `tags`).
    *   `/api/problems/{problemId}`: GET endpoint to fetch detailed data for a specific problem, including `description`, `constraints`, `languageSpecificDetails` (for a requested language or all), and sample `testCases`.

2.  **Modify Code Execution Endpoint (`/api/execute-code/route.ts`):**
    *   Accept `problemId`, `language`, and `userCode` (the user's solution part only).
    *   **Workflow:**
        1.  Fetch the `languageSpecificDetails` and all `testCases` for the given `problemId` and `language` from Firestore.
        2.  Retrieve `boilerplateCodeWithPlaceholder`.
        3.  Construct the `fullCodeToExecute` by replacing the placeholder in `boilerplateCodeWithPlaceholder` with the `userCode`.
        4.  Prepare the batch submission for Judge0:
            *   For each `testCase` from Firestore:
                *   `source_code`: `fullCodeToExecute`
                *   `language_id`: Map our `language` string to Judge0's language ID.
                *   `stdin`: `testCase.stdin`
                *   `expected_output`: `testCase.expectedStdout`
                *   `cpu_time_limit`: `testCase.maxCpuTimeLimit` or global default.
                *   `memory_limit`: `testCase.maxMemoryLimit` or global default.
        5.  Submit to Judge0 and handle the callback/polling logic as currently implemented, but now results will be per Firestore test case.
        6.  The `ExecutionResults` returned to the frontend should map back to the `testCases` from Firestore (e.g., indicating which named test case passed/failed).

### Phase 3: Frontend Refactor (`app/examples/code-execution/page.tsx`)

**Goal:** Update the example page to be a dynamic client for the new backend, fetching problems and submitting user-only solutions.

**Tasks:**

1.  **Fetch Problems and Problem Details:**
    *   Remove the hardcoded `problems` array.
    *   On component mount, call `/api/problems` to populate the `ProblemSelector`.
    *   When a problem is selected:
        *   Call `/api/problems/{problemId}` (potentially with a language parameter) to get all details.
        *   Update the display with `description`, `constraints`, sample `testCases` (input, expected output, explanation).

2.  **Update Code Editor and Language Selection:**
    *   When a problem and language are selected, populate the `CodeEditor` with `defaultUserCode` for that language from the fetched problem data.
    *   The `description` and `solutionStructureHint` should guide the user on what to write.

3.  **Update Test Case Display:**
    *   Display sample `testCases` (input, expected output, explanation) fetched from the backend.

4.  **Modify Code Submission (`handleExecute`):**
    *   Collect `userCode` from the `CodeEditor`.
    *   Send `problemId`, `language`, and `userCode` to the `/api/execute-code` endpoint.
    *   The results display will need to be adapted to show outcomes for the named/structured test cases from Firestore.

### Phase 4: Testing and Refinement

**Goal:** Ensure the end-to-end system works correctly and is robust.

**Tasks:**

1.  **End-to-End Testing:**
    *   Test with multiple problems (LRU Cache, Two Sum, Binary Tree Level Order Traversal, etc.) across different languages (Python, JavaScript, Java if supported).
    *   Verify:
        *   Correct problem data fetching and display.
        *   Correct `defaultUserCode` population.
        *   Proper combination of `userCode` with `boilerplateCodeWithPlaceholder`.
        *   Accurate test case execution via Judge0 using the `stdin`/`expectedStdout` from Firestore.
        *   Correct reporting of results per test case.
        *   Handling of compilation errors, runtime errors, TLE, MLE.

2.  **Usability Testing:**
    *   Ensure the problem `description` and `solutionStructureHint` are clear enough for users to understand what code to write.
    *   Verify the `defaultUserCode` provides a good starting point.

3.  **Documentation Review:**
    *   Update `@repository_documentation.md` with the new architecture.
    *   Ensure Firestore schema and API endpoints are well-documented internally.

## 3. Example Transformation: Binary Tree Level Order Traversal (Python)

*   **User is expected to implement (this is what `defaultUserCode` would look like initially, perhaps with `pass`):**
    ```python
    # from typing import List, Optional
    # Definition for a binary tree node.
    # class TreeNode:
    #     def __init__(self, val=0, left=None, right=None):
    #         self.val = val
    #         self.left = left
    #         self.right = right

    def levelOrder(root) -> list[list[int]]:
        # User's core logic here
        pass
    ```
*   **`languageSpecificDetails.python.defaultUserCode` (populated with a working solution for the user to start with or see):**
    ```python
    # from typing import List, Optional
    # Definition for a binary tree node.
    # class TreeNode:
    #     def __init__(self, val=0, left=None, right=None):
    #         self.val = val
    #         self.left = left
    #         self.right = right
    def levelOrder(root) -> list[list[int]]:
        if not root:
            return []
        
        import collections # Assuming collections is available
        result = []
        queue = collections.deque([root])
        
        while queue:
            level_size = len(queue)
            current_level = []
            for _ in range(level_size):
                node = queue.popleft()
                current_level.append(node.val)
                if node.left:
                    queue.append(node.left)
                if node.right:
                    queue.append(node.right)
            result.append(current_level)
        return result
    ```
*   **`languageSpecificDetails.python.boilerplateCodeWithPlaceholder`:**
    ```python
    from typing import List, Optional # Make sure these are compatible with Judge0 Python version
    import collections
    import json
    import sys

    class TreeNode:
        def __init__(self, val=0, left=None, right=None):
            self.val = val
            self.left = left
            self.right = right

    def _build_tree_from_array(arr: list) -> Optional[TreeNode]:
        if not arr or arr[0] is None: return None # Adjusted for empty or [null] initial arrays
        nodes = [None if val is None else TreeNode(val) for val in arr]
        
        # Link children; LeetCode often uses a BFS-like approach for array to tree
        # This is a common way to build it:
        head = nodes[0]
        queue = collections.deque([head])
        idx = 1
        while queue and idx < len(nodes):
            node = queue.popleft()
            if node: # Only try to assign children if parent is not None
                if idx < len(nodes) and nodes[idx] is not None:
                    node.left = nodes[idx]
                    queue.append(node.left)
                idx += 1
                if idx < len(nodes) and nodes[idx] is not None:
                    node.right = nodes[idx]
                    queue.append(node.right)
                idx += 1
        return head


    # %%USER_CODE_PYTHON%% 
    # This placeholder will be replaced by the user's levelOrder function.

    if __name__ == '__main__':
        try:
            input_json = sys.stdin.read()
            input_data = json.loads(input_json)
            
            # Problem-specific input key, e.g. "root" for array representation of a tree
            # Handles if input is {"root": [data]} or just [data]
            tree_array_input = input_data.get("root") 
            if tree_array_input is None and isinstance(input_data, list):
                tree_array_input = input_data


            actual_tree_root_node = _build_tree_from_array(tree_array_input)
            
            # Assuming user's function is named 'levelOrder' as per solutionFunctionNameOrClassName
            # This name would be dynamically known or a convention.
            output = levelOrder(actual_tree_root_node) 
            
            print(json.dumps(output))
        except Exception as e:
            # Print error to stderr for Judge0 to capture as compile/runtime error
            print(f"Execution Error: {str(e)}", file=sys.stderr) # Ensure error is string
            sys.exit(1) # Exit with non-zero status
    ```
*   **`testCases[0].stdin`:** `{"root": [3,9,20,null,null,15,7]}`
*   **`testCases[0].expectedStdout`:** `[[3],[9,20],[15,7]]`
*   Alternative `testCases[0].stdin` (if just array): `[3,9,20,null,null,15,7]` (boilerplate handles this)

## 4. Considerations

*   **Placeholder Strategy:** The placeholder (e.g., `%%USER_CODE_PYTHON%%`) needs to be unique and consistently applied.
*   **Error Handling in Boilerplate:** The driver code in the boilerplate should include robust try-catch blocks to report execution errors (compilation, runtime) to Judge0 effectively (e.g., print to stderr, exit with non-zero code).
*   **Language Versions & Imports:** Ensure compatibility of boilerplate code (imports, syntax) with Judge0's supported language versions. Common libraries (like `collections` in Python) are usually available.
*   **Security:** While Judge0 provides sandboxing, ensure that the process of combining user code with boilerplate does not inadvertently create ways to bypass safeguards.
*   **Complexity of Boilerplate:** For problems with complex input/output structures (e.g., graphs, custom classes passed as arguments), the boilerplate for parsing `stdin` and setting up the call to the user's solution can become intricate. This requires careful design per problem type or a very flexible boilerplate templating system.
*   **Class-based vs. Function-based Solutions:** The schema (`solutionFunctionNameOrClassName`, `solutionStructureHint`) and boilerplate strategy must accommodate both scenarios (e.g., user implements a full class like `LRUCache` vs. a single function like `twoSum`).
*   **Type Hinting/Annotations:** For languages like Python, providing type hints in `defaultUserCode` and `solutionStructureHint` is good practice. Ensure they are compatible with the Judge0 environment or are stripped if necessary (though modern Pythons handle them fine).

This plan provides a comprehensive approach to achieving the desired user experience for code execution. 