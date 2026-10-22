import assert from 'node:assert/strict';
import test from 'node:test';
import { handle, readJson } from '../../lib/meetpoint/server/http';
import { MeetPointError } from '../../lib/meetpoint/errors';

test('HTTP boundary returns consistent errors and never forwards an unexpected internal exception', async () => {
  const response = await handle(async () => { throw new Error('secret key or upstream body'); });
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(!(await response.text()).includes('secret key'));
  const invalid = await handle(async () => { throw new MeetPointError('INVALID_INPUT', '잘못된 입력'); });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, 'INVALID_INPUT');
});

test('JSON request limit is measured in bytes, with distinct invalid JSON and unsupported content type handling', async () => {
  const request = (body: string, contentType = 'application/json') => new Request('http://localhost/api/recommendations', { method: 'POST', headers: { 'Content-Type': contentType }, body });
  assert.deepEqual(await readJson(request('{"a":1}')), { a: 1 });
  await assert.rejects(readJson(request('{')), MeetPointError);
  await assert.rejects(readJson(request('{}', 'text/plain')), (error: unknown) => error instanceof MeetPointError && error.httpStatus === 415);
  await assert.rejects(readJson(request(JSON.stringify({ value: '가'.repeat(12000) }))), (error: unknown) => error instanceof MeetPointError && error.httpStatus === 413);
});
