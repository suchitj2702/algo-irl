import { createMockFirestore } from '@/tests/utils/mockFirestore';

const defaultDb = createMockFirestore();

const adminDb = jest.fn(() => defaultDb);

function __setMockDb(db: ReturnType<typeof createMockFirestore>) {
  adminDb.mockImplementation(() => db);
}

export { adminDb, __setMockDb };
