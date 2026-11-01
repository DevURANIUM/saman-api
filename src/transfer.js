'use strict';
const { ApiError } = require('./errors');
function digits(value) {
  return String(value ?? '').replace(/[\u06f0-\u06f9\u0660-\u0669]/g, d => String('\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.includes(d)
    ? '\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.indexOf(d) : '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(d)));
}
function cardPair(input = {}) {
  const source = digits(input.source).replace(/\s/g, '');
  const destination = digits(input.destination).replace(/\s/g, '');
  if (!/^\d{16}$/.test(source) || !/^\d{16}$/.test(destination)) throw new ApiError('source and destination must be full 16-digit card numbers', 400);
  if (source === destination) throw new ApiError('source and destination must differ', 400);
  return { source, destination };
}
function cardTransfer(input = {}, secrets = false) {
  if (input.isMostReferredDestination !== undefined && typeof input.isMostReferredDestination !== 'boolean') throw new ApiError('invalid isMostReferredDestination', 400);
  const pair = cardPair(input);
  const text = digits(input.amount);
  const amount = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(amount) || amount <= 0) throw new ApiError('amount must be a positive integer in IRR', 400);
  const result = { ...pair, amount };
  if (secrets) {
    for (const [key, re] of [['cvv2', /^\d{3,4}$/], ['pin2', /^\d{4,12}$/], ['expireDate', /^1[34]\d{2}(0[1-9]|1[0-2])$/]]) {
      result[key] = digits(input[key]);
      if (!re.test(result[key])) throw new ApiError('invalid ' + key, 400);
    }
    if (input.transactionPin !== undefined) {
      result.transactionPin = digits(input.transactionPin);
      if (!/^\d{4,12}$/.test(result.transactionPin)) throw new ApiError('invalid transactionPin', 400);
    }
    if (input.trackerId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.trackerId)) throw new ApiError('invalid trackerId', 400);
    if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 500)) throw new ApiError('invalid description', 400);
  }
  return result;
}
function depositNumber(value) {
  const number = digits(value).replace(/\s/g, '');
  if (!/^\d+(?:-\d+)*$/.test(number) || number.length < 5 || number.length > 40)
    throw new ApiError('invalid deposit number; preserve bank hyphens', 400);
  return number;
}
function ibanNumber(value) {
  const iban = digits(value).replace(/\s/g, '').toUpperCase();
  if (!/^IR\d{24}$/.test(iban)) throw new ApiError('invalid Iranian IBAN', 400);
  const numeric = iban.slice(4) + iban.slice(0, 4).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const ch of numeric) remainder = (remainder * 10 + Number(ch)) % 97;
  if (remainder !== 1) throw new ApiError('invalid IBAN checksum', 400);
  return iban;
}
function bankTransfer(input = {}, method) {
  if (input.isMostReferredDestination !== undefined && typeof input.isMostReferredDestination !== 'boolean') throw new ApiError('invalid isMostReferredDestination', 400);
  const source = depositNumber(input.source);
  const destination = method === 'PAYA' ? ibanNumber(input.destination) : depositNumber(input.destination);
  if (source === destination) throw new ApiError('source and destination must differ', 400);
  const amountText = digits(input.amount), amount = Number(amountText);
  if (!/^\d+$/.test(amountText) || !Number.isSafeInteger(amount) || amount <= 0) throw new ApiError('amount must be a positive integer in IRR', 400);
  if (method === 'PAYA' && (typeof input.reasonCode !== 'string' || !/^[A-Z0-9]{1,20}$/.test(input.reasonCode))) throw new ApiError('reasonCode is required; see transfer-reasons', 400);
  if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 500)) throw new ApiError('invalid description', 400);
  if (input.trackerId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.trackerId)) throw new ApiError('invalid trackerId', 400);
  const transactionPin = input.transactionPin === undefined ? undefined : digits(input.transactionPin);
  if (transactionPin !== undefined && !/^\d{4,12}$/.test(transactionPin)) throw new ApiError('invalid transactionPin', 400);
  return { source, destination, amount, transactionPin };
}
module.exports = { cardPair, cardTransfer, depositNumber, ibanNumber, bankTransfer };
