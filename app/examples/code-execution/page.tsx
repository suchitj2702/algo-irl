'use client';

import { useState, useEffect } from 'react';
import type { TestCase } from '../../../data-types/problem';
import type { ExecutionResults } from '../../../data-types/execution';
import { CodeEditor } from '../../../components/code-editor';
import { LanguageSelector } from '../../../components/code-editor';

// Define problem types
type ProblemType = {
  id: string;
  name: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  testCases: TestCase[];
  solutions: Record<string, string>;
};

// Collection of problems with different input/output patterns
const problems: ProblemType[] = [
  {
    id: 'lru-cache',
    name: 'LRU Cache',
    description: `Design and implement a data structure for Least Recently Used (LRU) cache.
    It should support the following operations: get and put.
    
    LRUCache(int capacity): Initialize the LRU cache with positive capacity.
    int get(int key): Return the value of the key if the key exists, otherwise return -1.
    void put(int key, int value): Update the value of the key if it exists. Otherwise, add the key-value pair.
    If the capacity is reached, remove the least recently used key.`,
    difficulty: 'Medium',
    testCases: [
      {
        input: {
          commands: ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"],
          values: [[2], [1, 10], [2, 20], [1], [3, 30], [2], [4, 40], [1], [3], [4]]
        },
        output: [null, null, null, 10, null, -1, null, -1, 30, 40],
        explanation: "Capacity 2. put(1,10), put(2,20), get(1)->10. put(3,30) (evicts 2). get(2)->-1. put(4,40) (evicts 1). get(1)->-1. get(3)->30. get(4)->40."
      },
      {
        input: {
          commands: ["LRUCache","put","put","put","put","get","get"],
          values: [[2],[2,1],[1,1],[2,3],[4,1],[1],[2]]
        },
        output: [null,null,null,null,null,-1,3],
        explanation: "Capacity 2. Series of puts and gets with updates and evictions."
      }
    ],
    solutions: {
      javascript: `class DLinkedNode {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
    this.head = new DLinkedNode(0, 0);
    this.tail = new DLinkedNode(0, 0);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  _removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  _addToHead(node) {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next.prev = node;
    this.head.next = node;
  }

  get(key) {
    if (!this.map.has(key)) return -1;
    const node = this.map.get(key);
    this._removeNode(node);
    this._addToHead(node);
    return node.value;
  }

  put(key, value) {
    if (this.map.has(key)) {
      const node = this.map.get(key);
      node.value = value;
      this._removeNode(node);
      this._addToHead(node);
    } else {
      if (this.map.size === this.capacity) {
        const tail = this.tail.prev;
        this._removeNode(tail);
        this.map.delete(tail.key);
      }
      const newNode = new DLinkedNode(key, value);
      this.map.set(key, newNode);
      this._addToHead(newNode);
    }
  }
}

function solution(input) {
  const commands = input.commands;
  const values = input.values;
  const results = [];
  let cache = null;
  
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const val = values[i];
    
    if (cmd === "LRUCache") {
      cache = new LRUCache(val[0]);
      results.push(null);
    } else if (cmd === "put") {
      cache.put(val[0], val[1]);
      results.push(null);
    } else if (cmd === "get") {
      results.push(cache.get(val[0]));
    } else {
      results.push(null);
    }
  }
  
  return results;
}`,
      python: `# LRU Cache Implementation for the Code Execution Platform

class DLinkedNode:
    def __init__(self, key=0, value=0):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None

class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = {}  # Maps key to DLinkedNode
        
        # Dummy head and tail
        self.head = DLinkedNode()
        self.tail = DLinkedNode()
        self.head.next = self.tail
        self.tail.prev = self.head

    def _remove_node(self, node: DLinkedNode):
        if node.prev and node.next: # Basic check
            node.prev.next = node.next
            node.next.prev = node.prev

    def _add_to_head(self, node: DLinkedNode):
        node.next = self.head.next
        node.prev = self.head
        self.head.next.prev = node
        self.head.next = node

    def get(self, key: int) -> int:
        if key in self.cache:
            node = self.cache[key]
            self._remove_node(node)
            self._add_to_head(node)
            return node.value
        return -1

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            node = self.cache[key]
            node.value = value
            self._remove_node(node)
            self._add_to_head(node)
        else:
            if len(self.cache) == self.capacity:
                lru_node = self.tail.prev
                if lru_node != self.head: # Make sure we don't try to remove head
                    self._remove_node(lru_node)
                    del self.cache[lru_node.key]
            
            if self.capacity > 0: # Only add if capacity allows
                new_node = DLinkedNode(key, value)
                self.cache[key] = new_node
                self._add_to_head(new_node)

def solution(commands, values):
    lru_cache_instance = None
    results = []

    for i in range(len(commands)):
        command = commands[i]
        current_params = values[i]
        operation_result = None  # Default for 'get'

        if command == "LRUCache":
            lru_cache_instance = LRUCache(*current_params)
            results.append(None)
        elif command == "put":
            if lru_cache_instance:
                lru_cache_instance.put(*current_params)
            results.append(None)
        elif command == "get":
            if lru_cache_instance:
                operation_result = lru_cache_instance.get(*current_params)
            else:
                operation_result = -1 # Cache not initialized
            results.append(operation_result)
        else:
            # Handle unknown command if necessary, though test data should be valid
            results.append(None)
            
    return results`,
      java: `// LRU Cache Class for Java

import java.util.HashMap;
import java.util.Map;

class LRUCache {
    private class DLinkedNode {
        int key;
        int value;
        DLinkedNode prev;
        DLinkedNode next;

        DLinkedNode() {}
        DLinkedNode(int key, int value) {
            this.key = key;
            this.value = value;
        }
    }

    private final Map<Integer, DLinkedNode> cache = new HashMap<>();
    private int size;
    private final int capacity;
    private final DLinkedNode head; // Dummy head
    private final DLinkedNode tail; // Dummy tail

    private void addNodeToHead(DLinkedNode node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    private void removeNode(DLinkedNode node) {
        if (node == null || node.prev == null || node.next == null) return;
        DLinkedNode prevNode = node.prev;
        DLinkedNode nextNode = node.next;
        prevNode.next = nextNode;
        nextNode.prev = prevNode;
    }

    private void moveToHead(DLinkedNode node) {
        removeNode(node);
        addNodeToHead(node);
    }

    private DLinkedNode popTail() {
        if (tail.prev == head) return null; // Cache is empty
        DLinkedNode res = tail.prev;
        removeNode(res);
        return res;
    }

    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.size = 0;
        this.head = new DLinkedNode();
        this.tail = new DLinkedNode();
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    public int get(int key) {
        DLinkedNode node = cache.get(key);
        if (node == null) {
            return -1;
        }
        moveToHead(node);
        return node.value;
    }

    public void put(int key, int value) {
        if (this.capacity == 0) return; // Cannot put anything if capacity is 0

        DLinkedNode node = cache.get(key);
        if (node == null) {
            DLinkedNode newNode = new DLinkedNode(key, value);
            cache.put(key, newNode);
            addNodeToHead(newNode);
            size++;
            if (size > capacity) {
                DLinkedNode tailNode = popTail();
                if (tailNode != null) {
                    cache.remove(tailNode.key);
                    size--;
                }
            }
        } else {
            node.value = value;
            moveToHead(node);
        }
    }
}`
    }
  },
  {
    id: 'two-sum',
    name: 'Two Sum',
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
    You may assume that each input would have exactly one solution, and you may not use the same element twice.
    You can return the answer in any order.`,
    difficulty: 'Easy',
    testCases: [
      {
        input: {
          nums: [2, 7, 11, 15],
          target: 9
        },
        output: [0, 1],
        explanation: "nums[0] + nums[1] = 2 + 7 = 9"
      },
      {
        input: {
          nums: [3, 2, 4],
          target: 6
        },
        output: [1, 2],
        explanation: "nums[1] + nums[2] = 2 + 4 = 6"
      },
      {
        input: {
          nums: [3, 3],
          target: 6
        },
        output: [0, 1],
        explanation: "nums[0] + nums[1] = 3 + 3 = 6"
      }
    ],
    solutions: {
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function solution(input) {
    const { nums, target } = input;
    const map = new Map();
    
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement), i];
        }
        map.set(nums[i], i);
    }
    
    return []; // No solution found
}`,
      python: `def solution(nums, target):
    num_map = {}  # value -> index
    
    for i, num in enumerate(nums):
        complement = target - num
        if complement in num_map:
            return [num_map[complement], i]
        num_map[num] = i
    
    return []  # No solution found`,
      java: `import java.util.HashMap;
import java.util.Map;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        
        return new int[0]; // No solution found
    }
}`
    }
  },
  {
    id: 'rotate-matrix',
    name: 'Rotate Image (Matrix)',
    description: `You are given an n x n 2D matrix representing an image. Rotate the image by 90 degrees (clockwise).
    You have to rotate the image in-place, which means you have to modify the input 2D matrix directly.
    DO NOT allocate another 2D matrix and do the rotation.`,
    difficulty: 'Medium',
    testCases: [
      {
        input: {
          matrix: [[1,2,3],[4,5,6],[7,8,9]]
        },
        output: [[7,4,1],[8,5,2],[9,6,3]],
        explanation: "Rotate the matrix [[1,2,3],[4,5,6],[7,8,9]] by 90 degrees clockwise."
      },
      {
        input: {
          matrix: [[5,1,9,11],[2,4,8,10],[13,3,6,7],[15,14,12,16]]
        },
        output: [[15,13,2,5],[14,3,4,1],[12,6,8,9],[16,7,10,11]],
        explanation: "Rotate the 4x4 matrix by 90 degrees clockwise."
      }
    ],
    solutions: {
      javascript: `/**
 * @param {number[][]} matrix
 * @return {void} Do not return anything, modify matrix in-place instead.
 */
function solution(input) {
    const { matrix } = input;
    const n = matrix.length;
    
    // Transpose matrix (swap rows with columns)
    for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
            const temp = matrix[i][j];
            matrix[i][j] = matrix[j][i];
            matrix[j][i] = temp;
        }
    }
    
    // Reverse each row
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n / 2; j++) {
            const temp = matrix[i][j];
            matrix[i][j] = matrix[i][n - 1 - j];
            matrix[i][n - 1 - j] = temp;
        }
    }
    
    return matrix; // Return matrix for test validation, though in a real LeetCode environment this is an in-place operation
}`,
      python: `def solution(matrix):
    n = len(matrix)
    
    # Transpose matrix (swap rows with columns)
    for i in range(n):
        for j in range(i, n):
            matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]
    
    # Reverse each row
    for i in range(n):
        matrix[i] = matrix[i][::-1]
    
    return matrix  # Return for test validation`,
      java: `class Solution {
    public void rotate(int[][] matrix) {
        int n = matrix.length;
        
        // Transpose matrix (swap rows with columns)
        for (int i = 0; i < n; i++) {
            for (int j = i; j < n; j++) {
                int temp = matrix[i][j];
                matrix[i][j] = matrix[j][i];
                matrix[j][i] = temp;
            }
        }
        
        // Reverse each row
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n / 2; j++) {
                int temp = matrix[i][j];
                matrix[i][j] = matrix[i][n - 1 - j];
                matrix[i][n - 1 - j] = temp;
            }
        }
    }
}`
    }
  },
  {
    id: 'valid-palindrome',
    name: 'Valid Palindrome',
    description: `Given a string s, determine if it is a palindrome, considering only alphanumeric characters and ignoring cases.
    Return true if the string is a palindrome, false otherwise.`,
    difficulty: 'Easy',
    testCases: [
      {
        input: {
          s: "A man, a plan, a canal: Panama"
        },
        output: true,
        explanation: "After removing non-alphanumeric characters and converting to lowercase, it reads 'amanaplanacanalpanama', which is a palindrome."
      },
      {
        input: {
          s: "race a car"
        },
        output: false,
        explanation: "After processing, it reads 'raceacar', which is not a palindrome."
      },
      {
        input: {
          s: " "
        },
        output: true,
        explanation: "After processing, the string is empty, which is considered a palindrome."
      }
    ],
    solutions: {
      javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
function solution(input) {
    const { s } = input;
    // Remove non-alphanumeric chars and convert to lowercase
    const cleaned = s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    // Check if palindrome
    let left = 0;
    let right = cleaned.length - 1;
    
    while (left < right) {
        if (cleaned[left] !== cleaned[right]) {
            return false;
        }
        left++;
        right--;
    }
    
    return true;
}`,
      python: `def solution(s):
    # Remove non-alphanumeric chars and convert to lowercase
    cleaned = ''.join(char.lower() for char in s if char.isalnum())
    
    # Check if palindrome
    return cleaned == cleaned[::-1]`,
      java: `class Solution {
    public boolean isPalindrome(String s) {
        // Convert to lowercase and remove non-alphanumeric chars
        String cleaned = s.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
        
        int left = 0;
        int right = cleaned.length() - 1;
        
        while (left < right) {
            if (cleaned.charAt(left) != cleaned.charAt(right)) {
                return false;
            }
            left++;
            right--;
        }
        
        return true;
    }
}`
    }
  },
  {
    id: 'merge-sorted-lists',
    name: 'Merge Two Sorted Lists',
    description: `You are given the heads of two sorted linked lists list1 and list2.
    Merge the two lists in a one sorted list. The list should be made by splicing together the nodes of the first two lists.
    Return the head of the merged linked list.`,
    difficulty: 'Easy',
    testCases: [
      {
        input: {
          list1: [1, 2, 4],
          list2: [1, 3, 4]
        },
        output: [1, 1, 2, 3, 4, 4],
        explanation: "Merged [1,2,4] and [1,3,4] to get [1,1,2,3,4,4]"
      },
      {
        input: {
          list1: [],
          list2: []
        },
        output: [],
        explanation: "Both lists are empty, so result is empty."
      },
      {
        input: {
          list1: [],
          list2: [0]
        },
        output: [0],
        explanation: "First list is empty, so result is just the second list."
      }
    ],
    solutions: {
      javascript: `/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.next = (next===undefined ? null : next)
 * }
 */
/**
 * @param {Array} list1
 * @param {Array} list2
 * @return {Array}
 */
function solution(input) {
    const { list1, list2 } = input;
    
    // Define ListNode class
    function ListNode(val, next) {
        this.val = (val === undefined ? 0 : val);
        this.next = (next === undefined ? null : next);
    }
    
    // Convert arrays to linked lists
    function arrayToList(arr) {
        let dummy = new ListNode(0);
        let current = dummy;
        
        for (const val of arr) {
            current.next = new ListNode(val);
            current = current.next;
        }
        
        return dummy.next;
    }
    
    // Convert to linked lists
    let l1 = arrayToList(list1);
    let l2 = arrayToList(list2);
    
    // Create a dummy head node
    let dummy = new ListNode(0);
    let current = dummy;
    
    // Merge the two lists
    while (l1 !== null && l2 !== null) {
        if (l1.val < l2.val) {
            current.next = l1;
            l1 = l1.next;
        } else {
            current.next = l2;
            l2 = l2.next;
        }
        current = current.next;
    }
    
    // Attach remaining nodes
    if (l1 !== null) {
        current.next = l1;
    } else {
        current.next = l2;
    }
    
    // Convert back to array for testing
    let result = [];
    let node = dummy.next;
    while (node !== null) {
        result.push(node.val);
        node = node.next;
    }
    
    return result;
}`,
      python: `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def solution(list1, list2):
    # Convert arrays to linked lists
    def array_to_list(arr):
        dummy = ListNode(0)
        current = dummy
        
        for val in arr:
            current.next = ListNode(val)
            current = current.next
            
        return dummy.next
    
    # Convert to linked lists
    l1 = array_to_list(list1)
    l2 = array_to_list(list2)
    
    # Create a dummy head node
    dummy = ListNode(0)
    current = dummy
    
    # Merge the two lists
    while l1 and l2:
        if l1.val < l2.val:
            current.next = l1
            l1 = l1.next
        else:
            current.next = l2
            l2 = l2.next
        current = current.next
    
    # Attach remaining nodes
    if l1:
        current.next = l1
    else:
        current.next = l2
    
    # Convert back to array for testing
    result = []
    node = dummy.next
    while node:
        result.append(node.val)
        node = node.next
    
    return result`,
      java: `/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
class Solution {
    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        // Create a dummy head node
        ListNode dummy = new ListNode(0);
        ListNode current = dummy;
        
        // Merge the two lists
        while (list1 != null && list2 != null) {
            if (list1.val < list2.val) {
                current.next = list1;
                list1 = list1.next;
            } else {
                current.next = list2;
                list2 = list2.next;
            }
            current = current.next;
        }
        
        // Attach remaining nodes
        if (list1 != null) {
            current.next = list1;
        } else {
            current.next = list2;
        }
        
        return dummy.next;
    }
}`
    }
  },
  {
    id: 'max-area-island',
    name: 'Max Area of Island',
    description: `You are given an m x n binary matrix grid. An island is a group of 1's (representing land) connected 4-directionally (horizontal or vertical). You may assume all four edges of the grid are surrounded by water.
    
    The area of an island is the number of cells with a value 1 in the island.
    
    Return the maximum area of an island in grid. If there is no island, return 0.`,
    difficulty: 'Medium',
    testCases: [
      {
        input: {
          grid: [
            [0,0,1,0,0,0,0,1,0,0,0,0,0],
            [0,0,0,0,0,0,0,1,1,1,0,0,0],
            [0,1,1,0,1,0,0,0,0,0,0,0,0],
            [0,1,0,0,1,1,0,0,1,0,1,0,0],
            [0,1,0,0,1,1,0,0,1,1,1,0,0],
            [0,0,0,0,0,0,0,0,0,0,1,0,0],
            [0,0,0,0,0,0,0,1,1,1,0,0,0],
            [0,0,0,0,0,0,0,1,1,0,0,0,0]
          ]
        },
        output: 6,
        explanation: "The answer is an island with area = 6, in row-column positions [(2,0), (2,1), (3,0), (3,1), (4,0), (4,1)]."
      },
      {
        input: {
          grid: [[0,0,0,0,0,0,0,0]]
        },
        output: 0,
        explanation: "The grid is all water (0s), so there is no island."
      }
    ],
    solutions: {
      javascript: `/**
 * @param {number[][]} grid
 * @return {number}
 */
