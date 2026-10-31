import { badRequest } from './errors.js';

export function requireString(input, field, { maxLength = 255 } = {}) {
  const value = input[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`"${field}" must be a non-empty string`);
  }
  if (value.length > maxLength) {
    throw badRequest(`"${field}" must be at most ${maxLength} characters`);
  }
  return value.trim();
}

export function optionalString(input, field, options) {
  if (input[field] === undefined) return undefined;
  return requireString(input, field, options);
}

export function requireEnum(input, field, allowed) {
  const value = input[field];
  if (!allowed.includes(value)) {
    throw badRequest(`"${field}" must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

export function optionalEnum(input, field, allowed) {
  if (input[field] === undefined) return undefined;
  return requireEnum(input, field, allowed);
}

export function requirePositiveInt(input, field) {
  const value = input[field];
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw badRequest(`"${field}" must be a positive integer (minor units)`);
  }
  return value;
}

export function rejectUnknownFields(input, allowed) {
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw badRequest(`Unknown fields: ${unknown.join(', ')}`);
  }
}
