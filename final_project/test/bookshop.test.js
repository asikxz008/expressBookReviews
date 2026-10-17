const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const app = require('../index');
const { createBookClient } = require('../router/general');
const original = require('../router/booksdb');
let server, base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
async function request(url, method = 'GET', body, cookie) {
  const response = await fetch(base + url, {
    method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function login(username) {
  assert.equal((await request('/register', 'POST', { username, password: 'test-password' })).status, 201);
  const response = await request('/customer/login', 'POST', { username, password: 'test-password' });
  assert.equal(response.status, 200);
  assert.ok(response.cookie);
  return response.cookie;
}
test('catalog, ISBN, all books for an author, title and initial reviews', async () => {
  assert.deepEqual((await request('/')).data, original);
  assert.deepEqual((await request('/isbn/1')).data, original['1']);
  assert.deepEqual(Object.keys((await request('/author/Unknown')).data), ['4', '5', '6', '7']);
  assert.deepEqual((await request('/title/Things%20Fall%20Apart')).data, { 1: original['1'] });
  assert.deepEqual((await request('/review/1')).data, {});
  assert.equal((await request('/isbn/no-book')).status, 404);
  assert.equal((await request('/isbn/__proto__')).status, 404);
  assert.equal((await request('/author/nobody')).status, 404);
  assert.equal((await request('/title/no-title')).status, 404);
});
test('Axios async callback, Promise and async/await clients make HTTP requests', async () => {
  const client = createBookClient(base);
  let callbackCount = 0;
  assert.deepEqual(await client.getAllBooks((error, data) => {
    assert.ifError(error); callbackCount++; assert.deepEqual(data, original);
  }), original);
  assert.equal(callbackCount, 1);
  assert.deepEqual(await client.getBooksByISBN('1'), original['1']);
  assert.equal(Object.keys(await client.getBooksByAuthor('Unknown')).length, 4);
  assert.deepEqual(await client.getBooksByTitle('Things Fall Apart'), { 1: original['1'] });
  await assert.rejects(client.getBooksByISBN('missing'), error => error.response.status === 404);
  const unreachable = createBookClient('http://127.0.0.1:1');
  let receivedError;
  await unreachable.getAllBooks(error => { receivedError = error; });
  assert.ok(receivedError);
});
test('invalid credentials, duplicate registration and unauthorized writes are rejected', async () => {
  assert.equal((await request('/register', 'POST', {})).status, 400);
  assert.equal((await request('/register', 'POST', { username: 'x', password: '123' })).status, 400);
  await login('validation_user');
  assert.equal((await request('/register', 'POST', { username: 'validation_user', password: 'different' })).status, 409);
  assert.equal((await request('/customer/login', 'POST', { username: 'validation_user', password: 'wrong' })).status, 401);
  assert.equal((await request('/customer/login', 'POST', { username: {}, password: [] })).status, 401);
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: 'hello' })).status, 401);
  assert.equal((await request('/customer/auth/review/1', 'DELETE')).status, 401);
  assert.equal((await request('/customer/auth/review/1', 'DELETE', undefined, 'connect.sid=forged')).status, 401);
});
test('two users can add/update/delete only their own reviews', async () => {
  const alice = await login('alice');
  const bob = await login('bob');
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: 'first' }, alice)).data.message, 'Review successfully added');
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: 'updated' }, alice)).data.message, 'Review successfully updated');
  assert.equal((await request('/customer/auth/review/1', 'DELETE', undefined, bob)).status, 404);
  assert.equal((await request('/review/1')).data.alice, 'updated');
  await request('/customer/auth/review/1?review=from-query', 'PUT', undefined, bob);
  assert.deepEqual((await request('/review/1')).data, { alice: 'updated', bob: 'from-query' });
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: ' ' }, alice)).status, 400);
  assert.equal((await request('/customer/auth/review/999', 'PUT', { review: 'valid' }, alice)).status, 404);
  assert.equal((await request('/customer/auth/review/999', 'DELETE', undefined, alice)).status, 404);
  assert.deepEqual((await request('/customer/auth/review/1', 'DELETE', undefined, alice)).data.reviews, { bob: 'from-query' });
  assert.deepEqual((await request('/customer/auth/review/1', 'DELETE', undefined, bob)).data.reviews, {});
  assert.deepEqual(original['1'].reviews, {});
});
test('simultaneous duplicate registrations yield one success', async () => {
  const attempts = await Promise.all(Array.from({ length: 5 }, () => request('/register', 'POST', { username: 'race_user', password: 'concurrent-password' })));
  assert.equal(attempts.filter(r => r.status === 201).length, 1);
  assert.equal(attempts.filter(r => r.status === 409).length, 4);
});
test('parallel users preserve every review while reads continue', async () => {
  const cookies = await Promise.all(Array.from({ length: 8 }, (_, i) => login(`parallel_${i}`)));
  const responses = await Promise.all(cookies.map((cookie, i) => request('/customer/auth/review/2', 'PUT', { review: `review ${i}` }, cookie)).concat(
    Array.from({ length: 20 }, () => request('/'))));
  assert.ok(responses.every(r => r.status === 200));
  assert.equal(Object.keys((await request('/review/2')).data).length, 8);
  await Promise.all(cookies.map(cookie => request('/customer/auth/review/2', 'DELETE', undefined, cookie)));
  assert.deepEqual((await request('/review/2')).data, {});
});
test('BOOKS_JSON override loads real ISBN keys and preserves seeded reviews', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bookshop-fixture-'));
  try {
    const filename = path.join(directory, 'books.json');
    const fixture = { '9780000000001': { author: 'Fixture Author', title: 'Fixture Title', reviews: { reader: 'seeded' } } };
    fs.writeFileSync(filename, JSON.stringify(fixture));
    const result = spawnSync(process.execPath, ['-e', "console.log(JSON.stringify(require('./router/catalog')))"], {
      cwd: path.resolve(__dirname, '..'), env: { ...process.env, BOOKS_JSON: filename }, encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), fixture);
  } finally { fs.rmSync(directory, { recursive: true }); }
});