function solution(input) {
    const { grid } = input;
    if (!grid || grid.length === 0) return 0;
    
    const rows = grid.length;
    const cols = grid[0].length;
    let maxArea = 0;
    
    // DFS to explore the island and calculate its area
    function dfs(r, c) {
        // Check boundaries and if current cell is land (1)
        if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] === 0) {
            return 0;
        }
        
        // Mark as visited by changing to 0
        grid[r][c] = 0;
        
        // Explore in all 4 directions and add up the area
        return 1 + dfs(r+1, c) + dfs(r-1, c) + dfs(r, c+1) + dfs(r, c-1);
    }
    
    // Make a deep copy of the grid to avoid modifying the input
    const gridCopy = JSON.parse(JSON.stringify(grid));
    
    // Check each cell in the grid
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (gridCopy[r][c] === 1) {
                maxArea = Math.max(maxArea, dfs(r, c));
            }
        }
    }
    
    return maxArea;
}`,
      python: `def solution(grid):
    if not grid or len(grid) == 0:
        return 0
        
    rows, cols = len(grid), len(grid[0])
    max_area = 0
    
    # Make a deep copy of the grid to avoid modifying the input
    grid_copy = [row[:] for row in grid]
    
    def dfs(r, c):
        # Check boundaries and if current cell is land (1)
        if r < 0 or r >= rows or c < 0 or c >= cols or grid_copy[r][c] == 0:
            return 0
            
        # Mark as visited by changing to 0
        grid_copy[r][c] = 0
        
        # Explore in all 4 directions and add up the area
        return 1 + dfs(r+1, c) + dfs(r-1, c) + dfs(r, c+1) + dfs(r, c-1)
    
    # Check each cell in the grid
    for r in range(rows):
        for c in range(cols):
            if grid_copy[r][c] == 1:
                max_area = max(max_area, dfs(r, c))
                
    return max_area`,
      java: `class Solution {
    public int maxAreaOfIsland(int[][] grid) {
        if (grid == null || grid.length == 0) return 0;
        
        int rows = grid.length;
        int cols = grid[0].length;
        int maxArea = 0;
        
        // Make a deep copy of the grid to avoid modifying the input
        int[][] gridCopy = new int[rows][cols];
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                gridCopy[i][j] = grid[i][j];
            }
        }
        
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (gridCopy[r][c] == 1) {
                    maxArea = Math.max(maxArea, dfs(gridCopy, r, c, rows, cols));
                }
            }
        }
        
        return maxArea;
    }
    
    private int dfs(int[][] grid, int r, int c, int rows, int cols) {
        // Check boundaries and if current cell is land (1)
        if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] == 0) {
            return 0;
        }
        
        // Mark as visited by changing to 0
        grid[r][c] = 0;
        
        // Explore in all 4 directions and add up the area
        return 1 + dfs(grid, r+1, c, rows, cols)
                 + dfs(grid, r-1, c, rows, cols)
                 + dfs(grid, r, c+1, rows, cols)
                 + dfs(grid, r, c-1, rows, cols);
    }
}`
    }
  },
  {
    id: 'palindrome-partitioning',
    name: 'Palindrome Partitioning',
    description: `Given a string s, partition s such that every substring of the partition is a palindrome. Return all possible palindrome partitioning of s.
    
    A palindrome string is a string that reads the same backward as forward.`,
    difficulty: 'Medium',
    testCases: [
      {
        input: {
          s: "aab"
        },
        output: [["a","a","b"],["aa","b"]],
        explanation: "Possible palindrome partitions: [\"a\",\"a\",\"b\"] and [\"aa\",\"b\"]."
      },
      {
        input: {
          s: "a"
        },
        output: [["a"]],
        explanation: "The string \"a\" is already a palindrome."
      }
    ],
    solutions: {
      javascript: `/**
 * @param {string} s
 * @return {string[][]}
 */
