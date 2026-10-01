// Run only against a disposable local instance. Creates two test accounts.
import assert from 'node:assert/strict';

const origin = process.env.PENNY_TEST_URL;
if (!origin || !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) {
  throw new Error('Set PENNY_TEST_URL to a disposable localhost instance, e.g. http://localhost:8081');
}
const email = `smoke-${Date.now()}@example.com`;
let cookie = '';
async function request(path, method = 'GET', body) {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: origin },
    body: body ? JSON.stringify(body) : undefined,
  });
  const session = response.headers.get('set-cookie');
  if (session) cookie = session.split(';')[0];
  return response;
}
async function json(path, method, body, status = 200) {
  const response = await request(path, method, body);
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
}

const page = await fetch(origin);
assert.equal(page.status, 200);
const html = await page.text();
assert.match(html, /id="root"/);
const asset = html.match(/src="([^"]+\.js)"/)[1];
assert.equal((await fetch(new URL(asset, origin))).status, 200);
assert.ok(page.headers.get('content-security-policy'));
assert.equal((await json('/health')).status, 'ok');

await json('/auth/signup', 'POST', { name: 'Smoke Test', email, password: 'smoke-test-password-123' }, 201);
assert.equal((await json('/auth/me')).email, email);
assert.equal((await json('/categories')).length, 9);
const category = await json('/categories', 'POST', { name: 'Smoke category', color: '#176a56' }, 201);
const expense = await json('/expenses', 'POST', { title: 'Backdated test', amount: '123.45', date: '2024-02-29', categoryId: category.id, notes: 'Leap day' }, 201);
let report = await json('/expenses?from=2024-02-01&to=2024-02-29');
assert.equal(report.totalCents, 12345);
assert.equal(report.expenses[0].date, '2024-02-29');
const firstSession = cookie;

await json('/auth/signup', 'POST', { name: 'Second Account', email: `other-${email}`, password: 'smoke-test-password-123' }, 201);
assert.equal((await json('/expenses')).count, 0);
assert.equal((await request(`/expenses/${expense.id}`, 'DELETE')).status, 404);
await json('/auth/signout', 'POST', {});
cookie = firstSession;

await json(`/expenses/${expense.id}`, 'PUT', { title: 'Edited test', amount: '10.10', date: '2023-12-31', categoryId: category.id, notes: '=1+1' });
report = await json('/expenses?from=2023-12-31&to=2023-12-31&group=year');
assert.equal(report.totalCents, 1010);
assert.equal(report.periods[0].date, '2023');
const csv = await request('/expenses/export');
assert.match(csv.headers.get('content-type'), /text\/csv/);
assert.match(await csv.text(), /'=1\+1/);
await json(`/expenses/${expense.id}`, 'DELETE');
await json(`/categories/${category.id}`, 'DELETE');
await json('/auth/signout', 'POST', {});
assert.equal((await request('/auth/me')).status, 401);
await json('/auth/signin', 'POST', { email, password: 'smoke-test-password-123' });
assert.equal((await json('/auth/me')).email, email);
await json('/auth/signout', 'POST', {});
console.log('HTTP smoke checks passed: assets, signup, signin, signout, isolation, categories, CRUD, date reports, CSV.');
