type FirestoreData = Record<string, unknown>;

export interface MockDocSnapshot<T extends FirestoreData = FirestoreData> {
  exists: boolean;
  data: () => T;
  get: (field: keyof T) => unknown;
}

export interface MockDocRef<T extends FirestoreData = FirestoreData> {
  id: string;
  path: string;
  get: jest.Mock<Promise<MockDocSnapshot<T>>, []>;
  set: jest.Mock<Promise<void>, [Partial<T>, { merge?: boolean }?]>;
  collection: jest.Mock<MockCollectionRef, [string]>;
}

interface MockQueryDoc<T extends FirestoreData = FirestoreData> {
  id: string;
  data: () => T;
  ref: MockDocRef<T>;
  get: (field: keyof T) => unknown;
}

export interface MockQuerySnapshot<T extends FirestoreData = FirestoreData> {
  size: number;
  docs: Array<MockQueryDoc<T>>;
  empty: boolean;
  forEach: (callback: (doc: MockQueryDoc<T>) => void) => void;
}

export interface MockQuery<T extends FirestoreData = FirestoreData> {
  where: jest.Mock<MockQuery<T>, [string, unknown, unknown]>;
  limit: jest.Mock<MockQuery<T>, [number]>;
  get: jest.Mock<Promise<MockQuerySnapshot<T>>, []>;
}

export interface MockCollectionRef<T extends FirestoreData = FirestoreData> {
  doc: jest.Mock<MockDocRef<T>, [string]>;
  where: jest.Mock<MockQuery<T>, [string, unknown, unknown]>;
  get: jest.Mock<Promise<MockQuerySnapshot<T>>, []>;
  add: jest.Mock<Promise<MockDocRef<T>>, [Partial<T>]>;
}

export interface MockFirestore {
  collection: jest.Mock<MockCollectionRef, [string]>;
  runTransaction: jest.Mock<Promise<unknown>, [(tx: MockTransaction) => Promise<unknown>]>;
  _store: Map<string, FirestoreData>;
}

export interface MockTransaction {
  get: jest.Mock<Promise<MockDocSnapshot>, [MockDocRef]>;
  set: jest.Mock<void, [MockDocRef, FirestoreData, { merge?: boolean }?]>;
  update: jest.Mock<void, [MockDocRef, FirestoreData]>;
}

export function createMockDocSnapshot<T extends FirestoreData = FirestoreData>(
  data: T | null | undefined
): MockDocSnapshot<T> {
  return {
    exists: Boolean(data),
    data: () => (data ?? {}) as T,
    get: (field) => (data ?? ({} as T))[field],
  };
}

export function createMockFirestore(initialData?: Record<string, FirestoreData>): MockFirestore {
  const store = new Map<string, FirestoreData>();

  if (initialData) {
    for (const [path, value] of Object.entries(initialData)) {
      store.set(path, value);
    }
  }

  const createDocRef = (collectionPath: string, docId: string): MockDocRef => {
    const path = `${collectionPath}/${docId}`;

    const docRef: MockDocRef = {
      id: docId,
      path,
      get: jest.fn(async () => createMockDocSnapshot(store.get(path))),
      set: jest.fn(async (data: FirestoreData, options?: { merge?: boolean }) => {
        const existing = store.get(path);
        if (options?.merge && existing) {
          store.set(path, { ...existing, ...data });
        } else {
          store.set(path, { ...data });
        }
      }),
      collection: jest.fn((subCollection: string) => createCollection(`${path}/${subCollection}`)),
    };

    return docRef;
  };

  const createQuerySnapshot = (
    collectionPath: string,
    limitValue?: number
  ): MockQuerySnapshot => {
    const docs = [...store.entries()]
      .filter(([path]) => path.startsWith(`${collectionPath}/`))
      .map(([path, value]) => {
        const id = path.slice(collectionPath.length + 1);
        const ref = createDocRef(collectionPath, id);
        return {
          id,
          data: () => value,
          ref,
          get: (field: keyof FirestoreData) => (value as FirestoreData)[field as string],
        };
      })
      .slice(0, limitValue ?? undefined);

    return {
      size: docs.length,
      docs,
      empty: docs.length === 0,
      forEach: (callback) => {
        docs.forEach((doc) => callback(doc));
      },
    };
  };

  const createQuery = (collectionPath: string, limitValue?: number): MockQuery => {
    const query: MockQuery = {
      where: jest.fn((field: string, operator: unknown, value: unknown) => {
        void field;
        void operator;
        void value;
        return query;
      }),
      limit: jest.fn((value: number) => createQuery(collectionPath, value)),
      get: jest.fn(async () => createQuerySnapshot(collectionPath, limitValue)),
    };
    return query;
  };

  const createCollection = (collectionPath: string): MockCollectionRef => {
    return {
      doc: jest.fn((docId: string) => createDocRef(collectionPath, docId)),
      where: jest.fn((field: string, operator: unknown, value: unknown) => {
        void field;
        void operator;
        void value;
        return createQuery(collectionPath);
      }),
      get: jest.fn(async () => createQuerySnapshot(collectionPath)),
      add: jest.fn(async (data: FirestoreData) => {
        const docId = `mock_${Math.random().toString(36).slice(2, 12)}`;
        const docRef = createDocRef(collectionPath, docId);
        await docRef.set(data);
        return docRef;
      }),
    };
  };

  return {
    collection: jest.fn((name: string) => createCollection(name)),
    runTransaction: jest.fn(async (updateFunction) => {
      const tx: MockTransaction = {
        get: jest.fn(async (docRef: MockDocRef) => docRef.get()),
        set: jest.fn((docRef: MockDocRef, data: FirestoreData, options?: { merge?: boolean }) => {
          void docRef.set(data, options);
        }),
        update: jest.fn((docRef: MockDocRef, data: FirestoreData) => {
          void docRef.set(data, { merge: true });
        }),
      };
      return updateFunction(tx);
    }),
    _store: store,
  };
}

export class MockTimestamp {
  private millis: number;

  constructor(millis: number) {
    this.millis = millis;
  }

  toMillis(): number {
    return this.millis;
  }

  static now = jest.fn(() => new MockTimestamp(Date.now()));

  static fromMillis = jest.fn((millis: number) => new MockTimestamp(millis));
}

export const MockFieldValue = {
  serverTimestamp: jest.fn(() => ({ __type: 'serverTimestamp' })),
  increment: jest.fn((value: number) => ({ __type: 'increment', value })),
  delete: jest.fn(() => ({ __type: 'delete' })),
};
