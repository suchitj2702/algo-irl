import { test, expect, Page } from '@playwright/test';

class PaymentJourneyHelper {
  constructor(private page: Page) {}

  async signIn(): Promise<void> {
    await this.page.route('**/auth/google', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ user: { uid: 'test-user' } }),
        headers: { 'content-type': 'application/json' },
      });
    });

    await this.page.click('text=Sign in with Google');
  }

  async completeMockPayment(): Promise<void> {
    await this.page.evaluate(() => {
      const event = new CustomEvent('razorpay.payment.success', {
        detail: {
          razorpay_payment_id: 'pay_test_123',
          razorpay_subscription_id: 'sub_test_123',
        },
      });
      window.dispatchEvent(event);
    });
  }

  async waitForSubscriptionActivation(): Promise<void> {
    await this.page.waitForFunction(() => {
      return window.localStorage.getItem('subscription_status') === 'active';
    }, { timeout: 30_000 });
  }
}

test.describe('Complete Payment Journey', () => {
  let helper: PaymentJourneyHelper;

  test.beforeEach(async ({ page }) => {
    helper = new PaymentJourneyHelper(page);

    await page.route('**/api/billing/create-subscription', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          subscriptionId: 'sub_123',
          shortUrl: 'https://rzp.io/l/test',
        }),
        headers: { 'content-type': 'application/json' },
      });
    });
  });

  test('new user: landing → auth → payment → access', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Unlock comprehensive plans');
    await helper.signIn();
    await expect(page.locator('text=₹499/month')).toBeVisible();

    await page.click('text=Proceed to Payment');
    await helper.completeMockPayment();

    await helper.waitForSubscriptionActivation();

    await page.goto('/study-plan-form');
    await expect(page.locator('text=Full Dataset')).not.toContainText('Unlock');
  });

  test('existing user: study plan → payment → auto-select', async ({ page }) => {
    await page.goto('/login');
    await helper.signIn();

    await page.goto('/study-plan-form');
    await page.click('text=Unlock full dataset with comprehensive plan');

    await helper.completeMockPayment();
    await helper.waitForSubscriptionActivation();

    const fullDatasetButton = page.locator('[data-dataset="full"]');
    await expect(fullDatasetButton).toHaveAttribute('data-selected', 'true');
  });

  test('handles network failure gracefully', async ({ page }) => {
    await page.goto('/study-plan-form');

    await page.route('**/api/billing/**', (route) => route.abort());

    await page.click('text=Unlock full dataset');

    await expect(page.locator('text=Network error')).toBeVisible();
    await expect(page.locator('text=Try Again')).toBeVisible();
  });
});
