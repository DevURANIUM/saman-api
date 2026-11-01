'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('CLI JSON failures are parseable on stderr and signal failure to scripts', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'cli.js'), '--json-errors', 'unknown-command'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  const data = JSON.parse(result.stderr);
  assert.match(data.error, /Unknown command/);
  assert.equal(data.status, 400);
});
