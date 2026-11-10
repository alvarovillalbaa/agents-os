import { createHash } from 'node:crypto';

import { STAGES, type ContactFields, type Stage } from './model.js';

export const DATABASE_NAMESPACE = 'plugin_agents_os_12566308fa';
export class CrmError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function requireValue(value: unknown, message: string): asserts value {
  if (!value) throw new CrmError(400, message);
}
export function uuid(value: unknown, label = 'ID'): string {
  requireValue(typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value), `${label} must be a UUID.`);
  return value;
}
export function bodyObject(value: unknown, allowed: string[]): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'A JSON object is required.');
  const record = value as Record<string, unknown>;
  requireValue(Object.keys(record).every(key => allowed.includes(key)), 'Unexpected field.');
  return record;
}
function text(value: unknown, label: string, max: number, multiline = false): string {
  requireValue(typeof value === 'string' && value.length <= max, `${label} is required and must be at most ${max} characters.`);
  requireValue(!(multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/ : /[\u0000-\u001f]/).test(value), `${label} contains unsupported characters.`);
  return value.trim();
}
export const FIELD_NAMES = ['name', 'organization', 'email', 'phone', 'stage', 'notes', 'nextStep', 'followUpDate'];
export function contactFields(input: Record<string, unknown>): ContactFields {
  const name = text(input.name, 'Name', 120); requireValue(name, 'Name is required.');
  const email = text(input.email, 'Email', 254);
  requireValue(email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email address.');
  requireValue(STAGES.includes(input.stage as Stage), 'Choose a valid stage.');
  const followUpDate = input.followUpDate;
  requireValue(followUpDate === null || (typeof followUpDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(followUpDate)
    && Number.isFinite(Date.parse(followUpDate)) && new Date(followUpDate).toISOString().slice(0, 10) === followUpDate), 'Choose a valid follow-up date.');
  return { name, email, organization: text(input.organization, 'Organization', 160), phone: text(input.phone, 'Phone', 48),
    stage: input.stage as Stage, notes: text(input.notes, 'Notes', 6000, true), nextStep: text(input.nextStep, 'Next step', 280), followUpDate: followUpDate as string | null };
}
export function revision(value: unknown): number {
  requireValue(Number.isSafeInteger(value) && Number(value) > 0 && Number(value) < 2147483647, 'A valid contact revision is required.');
  return Number(value);
}
export function pageOffset(value: unknown): number {
  if (value === undefined) return 0;
  requireValue(typeof value === 'string' && /^\d{1,7}$/.test(value), 'Invalid page.');
  return Number(value);
}
export function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
