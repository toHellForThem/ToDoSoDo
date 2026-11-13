/**
 * E2E smoke на web-сборке: регистрация, вход, добавление задачи,
 * переживание перезагрузки и открытие календаря.
 *
 * Бэкенд и статика поднимаются Playwright-конфигом; адрес API вшивается
 * в сборку через `EXPO_PUBLIC_SOCKET_URL`.
 */

import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const unique = Date.now().toString(36);
const username = `e2e_${unique}`;
const password = 'e2e-password-123';
const taskText = `E2E task ${unique}`;

test('smoke: login, add task, sync, calendar', async ({ page }) => {
  await page.goto('/');

  // Открываем настройки и регистрируемся.
  await page.getByTestId('header-settings').click();
  await page.getByTestId('auth-register').click();
  await page.getByTestId('auth-username').fill(username);
  await page.getByTestId('auth-password').fill(password);
  await page.getByTestId('auth-submit').click();

  // После регистрации сервер переключает форму на вход.
  await expect(page.getByTestId('auth-submit')).toHaveText(/log in/i);
  await page.getByTestId('auth-username').fill(username);
  await page.getByTestId('auth-password').fill(password);
  await page.getByTestId('auth-submit').click();

  // Успешный вход: карточка профиля показывает выход из облака.
  await expect(page.getByText(/log out|выйти/i)).toBeVisible();

  // Добавляем задачу на вкладке To Do.
  await page.getByTestId('tab-todo').click();
  await page.getByTestId('todo-input').fill(taskText);
  await page.getByTestId('todo-input').press('Enter');
  await expect(page.getByText(taskText)).toBeVisible();

  // Sync/smoke: задача переживает перезагрузку приложения.
  await page.reload();
  await expect(page.getByText(taskText)).toBeVisible();

  // Календарь открывается на RPG-дашборде.
  await page.getByTestId('tab-rpg').click();
  await page.getByTestId('open-calendar').click();
  await expect(page.getByTestId('calendar-modal')).toBeVisible();
});
