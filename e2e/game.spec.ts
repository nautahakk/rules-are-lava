import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const csrfToken = '550e8400-e29b-41d4-a716-446655440000';
const runId = 'b071832d-a4d5-4a4d-9f6b-47565b3b5d85';

async function mockGame(page: Page) {
  const rules = [
    { id: 'suspicious_animal', label: 'Make an animal sound suspicious.', evaluator: 'semantic' },
    { id: 'six_words', label: 'Use exactly six words.', evaluator: 'deterministic' }
  ];
  let state = {
    id: runId,
    challengeDate: '2026-09-23',
    roundIndex: 0,
    lives: 3,
    score: 0,
    status: 'active',
    deadlineAt: '2099-09-23T12:00:30.000Z' as string | null,
    critterName: 'Pixel Panda',
    activeRules: rules,
    lastFailure: null as null | { ruleId: string; label: string; evaluator: 'semantic' }
  };
  const submitted: string[] = [];

  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/leaderboard') {
      await route.fulfill({ json: {
        topScore: 14,
        top: Array.from({ length: 10 }, (_, index) => ({
          rank: index + 1,
          critterName: index === 0 ? 'Binary Badger' : `Critter ${index + 1}`,
          score: 14 - index,
          isPlayer: false
        })),
        player: { rank: 27, critterName: 'Pixel Panda', score: state.score, isPlayer: true },
        resetAt: '2099-09-24T00:00:00.000Z',
        csrfToken
      } });
      return;
    }
    if (path === '/api/runs' && request.method() === 'POST') {
      await route.fulfill({ json: state });
      return;
    }
    if (path === `/api/runs/${runId}` && request.method() === 'GET') {
      await route.fulfill({ json: state });
      return;
    }
    if (path === `/api/runs/${runId}/answers` && request.method() === 'POST') {
      const input = request.postDataJSON() as { kind: 'answer' | 'timeout'; text?: string };
      if (input.text) submitted.push(input.text);
      const first = state.roundIndex === 0;
      const nextLives = first ? state.lives : state.lives - 1;
      state = {
        ...state,
        roundIndex: state.roundIndex + 1,
        lives: nextLives,
        score: first ? 1 : state.score,
        status: nextLives === 0 ? 'completed' : 'active',
        deadlineAt: nextLives === 0 ? null : '2099-09-23T12:00:30.000Z',
        lastFailure: first ? null : {
          ruleId: 'suspicious_animal',
          label: 'Make an animal sound suspicious.',
          evaluator: 'semantic'
        }
      };
      await route.fulfill({ json: {
        ...state,
        verdicts: first ? [
          { ruleId: 'suspicious_animal', label: rules[0].label, evaluator: 'semantic', passed: true, probability: 0.78 },
          { ruleId: 'six_words', label: rules[1].label, evaluator: 'deterministic', passed: true, detail: '6 of 6 words' }
        ] : [
          { ruleId: 'suspicious_animal', label: rules[0].label, evaluator: 'semantic', passed: false, probability: 0.22 },
          { ruleId: 'six_words', label: rules[1].label, evaluator: 'deterministic', passed: true, detail: '6 of 6 words' }
        ]
      } });
      return;
    }
    await route.abort();
  });

  return submitted;
}

async function expectAxeClean(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical')).toEqual([]);
}

test('uses square developer-tool framing', async ({ page }) => {
  await mockGame(page);
  await page.goto('/');

  await expect(page.locator('.game-shell')).toHaveCSS('border-radius', '0px');
  await expect(page.getByRole('button', { name: "Play today's challenge" })).toHaveCSS('border-radius', '0px');

  await page.getByRole('button', { name: "Play today's challenge" }).click();
  await expect(page.locator('.rule-card').first()).toHaveCSS('border-radius', '0px');
});

test('plays through verdicts, game over, leaderboard, and X sharing', async ({ page }) => {
  const submitted = await mockGame(page);
  await page.goto('/');
  await expect(page.getByText("Today's best: 14 rounds")).toBeVisible();
  await expectAxeClean(page);

  await page.getByRole('button', { name: "Play today's challenge" }).click();
  await expect(page.getByRole('textbox', { name: 'Your response' })).toBeVisible();
  await expectAxeClean(page);

  const response = 'Ash fox slyly jumps 7 now?';
  await page.getByRole('textbox', { name: 'Your response' }).fill(response);
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByText('Pass · 78%')).toBeVisible();
  await expect(page.getByText('6 of 6 words')).toBeVisible();
  await expectAxeClean(page);

  for (let failure = 0; failure < 3; failure += 1) {
    await page.getByRole('textbox', { name: 'Your response' }).fill(`suspicious fox ${failure}`);
    await page.getByRole('button', { name: 'Submit response' }).click();
  }

  await expect(page.getByRole('heading', { name: 'Run melted' })).toBeVisible();
  await expect(page.getByRole('heading', { name: "Today's Survivors" })).toBeVisible();
  await expect(page.getByText('Your best')).toBeVisible();
  await expect(page.getByText(/resets in/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
  const share = page.getByRole('link', { name: 'Share on X' });
  const shareText = decodeURIComponent((await share.getAttribute('href')) ?? '');
  expect(shareText).toContain('I survived 1 rounds');
  expect(shareText).toContain('Make an animal sound suspicious.');
  expect(shareText).not.toContain(response);
  expect(submitted).toContain(response);
  await expectAxeClean(page);
});

test('fits a phone viewport, submits by keyboard, and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockGame(page);
  await page.goto('/');
  await page.getByRole('button', { name: "Play today's challenge" }).click();
  const input = page.getByRole('textbox', { name: 'Your response' });
  await input.fill('Ash fox slyly jumps 7 now?');
  await input.press('Control+Enter');
  await expect(page.getByText('Pass · 78%')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const motion = await page.locator('.rule-card').first().evaluate(element => {
    const style = getComputedStyle(element);
    return { animationName: style.animationName, transitionDuration: style.transitionDuration };
  });
  expect(motion.animationName).toBe('none');
  expect(motion.transitionDuration).toBe('0s');
});