function solution(input) {
    const { s } = input;
    const result = [];
    
    // Helper function to check if a string is a palindrome
    function isPalindrome(str, start, end) {
        while (start < end) {
            if (str[start] !== str[end]) return false;
            start++;
            end--;
        }
        return true;
    }
    
    // Backtracking function to find all palindrome partitions
    function backtrack(start, partition) {
        // If we've reached the end of the string, we've found a valid partition
        if (start === s.length) {
            result.push([...partition]);
            return;
        }
        
        // Try all possible substrings starting from 'start'
        for (let end = start; end < s.length; end++) {
            // If the substring is a palindrome, add it to our partition and continue
            if (isPalindrome(s, start, end)) {
                partition.push(s.substring(start, end + 1));
                backtrack(end + 1, partition);
                partition.pop(); // Backtrack
            }
        }
    }
    
    backtrack(0, []);
    return result;
}`,
      python: `def solution(s):
    result = []
    
    def is_palindrome(start, end):
        while start < end:
            if s[start] != s[end]:
                return False
            start += 1
            end -= 1
        return True
    
    def backtrack(start, partition):
        # If we've reached the end of the string, we've found a valid partition
        if start == len(s):
            result.append(partition[:])
            return
            
        # Try all possible substrings starting from 'start'
        for end in range(start, len(s)):
            # If the substring is a palindrome, add it to our partition and continue
            if is_palindrome(start, end):
                partition.append(s[start:end+1])
                backtrack(end + 1, partition)
                partition.pop()  # Backtrack
    
    backtrack(0, [])
    return result`,
      java: `import java.util.ArrayList;
