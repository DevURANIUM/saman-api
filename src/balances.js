'use strict';
function reportedBalance(row) {
  const value = row.balance;
  const available = (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value));
  return { balance: available ? value : null, balanceAvailable: available };
}
function deposits(data) {
  return { ...data, deposits: data.deposits.map(row => ({ ...row, id: row.id, depositNumber: row.number,
    iban: row.iban ?? null, title: row.title ?? null, currency: row.currency ?? null,
    ...reportedBalance(row) })) };
}
function cards(data) {
  return { ...data, cards: data.cards.map(row => ({ ...row, id: row.id, pan: row.pan ?? null,
    securePan: row.securePan ?? null, depositNumber: row.deposit?.number ?? null,
    fullName: row.fullName ?? null, currency: row.currency ?? null, cardStatus: row.cardStatus ?? null,
    ...reportedBalance(row) })) };
}
module.exports = { deposits, cards };
