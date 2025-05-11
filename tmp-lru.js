// Simple LRU Cache for testing
class DLinkedNode {
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
  const { commands, values } = input;
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
    }
  }
  
  return results;
}