import java.util.List;

class Solution {
    public List<List<String>> partition(String s) {
        List<List<String>> result = new ArrayList<>();
        backtrack(result, new ArrayList<>(), s, 0);
        return result;
    }
    
    private void backtrack(List<List<String>> result, List<String> partition, String s, int start) {
        // If we've reached the end of the string, we've found a valid partition
        if (start == s.length()) {
            result.add(new ArrayList<>(partition));
            return;
        }
        
        // Try all possible substrings starting from 'start'
        for (int end = start; end < s.length(); end++) {
            // If the substring is a palindrome, add it to our partition and continue
            if (isPalindrome(s, start, end)) {
                partition.add(s.substring(start, end + 1));
                backtrack(result, partition, s, end + 1);
                partition.remove(partition.size() - 1); // Backtrack
            }
        }
    }
    
    private boolean isPalindrome(String s, int start, int end) {
        while (start < end) {
            if (s.charAt(start) != s.charAt(end)) return false;
            start++;
            end--;
        }
        return true;
    }
}`
    }
  },
  {
    id: 'product-except-self',
    name: 'Product of Array Except Self',
    description: `Given an integer array nums, return an array answer such that answer[i] is equal to the product of all the elements of nums except nums[i].
    
    The product of any prefix or suffix of nums is guaranteed to fit in a 32-bit integer.
    
    You must write an algorithm running in O(n) time and without using the division operation.`,
    difficulty: 'Medium',
    testCases: [
      {
        input: {
          nums: [1,2,3,4]
        },
        output: [24,12,8,6],
        explanation: "[24,12,8,6] where: 24 = 2*3*4, 12 = 1*3*4, 8 = 1*2*4, 6 = 1*2*3"
      },
      {
        input: {
          nums: [-1,1,0,-3,3]
        },
        output: [0,0,9,0,0],
        explanation: "With a zero in the array, most products will be zero except where that element itself is multiplied by zero."
      }
    ],
    solutions: {
      javascript: `/**
 * @param {number[]} nums
 * @return {number[]}
 */
