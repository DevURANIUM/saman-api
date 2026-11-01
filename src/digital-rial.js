'use strict';
const crypto = require('node:crypto');
const { ApiError } = require('./errors');
const { depositNumber } = require('./transfer');
function object(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError('JSON object required', 400);
  return input;
}
function integer(value, fallback, min, max, name) {
  if (value === undefined) return fallback;
  if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(+value) || +value < min || +value > max)
    throw new ApiError('invalid ' + name, 400);
  return +value;
}
function allowed(input, names) {
  object(input);
  for (const name of Object.keys(input)) if (!names.includes(name)) throw new ApiError('unsupported field: ' + name, 400);
}
function uuid(value, name = 'walletId') {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    throw new ApiError('invalid ' + name, 400);
  return value;
}
function pagination(input = {}, max = 100) {
  allowed(input, ['page', 'size']);
  return { page: integer(input.page, 0, 0, 100000, 'page'), size: integer(input.size, 10, 1, max, 'size') };
}
function enums(value, fallback, choices, name) {
  const values = value === undefined ? fallback : typeof value === 'string' ? value.split(',') : value;
  if (!Array.isArray(values) || !values.length || values.some(item => typeof item !== 'string' || !choices.includes(item)))
    throw new ApiError('invalid ' + name, 400);
  return [...new Set(values)];
}
function walletsQuery(input = {}) {
  allowed(input, ['page', 'size', 'walletStates', 'walletTypes']);
  return { ...pagination({ page: input.page, size: input.size }, 1000),
    walletStates: enums(input.walletStates, ['NORMAL', 'BAN'], ['NORMAL', 'BAN'], 'walletStates'),
    walletTypes: enums(input.walletTypes, ['BUSINESS', 'CUSTOMER'], ['BUSINESS', 'CUSTOMER'], 'walletTypes') };
}
function customerType(input = {}) {
  allowed(input, ['walletType']);
  if (input.walletType !== undefined && input.walletType !== 'CUSTOMER') throw new ApiError('only CUSTOMER activation is supported by this capture', 400);
  return 'CUSTOMER';
}
function activation(input = {}) {
  allowed(input, ['walletType', 'verificationCode']);
  const walletType = customerType(input.walletType === undefined ? {} : { walletType: input.walletType });
  if (typeof input.verificationCode !== 'string') throw new ApiError('verificationCode required', 400);
  const verificationCode = input.verificationCode.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, d => String('\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.includes(d)
    ? '\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.indexOf(d) : '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(d)));
  if (!/^\d{4,10}$/.test(verificationCode)) throw new ApiError('invalid verificationCode', 400);
  return { verificationCode, walletType };
}
function requestId(input = {}) {
  return input.requestId === undefined ? crypto.randomUUID() : uuid(input.requestId, 'requestId');
}
function movement(walletId, input = {}) {
  allowed(input, ['amount', 'depositNumber', 'requestId']);
  const amount = integer(input.amount, undefined, 1, Number.MAX_SAFE_INTEGER, 'amount');
  if (amount === undefined) throw new ApiError('amount required', 400);
  return { amount, depositNumber: depositNumber(input.depositNumber), walletId: uuid(walletId), requestId: requestId(input) };
}
function institutions(input = {}) {
  allowed(input, ['length', 'offset', 'title']);
  if (input.title !== undefined && (typeof input.title !== 'string' || input.title.length > 200)) throw new ApiError('invalid title', 400);
  return { length: integer(input.length, 10, 1, 100, 'length'), offset: integer(input.offset, 0, 0, 1000000, 'offset'), title: input.title ?? '' };
}
module.exports = { allowed, uuid, pagination, walletsQuery, customerType, activation, requestId, movement, institutions, integer };
