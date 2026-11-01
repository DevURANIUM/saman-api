'use strict';
const { ApiError } = require('./errors');
const { depositNumber } = require('./transfer');

function transactionQuery(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError('transaction parameters must be an object', 400);
  if (input.account !== undefined) {
    if (input.depositNumber !== undefined && input.account !== input.depositNumber) throw new ApiError('account and depositNumber must match', 400);
    input = { ...input, depositNumber: input.account };
    delete input.account;
  }
  const query = { page: 0, size: 10 };
  const allowed = ['depositNumber', 'page', 'size', 'fromDate', 'toDate', 'fromAmount', 'toAmount', 'query', 'isWithdrawal', 'details'];
  for (const key of Object.keys(input)) if (!allowed.includes(key)) throw new ApiError('unsupported transaction parameter: ' + key, 400);
  for (const key of allowed) {
    const value = input[key];
    if (value === undefined) continue;
    if (!['string', 'number', 'boolean'].includes(typeof value)) throw new ApiError('invalid ' + key, 400);
    query[key] = value;
  }
  if (query.depositNumber !== undefined) {
    if (typeof query.depositNumber !== 'string') throw new ApiError('depositNumber must be a string', 400);
    query.depositNumber = depositNumber(query.depositNumber);
  }
  if (query.query !== undefined && typeof query.query !== 'string') throw new ApiError('query must be a string', 400);
  for (const [key, min, max] of [['page', 0, 100000], ['size', 1, 100],
    ['fromDate', 0, 253402300799], ['toDate', 0, 253402300799]]) {
    if (query[key] === undefined) continue;
    if (!/^\d+$/.test(String(query[key])) || !Number.isSafeInteger(Number(query[key])) || +query[key] < min || +query[key] > max)
      throw new ApiError('invalid ' + key, 400);
    query[key] = Number(query[key]);
  }
  for (const key of ['fromAmount', 'toAmount']) {
    if (query[key] !== undefined && !/^\d+(?:\.\d+)?$/.test(String(query[key]))) throw new ApiError('invalid ' + key, 400);
  }
  // Compare decimal strings exactly, including amounts beyond Number precision.
  if (query.fromAmount !== undefined && query.toAmount !== undefined) {
    const parts = value => String(value).split('.');
    const [a, af = ''] = parts(query.fromAmount), [b, bf = ''] = parts(query.toAmount);
    const scale = Math.max(af.length, bf.length);
    if (BigInt(a + af.padEnd(scale, '0')) > BigInt(b + bf.padEnd(scale, '0')))
      throw new ApiError('fromAmount must not exceed toAmount', 400);
  }
  if (query.fromDate !== undefined && query.toDate !== undefined && query.fromDate > query.toDate)
    throw new ApiError('fromDate must not exceed toDate', 400);
  for (const key of ['isWithdrawal', 'details']) {
    if (query[key] === undefined) continue;
    if (!['true', 'false'].includes(String(query[key]))) throw new ApiError('invalid ' + key, 400);
    query[key] = String(query[key]) === 'true';
  }
  return query;
}
module.exports = { transactionQuery };