function solution(input) {
    const { nums } = input;
    const n = nums.length;
    
    // Initialize the answer array with 1s
    const answer = new Array(n).fill(1);
    
    // Calculate products of all elements to the left of each element
    let leftProduct = 1;
    for (let i = 0; i < n; i++) {
        answer[i] = leftProduct;
        leftProduct *= nums[i];
    }
    
    // Calculate products of all elements to the right of each element and multiply with left products
    let rightProduct = 1;
    for (let i = n - 1; i >= 0; i--) {
        answer[i] *= rightProduct;
        rightProduct *= nums[i];
    }
    
    return answer;
}`,
      python: `def solution(nums):
    n = len(nums)
    
    # Initialize the answer array with 1s
    answer = [1] * n
    
    # Calculate products of all elements to the left of each element
    left_product = 1
    for i in range(n):
        answer[i] = left_product
        left_product *= nums[i]
    
    # Calculate products of all elements to the right of each element and multiply with left products
    right_product = 1
    for i in range(n - 1, -1, -1):
        answer[i] *= right_product
        right_product *= nums[i]
    
    return answer`,
      java: `class Solution {
    public int[] productExceptSelf(int[] nums) {
        int n = nums.length;
        
        // Initialize the answer array
        int[] answer = new int[n];
        
        // Calculate products of all elements to the left of each element
        int leftProduct = 1;
        for (int i = 0; i < n; i++) {
            answer[i] = leftProduct;
            leftProduct *= nums[i];
        }
        
        // Calculate products of all elements to the right of each element and multiply with left products
        int rightProduct = 1;
        for (int i = n - 1; i >= 0; i--) {
            answer[i] *= rightProduct;
            rightProduct *= nums[i];
        }
        
        return answer;
    }
}`
    }
  },
  {
    id: 'level-order-traversal',
    name: 'Binary Tree Level Order Traversal',
    description: `Given the root of a binary tree, return the level order traversal of its nodes' values. (i.e., from left to right, level by level).`,
    difficulty: 'Medium',
    testCases: [
      {
        input: {
          root: [3,9,20,null,null,15,7]
        },
        output: [[3],[9,20],[15,7]],
        explanation: "Level order traversal: Level 1: [3], Level 2: [9,20], Level 3: [15,7]"
      },
      {
        input: {
          root: [1]
        },
        output: [[1]],
        explanation: "A single node tree has only one level."
      },
      {
        input: {
          root: []
        },
        output: [],
        explanation: "An empty tree returns an empty traversal."
      }
    ],
    solutions: {
      javascript: `/**
 * Tree node structure for binary tree
 * function TreeNode(val, left, right) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.left = (left===undefined ? null : left)
 *     this.right = (right===undefined ? null : right)
 * }
 */

/**
 * @param {number[]} root - Array representation of binary tree
 * @return {number[][]} - Level order traversal
 */
function solution(input) {
    const { root } = input;
    
    // Define TreeNode constructor
    function TreeNode(val, left, right) {
        this.val = (val === undefined ? 0 : val);
        this.left = (left === undefined ? null : left);
        this.right = (right === undefined ? null : right);
    }
    
    // If the tree is empty, return empty array
    if (!root || root.length === 0) return [];
    
    // Helper function to build binary tree from array representation
    function buildTree(arr) {
        if (arr.length === 0) return null;
        
        // Create TreeNode objects instead of plain objects
        const nodes = arr.map(val => val === null ? null : new TreeNode(val));
        
        // For each node with index i, left child is at 2*i+1, right child at 2*i+2
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i] === null) continue;
            
            const leftIdx = 2 * i + 1;
            const rightIdx = 2 * i + 2;
            
            if (leftIdx < nodes.length) {
                nodes[i].left = nodes[leftIdx];
            }
            
            if (rightIdx < nodes.length) {
                nodes[i].right = nodes[rightIdx];
            }
        }
        
        return nodes[0]; // Return the root
    }
    
    // Build the tree from array representation
    const treeRoot = buildTree(root);
    
    // If after building the tree, the root is null, return empty array
    if (!treeRoot) return [];
    
    // Level order traversal using breadth-first search
    const result = [];
    const queue = [treeRoot];
    
    while (queue.length > 0) {
        const levelSize = queue.length;
        const currentLevel = [];
        
        for (let i = 0; i < levelSize; i++) {
            const node = queue.shift();
            currentLevel.push(node.val);
            
            if (node.left) queue.push(node.left);
            if (node.right) queue.push(node.right);
        }
        
        result.push(currentLevel);
    }
    
    return result;
}`,
      python: `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def solution(root):
    # If the tree is empty, return empty array
    if not root:
        return []
    
    # Helper function to build binary tree from array representation
    def build_tree(arr):
        if not arr:
            return None
        
        # Create TreeNode objects or None for null values
        nodes = [None if val is None else TreeNode(val) for val in arr]
        
        # For each node with index i, left child is at 2*i+1, right child at 2*i+2
        for i in range(len(nodes)):
            if nodes[i] is None:
                continue
            
            left_idx = 2 * i + 1
            right_idx = 2 * i + 2
            
            if left_idx < len(nodes):
                nodes[i].left = nodes[left_idx]
            
            if right_idx < len(nodes):
                nodes[i].right = nodes[right_idx]
        
        return nodes[0]  # Return the root
    
    # Build the tree from array representation
    tree_root = build_tree(root)
    
    # If after building the tree, the root is None, return empty array
    if not tree_root:
        return []
    
    # Level order traversal using breadth-first search
    result = []
    queue = [tree_root]
    
    while queue:
        level_size = len(queue)
        current_level = []
        
        for _ in range(level_size):
            node = queue.pop(0)
            current_level.append(node.val)
            
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        
        result.append(current_level)
    
    return result`,
      java: `import java.util.*;

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}

class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> result = new ArrayList<>();
        
        if (root == null) {
            return result;
        }
        
        Queue<TreeNode> queue = new LinkedList<>();
        queue.offer(root);
        
        while (!queue.isEmpty()) {
            int levelSize = queue.size();
            List<Integer> currentLevel = new ArrayList<>();
            
            for (int i = 0; i < levelSize; i++) {
                TreeNode node = queue.poll();
                currentLevel.add(node.val);
                
                if (node.left != null) {
                    queue.offer(node.left);
                }
                
                if (node.right != null) {
                    queue.offer(node.right);
                }
            }
            
            result.add(currentLevel);
        }
        
        return result;
    }
}`
    }
  }
];

