'use strict';
const { ApiError } = require('./errors');
const { transactionQuery } = require('./transactions');

function normalizeCode(value) {
  if (typeof value !== 'string') throw new ApiError('tracking number must be a string', 400);
  return value.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, d => String('\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.includes(d)
    ? '\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.indexOf(d) : '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(d))).trim();
}
function integer(value, fallback, max, label) {
  if (value === undefined) return fallback;
  if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value)) || +value < 1 || +value > max) throw new ApiError('invalid ' + label, 400);
  return Number(value);
}
function matchedField(detail, code, matchBy) {
  const fields = [];
  if (matchBy !== 'reference') {
    fields.push(['trackingCode', detail.trackingCode], ['newReceipt.trackingCode', detail.newReceipt?.trackingCode],
      ['paymentNumber', detail.paymentNumber]);
    for (const [i, row] of (detail.receipt?.footer || []).entries())
      if (/\u067e\u06cc\u06af\u06cc\u0631\u06cc/.test(row.title || '')) fields.push([`receipt.footer[${i}].value`, row.value]);
  }
  if (matchBy !== 'tracking') fields.push(['referralNumber', detail.referralNumber]);
  // Exact identifier equality only: never use substrings of descriptions or
  // parseInt, which could match a different transaction or drop leading zeros.
  return fields.find(([, value]) => typeof value === 'string' && normalizeCode(value) === code)?.[0];
}
async function findTransaction(client, value, input = {}) {
  const code = normalizeCode(value);
  if (!/^\d{1,64}$/.test(code)) throw new ApiError('invalid tracking number: pass the tracking/reference number first, and the deposit number using --account in CLI', 400);
  const { pages, maxTransactions, matchBy = 'any', ...filters } = input;
  if (!['any', 'tracking', 'reference'].includes(matchBy)) throw new ApiError('invalid matchBy', 400);
  const pageLimit = integer(pages, 10, 50, 'pages');
  const transactionLimit = integer(maxTransactions, 200, 2000, 'maxTransactions');
  const params = transactionQuery({ size: 20, ...filters, details: false });
  params.depositNumber = await client.resolveDepositNumber(params.depositNumber, { verify: true });
  const startPage = params.page;
  const seen = new Set();
  let pagesScanned = 0, transactionsScanned = 0;
  const result = (extra = {}) => ({ found: false, trackingNumber: code, depositNumber: params.depositNumber,
    matchBy, pagesScanned, transactionsScanned, ...extra });
  for (let offset = 0; offset < pageLimit; offset++) {
    if (startPage + offset > 100000) return result({ searchComplete: false, stopReason: 'page_limit' });
    const list = await client.transactions({ ...params, page: startPage + offset });
    pagesScanned++;
    if (!Array.isArray(list.elements)) throw new ApiError('unexpected transaction search response', 502);
    if (!list.elements.length) return result({ searchComplete: true, stopReason: 'end_of_history' });
    let fresh = 0;
    for (const row of list.elements) {
      if (typeof row.id !== 'string' || !row.id) throw new ApiError('transaction search encountered a row without an id', 502);
      if (seen.has(row.id)) continue;
      if (transactionsScanned >= transactionLimit) return result({ searchComplete: false, stopReason: 'transaction_limit' });
      seen.add(row.id); fresh++;
      const detail = await client.transactionDetail(row.id);
      transactionsScanned++;
      const field = matchedField(detail, code, matchBy);
      if (field) return result({ found: true, matchedField: field, id: row.id, transaction: detail,
        searchComplete: true, stopReason: 'matched' });
    }
    if (list.hasNext === false) return result({ searchComplete: true, stopReason: 'end_of_history' });
    if (transactionsScanned >= transactionLimit) return result({ searchComplete: false, stopReason: 'transaction_limit' });
    if (!fresh) return result({ searchComplete: false, stopReason: 'repeated_page' });
  }
  return result({ searchComplete: false, stopReason: 'page_limit' });
}
module.exports = { findTransaction, matchedField };
