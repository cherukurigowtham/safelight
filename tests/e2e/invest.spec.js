import { test, expect } from '@playwright/test';

test.describe('Dashboard & Investment', () => {

  test.beforeEach(async ({ page }) => {
    // Mock Profile (Logged In)
    await page.route('**/api/profile', async route => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          user: { id: 1, fullName: 'Investor', email: 'investor@example.com', balance: 1000 }
        }
      });
    });

    // Mock Posts
    await page.route('**/api/posts*', async route => {
      await route.fulfill({
        status: 200,
        json: [
          {
            id: 101,
            content: 'Next Gen AI Startup',
            category: 'Tech',
            amount_needed: 10000,
            amount_funded: 2000,
            created_at: new Date().toISOString(),
            author: 'Entrepreneur'
          },
          {
            id: 102,
            content: 'Organic Farm Expansion',
            category: 'Agriculture',
            amount_needed: 5000,
            amount_funded: 100,
            created_at: new Date().toISOString(),
            author: 'Farmer'
          }
        ]
      });
    });

    // Simulate logged in state in localStorage
    await page.addInitScript(() => {
        localStorage.setItem('accessToken', 'fake-jwt');
        localStorage.setItem('user', JSON.stringify({ id: 1, fullName: 'Investor', email: 'investor@example.com', balance: 1000 }));
    });

    await page.goto('/');
  });

  test('View Posts', async ({ page }) => {
    await expect(page.getByText('Next Gen AI Startup')).toBeVisible();
    await expect(page.getByText('Organic Farm Expansion')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Invest' }).first()).toBeVisible();
  });

  test('Create Post', async ({ page }) => {
     // Mock Create API
     await page.route('**/api/posts', async route => {
         if (route.request().method() === 'POST') {
             const body = JSON.parse(route.request().postData());
             expect(body.content).toBe('My New Business');
             expect(body.amountNeeded).toBe('1000');
             expect(body.category).toBe('Tech');

             await route.fulfill({
                 status: 201,
                 json: { id: 103, content: 'My New Business' }
             });
         } else {
             await route.continue();
         }
     });

     // Fill form
     // The CreatePost component has a textarea and input type number.
     await page.locator('textarea').fill('My New Business');
     await page.locator('input[type="number"]').first().fill('1000'); // Might match the search input? No, search is text.
     // Better selector:
     // The create post form is inside a container with title "Create Business Proposal".
     // But filter hasText matches parent containers too. Use the form directly.
     const createForm = page.locator('form').filter({ hasText: 'Post' });
     await createForm.locator('textarea').fill('My New Business');
     await createForm.getByRole('spinbutton').fill('1000');
     await createForm.getByRole('combobox').selectOption('Tech');

     const createPromise = page.waitForRequest(req => req.url().includes('/api/posts') && req.method() === 'POST');
     await createForm.getByRole('button', { name: 'Post' }).click();
     await createPromise;
  });

  test('Invest in Post', async ({ page }) => {
    // Mock Investment
    await page.route('**/api/invest', async route => {
      const body = JSON.parse(route.request().postData());
      expect(body.postId).toBe(101);
      expect(body.amount).toBe(500);

      await route.fulfill({
        status: 201,
        json: {
          success: true,
          investment: { id: 999, amount: 500 }
        }
      });
    });

    // Open the form
    const investButtons = page.getByRole('button', { name: 'Invest' });
    // Index 0: Post 1 (inside card)
    // Index 1: Post 1 (action button)
    // Index 2: Post 2 (inside card)
    // Index 3: Post 2 (action button)
    await investButtons.nth(1).click();

    const form = page.locator('form').filter({ hasText: 'Confirm' });
    await form.getByRole('spinbutton').fill('500');

    const investPromise = page.waitForRequest(req => req.url().includes('/api/invest') && req.method() === 'POST');
    await form.getByRole('button', { name: 'Confirm' }).click();
    await investPromise;
  });

});