// Mock test cases
const mockTestCases: TestCase[] = [
  {
    input: {
      commands: ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"],
      values: [[2], [1, 10], [2, 20], [1], [3, 30], [2], [4, 40], [1], [3], [4]]
      // Operations:
      // 1. LRUCache(2)
      // 2. put(1, 10)    cache: {1:10}
      // 3. put(2, 20)    cache: {1:10, 2:20}
      // 4. get(1)        returns 10, cache: {2:20, 1:10} (1 is MRU)
      // 5. put(3, 30)    evicts 2, cache: {1:10, 3:30} (3 is MRU)
      // 6. get(2)        returns -1 (evicted)
      // 7. put(4, 40)    evicts 1, cache: {3:30, 4:40} (4 is MRU)
      // 8. get(1)        returns -1 (evicted)
      // 9. get(3)        returns 30, cache: {4:40, 3:30} (3 is MRU)
      // 10. get(4)       returns 40, cache: {3:30, 4:40} (4 is MRU)
    },
    output: [null, null, null, 10, null, -1, null, -1, 30, 40],
    explanation: "Capacity 2. put(1,10), put(2,20), get(1)->10. put(3,30) (evicts 2). get(2)->-1. put(4,40) (evicts 1). get(1)->-1. get(3)->30. get(4)->40."
  },
  {
    input: {
      commands: ["LRUCache","put","put","put","put","get","get"],
      values: [[2],[2,1],[1,1],[2,3],[4,1],[1],[2]]
      // Operations:
      // 1. LRUCache(2)
      // 2. put(2,1)      cache: {2:1}
      // 3. put(1,1)      cache: {2:1, 1:1}
      // 4. put(2,3)      cache: {1:1, 2:3} (updates 2, makes it MRU)
      // 5. put(4,1)      evicts 1, cache: {2:3, 4:1}
      // 6. get(1)        returns -1
      // 7. get(2)        returns 3
    },
    output: [null,null,null,null,null,-1,3],
    explanation: "Capacity 2. Series of puts and gets with updates and evictions."
  }
];

// Example solutions
const exampleSolutions: Record<string, string> = {
  javascript: `// LRU Cache Implementation for the Code Execution Platform

/**
 * Node for the doubly linked list
 */
class DLinkedNode {
    constructor(key, value) {
        this.key = key;
        this.value = value;
        this.prev = null;
        this.next = null;
    }
}

/**
 * LRU Cache implementation with a Map and doubly-linked list
 */
class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.map = new Map();
        this.head = new DLinkedNode(0, 0);
        this.tail = new DLinkedNode(0, 0);
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    _removeNode(node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    _addToHead(node) {
        node.next = this.head.next;
        node.prev = this.head;
        this.head.next.prev = node;
        this.head.next = node;
    }

    get(key) {
        if (!this.map.has(key)) return -1;
        const node = this.map.get(key);
        this._removeNode(node);
        this._addToHead(node);
        return node.value;
    }

    put(key, value) {
        if (this.map.has(key)) {
            const node = this.map.get(key);
            node.value = value;
            this._removeNode(node);
            this._addToHead(node);
        } else {
            if (this.map.size === this.capacity) {
                const tail = this.tail.prev;
                this._removeNode(tail);
                this.map.delete(tail.key);
            }
            const newNode = new DLinkedNode(key, value);
            this.map.set(key, newNode);
            this._addToHead(newNode);
        }
    }
}

/**
 * The solution function that the platform's driver code will call.
 * It takes an input object with commands and values, simulates LRU cache operations,
 * and returns an array of results.
 * 
 * @param {Object} input - Input with commands and values arrays
 * @returns {Array} - Results of each operation
 */
function solution(input) {
    const commands = input.commands;
    const values = input.values;
    const results = [];
    let cache = null;
    
    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        const val = values[i];
        
        if (cmd === "LRUCache") {
            cache = new LRUCache(val[0]);
            results.push(null);
        } else if (cmd === "put") {
            cache.put(val[0], val[1]);
            results.push(null);
        } else if (cmd === "get") {
            results.push(cache.get(val[0]));
        } else {
            results.push(null);
        }
    }
    
    return results;
}`,
  python: `# LRU Cache Implementation for the Code Execution Platform

class DLinkedNode:
    def __init__(self, key=0, value=0):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None

class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = {}  # Maps key to DLinkedNode
        
        # Dummy head and tail
        self.head = DLinkedNode()
        self.tail = DLinkedNode()
        self.head.next = self.tail
        self.tail.prev = self.head

    def _remove_node(self, node: DLinkedNode):
        if node.prev and node.next: # Basic check
            node.prev.next = node.next
            node.next.prev = node.prev

    def _add_to_head(self, node: DLinkedNode):
        node.next = self.head.next
        node.prev = self.head
        self.head.next.prev = node
        self.head.next = node

    def get(self, key: int) -> int:
        if key in self.cache:
            node = self.cache[key]
            self._remove_node(node)
            self._add_to_head(node)
            return node.value
        return -1

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            node = self.cache[key]
            node.value = value
            self._remove_node(node)
            self._add_to_head(node)
        else:
            if len(self.cache) == self.capacity:
                lru_node = self.tail.prev
                if lru_node != self.head: # Make sure we don't try to remove head
                    self._remove_node(lru_node)
                    del self.cache[lru_node.key]
            
            if self.capacity > 0: # Only add if capacity allows
                new_node = DLinkedNode(key, value)
                self.cache[key] = new_node
                self._add_to_head(new_node)

def solution(commands, values):
    lru_cache_instance = None
    results = []

    for i in range(len(commands)):
        command = commands[i]
        current_params = values[i]
        operation_result = None  # Default for 'get'

        if command == "LRUCache":
            lru_cache_instance = LRUCache(*current_params)
            results.append(None)
        elif command == "put":
            if lru_cache_instance:
                lru_cache_instance.put(*current_params)
            results.append(None)
        elif command == "get":
            if lru_cache_instance:
                operation_result = lru_cache_instance.get(*current_params)
            else:
                operation_result = -1 # Cache not initialized
            results.append(operation_result)
        else:
            # Handle unknown command if necessary, though test data should be valid
            results.append(None)
            
    return results`,
  java: `// LRU Cache Class for Java

import java.util.HashMap;
import java.util.Map;

class LRUCache {
    private class DLinkedNode {
        int key;
        int value;
        DLinkedNode prev;
        DLinkedNode next;

        DLinkedNode() {}
        DLinkedNode(int key, int value) {
            this.key = key;
            this.value = value;
        }
    }

    private final Map<Integer, DLinkedNode> cache = new HashMap<>();
    private int size;
    private final int capacity;
    private final DLinkedNode head; // Dummy head
    private final DLinkedNode tail; // Dummy tail

    private void addNodeToHead(DLinkedNode node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    private void removeNode(DLinkedNode node) {
        if (node == null || node.prev == null || node.next == null) return;
        DLinkedNode prevNode = node.prev;
        DLinkedNode nextNode = node.next;
        prevNode.next = nextNode;
        nextNode.prev = prevNode;
    }

    private void moveToHead(DLinkedNode node) {
        removeNode(node);
        addNodeToHead(node);
    }

    private DLinkedNode popTail() {
        if (tail.prev == head) return null; // Cache is empty
        DLinkedNode res = tail.prev;
        removeNode(res);
        return res;
    }

    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.size = 0;
        this.head = new DLinkedNode();
        this.tail = new DLinkedNode();
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    public int get(int key) {
        DLinkedNode node = cache.get(key);
        if (node == null) {
            return -1;
        }
        moveToHead(node);
        return node.value;
    }

    public void put(int key, int value) {
        if (this.capacity == 0) return; // Cannot put anything if capacity is 0

        DLinkedNode node = cache.get(key);
        if (node == null) {
            DLinkedNode newNode = new DLinkedNode(key, value);
            cache.put(key, newNode);
            addNodeToHead(newNode);
            size++;
            if (size > capacity) {
                DLinkedNode tailNode = popTail();
                if (tailNode != null) {
                    cache.remove(tailNode.key);
                    size--;
                }
            }
        } else {
            node.value = value;
            moveToHead(node);
        }
    }
}`
};

