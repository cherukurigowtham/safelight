import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {

  test('Signup Flow', async ({ page }) => {
    // Mock API requests
    await page.route('**/api/signup/request-otp', async route => {
      await route.fulfill({ status: 200, json: { success: true } });
    });

    await page.route('**/api/signup/complete', async route => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          accessToken: 'fake-jwt',
          user: { id: 1, fullName: 'Test User', email: 'test@example.com', balance: 1000 }
        }
      });
    });

    await page.route('**/api/profile', async route => {
       await route.fulfill({
           status: 200,
           json: {
               success: true,
               user: { id: 1, fullName: 'Test User', email: 'test@example.com', balance: 1000 }
           }
       });
    });

    await page.goto('/signup');

    // Step 1
    await page.getByPlaceholder('Full Name').fill('Test User');
    await page.getByPlaceholder('Email').fill('test@example.com');

    // Solve Captcha (The logic is dynamic, but we can hack the input or just use the answer)
    // The page shows "Solve: A + B". We need to parse it.
    const captchaText = await page.locator('p:has-text("Solve:")').textContent();
    // Expected format: "Solve: 5 + 3"
    const parts = captchaText?.match(/Solve: (\d+) \+ (\d+)/);
    if (parts) {
        const ans = parseInt(parts[1]) + parseInt(parts[2]);
        await page.getByPlaceholder('CAPTCHA answer').fill(ans.toString());
    }

    await page.getByRole('button', { name: 'Send OTP' }).click();

    // Step 2
    await expect(page.getByPlaceholder('Password', { exact: true })).toBeVisible();
    await page.getByPlaceholder('Password', { exact: true }).fill('Password123!');
    await page.getByPlaceholder('Confirm Password').fill('Password123!');
    await page.getByPlaceholder('Email OTP').fill('123456');

    await page.getByRole('button', { name: 'Verify & Create Account' }).click();

    // Verify redirect to home
    await expect(page).toHaveURL('/');

    // Verify logged in state (Header shows "Hello, Test User")
    await expect(page.getByText('Hello, Test User')).toBeVisible();
  });

  test('Login Flow', async ({ page }) => {
    await page.route('**/api/login', async route => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          accessToken: 'fake-jwt',
          user: { id: 1, fullName: 'Login User', email: 'login@example.com' }
        },
        headers: {
            'set-cookie': 'refreshToken=fake-refresh-token; Path=/api/refresh; HttpOnly'
        }
      });
    });

    await page.route('**/api/profile', async route => {
       await route.fulfill({
           status: 200,
           json: {
               success: true,
               user: { id: 1, fullName: 'Login User', email: 'login@example.com', balance: 1000 }
           }
       });
    });

    await page.goto('/login');

    await page.getByPlaceholder('Email').fill('login@example.com');
    await page.getByPlaceholder('Password').fill('password');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByText('Hello, Login User')).toBeVisible();
  });

});
