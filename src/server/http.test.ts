import { validCsrfRequest } from './http';

const token = '550e8400-e29b-41d4-a716-446655440000';

it('requires same-origin matching CSRF header and cookie', () => {
  expect(validCsrfRequest('https://game.test/api/runs', 'https://game.test', token, token)).toBe(true);
  expect(validCsrfRequest('https://game.test/api/runs', 'https://evil.test', token, token)).toBe(false);
  expect(validCsrfRequest('https://game.test/api/runs', 'https://game.test', token, `${token}x`)).toBe(false);
  expect(validCsrfRequest('https://game.test/api/runs', null, token, token)).toBe(false);
});
