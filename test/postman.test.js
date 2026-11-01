'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { collectionFrom } = require('../scripts/export-postman');
const openapi = require('../docs/openapi.json');

test('Postman exports every documented operation, examples, and request parameters without automatic scripts', () => {
  const collection = collectionFrom(openapi);
  const items = collection.item.flatMap(group => group.item);
  const expected = Object.entries(openapi.paths).flatMap(([route, operations]) =>
    Object.keys(operations).filter(method => ['get', 'post', 'put', 'patch', 'delete'].includes(method)).map(method => method.toUpperCase() + ' ' + route));
  assert.deepEqual(items.map(item => item.name).sort(), expected.sort());
  assert.equal(collection.variable.find(v => v.key === 'apiKey').value, '');
  const login = items.find(item => item.name === 'POST /auth/login');
  assert.equal(login.request.header.find(h => h.key === 'Content-Type').value, 'application/json');
  assert.doesNotThrow(() => JSON.parse(login.request.body.raw));
  const detail = items.find(item => item.name === 'GET /transactions/{id}');
  assert.equal(detail.request.url.variable[0].key, 'id');
  assert.equal(items.find(item => item.name === 'GET /health').request.auth.type, 'noauth');
  assert.equal(items.some(item => item.event), false);
  assert.equal(collection.event, undefined);
});