// Function to execute code via API
async function executeCodeViaAPI(code: string, language: string, testCases: TestCase[]): Promise<{ submissionId: string, token: string }> {
  try {
    const response = await fetch('/api/execute-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, language, testCases }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to execute code');
    }
    
    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
}

// Function to poll for submission status
async function pollSubmissionStatus(submissionId: string): Promise<ExecutionResults> {
  try {
    const response = await fetch(`/api/execute-code/status/${submissionId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch submission status');
    }
    
    const data = await response.json();
    
    // If submission is still processing, throw a special error to continue polling
    if (data.status === 'pending' || data.status === 'processing') {
      const error = new Error('Submission is still processing');
      error.name = 'PROCESSING';
      throw error;
    }
    
    // If status is completed, return the results
    if (data.status === 'completed') {
      return data.results;
    }
    
    // If there was an error with the submission
    if (data.status === 'error') {
      throw new Error(data.error || 'Execution failed');
    }
    
    throw new Error('Unknown submission status');
  } catch (error) {
    // Rethrow the special processing error so we know to continue polling
    if (error instanceof Error && error.name === 'PROCESSING') {
      throw error;
    }
    
    console.error('Status polling error:', error);
    throw error;
  }
}

// Problem Selector component
function ProblemSelector({ problems, selectedProblem, onProblemChange }: { 
  problems: ProblemType[], 
  selectedProblem: string, 
  onProblemChange: (problemId: string) => void 
}) {
  return (
    <div className="relative w-full max-w-xs">
      <label htmlFor="problem-select" className="block text-sm font-medium text-gray-700 mb-1">
        Select Problem
      </label>
      <select
        id="problem-select"
        value={selectedProblem}
        onChange={(e) => onProblemChange(e.target.value)}
        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
      >
        {problems.map((problem) => (
          <option key={problem.id} value={problem.id}>
            {problem.name} ({problem.difficulty})
          </option>
        ))}
      </select>
    </div>
  );
}

// Display test cases component
function TestCasesDisplay({ testCases }: { testCases: TestCase[] }) {
  return (
    <div className="mt-4 bg-gray-50 p-4 rounded-md">
      <h3 className="text-lg font-medium mb-2">Test Cases</h3>
      <div className="space-y-3">
        {testCases.map((testCase, index) => (
          <div key={index} className="bg-white p-3 rounded-md border">
            <p className="font-medium text-sm">Test Case {index + 1}</p>
            <pre className="mt-1 text-xs overflow-auto p-2 bg-gray-50 rounded">
              <span className="font-medium">Input:</span> {JSON.stringify(testCase.input, null, 2)}
            </pre>
            <pre className="mt-1 text-xs overflow-auto p-2 bg-gray-50 rounded">
              <span className="font-medium">Expected Output:</span> {JSON.stringify(testCase.output, null, 2)}
            </pre>
            {testCase.explanation && (
              <p className="mt-1 text-xs text-gray-600">
                <span className="font-medium">Explanation:</span> {testCase.explanation}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SubmissionExamplePage() {
  const [selectedProblemId, setSelectedProblemId] = useState('lru-cache');
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<ExecutionResults | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [lastSubmission, setLastSubmission] = useState<{
    results: ExecutionResults;
    code: string;
    language: string;
    problemId: string;
  } | null>(null);

  // Get the currently selected problem
  const selectedProblem = problems.find(p => p.id === selectedProblemId) || problems[0];

  // Update code when language changes
  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    // Update code if solution exists for this language
    if (selectedProblem.solutions[newLanguage]) {
      setCode(selectedProblem.solutions[newLanguage]);
    }
  };

  // Update code when problem changes
  const handleProblemChange = (problemId: string) => {
    setSelectedProblemId(problemId);
    const newProblem = problems.find(p => p.id === problemId) || problems[0];
    
    // Set code to the solution for the selected language if available
    if (newProblem.solutions[language]) {
      setCode(newProblem.solutions[language]);
    } else {
      // Or use the first available language solution
      const firstAvailableLanguage = Object.keys(newProblem.solutions)[0];
      if (firstAvailableLanguage) {
        setLanguage(firstAvailableLanguage);
        setCode(newProblem.solutions[firstAvailableLanguage]);
      }
    }
    
    // Reset results
    setResults(null);
  };

  // Initialize code on component mount
  useEffect(() => {
    if (selectedProblem && selectedProblem.solutions[language]) {
      setCode(selectedProblem.solutions[language]);
    }
  }, [selectedProblem, language]); // Dependencies to ensure it runs when these change

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  // Function to handle continuous polling
  const pollForResults = async (submissionId: string) => {
    try {
      const results = await pollSubmissionStatus(submissionId);
      setResults(results);
      setLastSubmission({ results, code, language, problemId: selectedProblemId });
      setIsExecuting(false);
      return true;
    } catch (error) {
      // If still processing, continue polling after a delay
      if (error instanceof Error && error.name === 'PROCESSING') {
        setTimeout(() => pollForResults(submissionId), 1000); // Poll every second
        return false;
      }
      
      // Otherwise it's a real error
      console.error('Polling error:', error);
      const errorResult: ExecutionResults = {
        passed: false,
        testCasesPassed: 0,
        testCasesTotal: selectedProblem.testCases.length,
        executionTime: null,
        memoryUsage: null,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      };
      setResults(errorResult);
      setLastSubmission({ results: errorResult, code, language, problemId: selectedProblemId });
      setPollingError(error instanceof Error ? error.message : 'An unknown error occurred');
      setIsExecuting(false);
      return true;
    }
  };

  const handleExecute = async () => {
    if (!code || isExecuting) return;
    
    setIsExecuting(true);
    setResults(null);
    setPollingError(null);
      
    try {
      // Submit code for execution
      const { submissionId } = await executeCodeViaAPI(code, language, selectedProblem.testCases);
      
      // Begin polling for results
      pollForResults(submissionId);
    } catch (error) {
      console.error('Submission error:', error);
      const errorResult: ExecutionResults = {
        passed: false,
        testCasesPassed: 0,
        testCasesTotal: selectedProblem.testCases.length,
        executionTime: null,
        memoryUsage: null,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      };
      setResults(errorResult);
      setLastSubmission({ results: errorResult, code, language, problemId: selectedProblemId });
      setIsExecuting(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">LeetCode-style Code Execution</h1>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <ProblemSelector 
              problems={problems} 
              selectedProblem={selectedProblemId} 
              onProblemChange={handleProblemChange} 
            />
            <div className="text-sm bg-gray-100 px-3 py-1 rounded mt-2 md:mt-0">
              Difficulty: <span className={`font-medium ${
                selectedProblem.difficulty === 'Easy' ? 'text-green-600' :
                selectedProblem.difficulty === 'Medium' ? 'text-yellow-600' :
                'text-red-600'
              }`}>{selectedProblem.difficulty}</span>
            </div>
          </div>
          
          <h2 className="text-xl font-semibold mb-4">{selectedProblem.name}</h2>
          <div className="mb-6 prose max-w-none">
            <p className="whitespace-pre-line">{selectedProblem.description}</p>
          </div>

          <TestCasesDisplay testCases={selectedProblem.testCases} />
          
          <div className="code-execution-interface mt-6">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <LanguageSelector
                  selectedLanguage={language}
                  onLanguageChange={handleLanguageChange}
                  className="w-48"
                />
                <button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className={`px-4 py-2 rounded-md font-medium ${
                    isExecuting 
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {isExecuting ? 'Executing...' : 'Run Code'}
                </button>
              </div>
              
              <CodeEditor
                code={code}
                language={language}
                onChange={handleCodeChange}
                height="400px"
                width="100%"
              />
            </div>
            
            {results && (
              <div className="bg-gray-50 border rounded-md p-4 mt-4">
                <h3 className="text-lg font-medium mb-2">Execution Results</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p><span className="font-medium">Status:</span> {results.passed ? 
                      <span className="text-green-600">Passed</span> : 
                      <span className="text-red-600">Failed</span>}
                    </p>
                    <p><span className="font-medium">Tests:</span> {results.testCasesPassed} / {results.testCasesTotal} passed</p>
                  </div>
                  <div>
                    <p><span className="font-medium">Execution time:</span> {results.executionTime ? `${results.executionTime}ms` : 'N/A'}</p>
                    <p><span className="font-medium">Memory usage:</span> {results.memoryUsage ? `${results.memoryUsage}MB` : 'N/A'}</p>
                  </div>
                </div>
                
                {results.error && (
                  <div className="mt-2">
                    <p className="font-medium text-red-600">Error:</p>
                    <pre className="mt-1 p-2 bg-red-50 text-red-700 rounded text-sm overflow-auto">
                      {results.error}
                    </pre>
                  </div>
                )}
                
                {results.testResults && results.testResults.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Test Case Results:</h4>
                    <div className="space-y-2">
                      {results.testResults.map((result, index) => (
                        <div key={index} className={`p-2 rounded ${result.passed ? 'bg-green-50' : 'bg-red-50'}`}>
                          <p className="font-medium">
                            Test {index + 1}: {result.passed ? 
                              <span className="text-green-600">Passed</span> : 
                              <span className="text-red-600">Failed</span>}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Input:</span> {JSON.stringify(result.testCase.input)}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Expected:</span> {JSON.stringify(result.testCase.output)}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Actual:</span> {JSON.stringify(result.actualOutput)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {lastSubmission && lastSubmission.problemId === selectedProblemId && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Last Submission Stats</h2>
            <div className="prose">
              <p>
                <strong>Language:</strong> {lastSubmission.language}
              </p>
              <p>
                <strong>Passed:</strong> {lastSubmission.results.passed ? 'Yes' : 'No'}
              </p>
              <p>
                <strong>Tests Passed:</strong> {lastSubmission.results.testCasesPassed} / {lastSubmission.results.testCasesTotal}
              </p>
              <p>
                <strong>Execution Time:</strong> {lastSubmission.results.executionTime ? `${lastSubmission.results.executionTime} ms` : 'N/A'}
              </p>
              {lastSubmission.results.error && (
                <div className="mt-2">
                  <strong>Error:</strong>
                  <pre className="text-xs bg-red-50 text-red-800 p-2 rounded mt-1">
                    {lastSubmission.results.error}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 