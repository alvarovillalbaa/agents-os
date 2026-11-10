import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyObject, contactFields, CrmError, FIELD_NAMES, pageOffset, revision, uuid } from '../src/domain.js';
const base = { name: 'Example Person', email: 'person@example.test', organization: 'Authored Studio', phone: '',
  stage: 'lead', notes: 'First line\nSecond line', nextStep: 'Review authored brief', followUpDate: '2028-02-29' };
const rejects = (fn: () => unknown) => assert.throws(fn, error => error instanceof CrmError && error.status === 400);

test('contact input retains multiline notes and a real leap date while normalizing edge whitespace', () => {
  const actual = contactFields({ ...base, name: ' Example Person ', notes: ' First line\nSecond line ' });
  assert.equal(actual.name, base.name); assert.equal(actual.notes, base.notes); assert.equal(actual.followUpDate, '2028-02-29');
});
test('calendar dates cannot normalize an impossible day into a later month', () => {
  for (const date of ['2027-02-29', '2026-02-30', '2026-13-01', '2026-11-10T00:00:00Z', '']) rejects(() => contactFields({ ...base, followUpDate: date }));
});
test('email and field limits are server-side boundaries', () => {
  for (const patch of [{ email: 'person\n@example.test' }, { email: 'missing-at' }, { name: ' ' }, { name: 'a'.repeat(121) }, { notes: 'a'.repeat(6001) }, { notes: 'unsafe\0text' }, { stage: 'invented' }]) {
    rejects(() => contactFields({ ...base, ...patch }));
  }
});
test('contact bodies reject writable scope, revision and journal injection', () => {
  for (const key of ['companyId', 'audit', 'activity_sent_revision', 'linkedIssueIds', '__proto__']) {
    rejects(() => bodyObject(JSON.parse(JSON.stringify(base).slice(0, -1) + ',' + JSON.stringify(key) + ':"injected"}'), FIELD_NAMES));
  }
});
test('malformed IDs, revisions and paging inputs fail before SQL', () => {
  for (const id of ['', 'local-board', "' OR 1=1", '00000000-0000-0000-0000-000000000000']) rejects(() => uuid(id));
  for (const value of [0, -1, 1.5, '1', null, 2147483647]) rejects(() => revision(value));
  for (const value of ['-1', '1.5', 'Infinity', '1 OR 1=1', ['1']]) rejects(() => pageOffset(value));
});
