import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

describe('Firestore security rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const hostEnv = process.env.FIRESTORE_EMULATOR_HOST;
    if (!hostEnv) {
      throw new Error(
        'FIRESTORE_EMULATOR_HOST must be set. Run tests with `firebase emulators:exec` or start the Firestore emulator manually.'
      );
    }
    const [host, portString] = hostEnv.split(':');
    testEnv = await initializeTestEnvironment({
      projectId: 'firestore-rules-tests',
      firestore: {
        rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
        host,
        port: Number.parseInt(portString, 10),
      },
    });
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  const ownerId = 'user_owner';
  const otherUserId = 'user_other';

  it('allows users to read & write their own user profile', async () => {
    const ownerDb = testEnv.authenticatedContext(ownerId).firestore();
    const ownerDoc = ownerDb.collection('users').doc(ownerId);

    await assertSucceeds(ownerDoc.set({ email: 'owner@example.com' }));
    await assertSucceeds(ownerDoc.get());

    const otherDb = testEnv.authenticatedContext(otherUserId).firestore();
    await assertFails(otherDb.collection('users').doc(ownerId).get());
    await assertFails(otherDb.collection('users').doc(ownerId).set({ email: 'malicious@example.com' }));

    const guestDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(guestDb.collection('users').doc(ownerId).get());
  });

  it('enforces ownership on user study plans', async () => {
    const ownerDb = testEnv.authenticatedContext(ownerId).firestore();
    const planDoc = ownerDb.collection('userStudyPlans').doc(ownerId).collection('plans').doc('plan_1');

    await assertSucceeds(planDoc.set({ createdAt: 1, timeline: 30 }));
    await assertSucceeds(planDoc.get());

    const otherDb = testEnv.authenticatedContext(otherUserId).firestore();
    await assertFails(otherDb.collection('userStudyPlans').doc(ownerId).collection('plans').doc('plan_1').get());
    await assertFails(
      otherDb.collection('userStudyPlans').doc(ownerId).collection('plans').doc('plan_1').set({ timeline: 60 })
    );
  });

  it('enforces ownership on user study plan progress', async () => {
    const ownerDb = testEnv.authenticatedContext(ownerId).firestore();
    const progressDoc = ownerDb
      .collection('userStudyPlanProgress')
      .doc(ownerId)
      .collection('progress')
      .doc('progress_1');

    await assertSucceeds(progressDoc.set({ status: 'in_progress', updatedAt: 1 }));
    await assertSucceeds(progressDoc.get());

    const otherDb = testEnv.authenticatedContext(otherUserId).firestore();
    await assertFails(
      otherDb.collection('userStudyPlanProgress').doc(ownerId).collection('progress').doc('progress_1').get()
    );
    await assertFails(
      otherDb.collection('userStudyPlanProgress').doc(ownerId).collection('progress').doc('progress_1').set({
        status: 'completed',
      })
    );
  });

  it('allows owners to read their Stripe customer data but disallows client writes', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await adminDb.collection('customers').doc(ownerId).set({ createdVia: 'seed' });
      await adminDb.collection('customers').doc(ownerId).collection('subscriptions').doc('sub_1').set({
        status: 'active',
      });
    });

    const ownerDb = testEnv.authenticatedContext(ownerId).firestore();
    await assertSucceeds(ownerDb.collection('customers').doc(ownerId).get());
    await assertSucceeds(ownerDb.collection('customers').doc(ownerId).collection('subscriptions').doc('sub_1').get());
    await assertFails(ownerDb.collection('customers').doc(ownerId).set({ should: 'fail' }));
    await assertFails(
      ownerDb.collection('customers').doc(ownerId).collection('subscriptions').doc('sub_1').set({ status: 'canceled' })
    );

    const otherDb = testEnv.authenticatedContext(otherUserId).firestore();
    await assertFails(otherDb.collection('customers').doc(ownerId).get());
    await assertFails(
      otherDb.collection('customers').doc(ownerId).collection('subscriptions').doc('sub_1').get()
    );
  });
});
