import { MockFieldValue, MockTimestamp } from '@/tests/utils/mockFirestore';

const FieldValue = MockFieldValue;
const Timestamp = MockTimestamp;

function __resetFirestoreMocks() {
  FieldValue.serverTimestamp.mockClear();
  FieldValue.increment.mockClear();
  FieldValue.delete.mockClear();
  Timestamp.now.mockClear();
  Timestamp.fromMillis.mockClear();
}

export { FieldValue, Timestamp, __resetFirestoreMocks };
