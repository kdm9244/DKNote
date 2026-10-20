import { readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

function validate(names) {
  const versions = new Map();
  for (const name of names) {
    const match = /^V([0-9]+(?:[._][0-9]+)*)__.+\.sql$/.exec(name);
    if (!match) throw new Error(`Invalid migration name: ${name}`);
    const parts = match[1].split(/[._]/).map(part => BigInt(part).toString());
    while (parts.length > 1 && parts.at(-1) === '0') parts.pop();
    const version = parts.join('.');
    if (versions.has(version)) throw new Error(`Duplicate migration version: ${versions.get(version)} and ${name}`);
    versions.set(version, name);
  }
  return versions.size;
}

// Include the production failure and Flyway's equivalent version spellings.
assert.throws(() => validate(['V7__financial_planning_currencies.sql', 'V7__personal_memos.sql']), /Duplicate/);
assert.throws(() => validate(['V7__a.sql', 'V07.0__b.sql']), /Duplicate/);
assert.throws(() => validate(['V1.2__a.sql', 'V1_2__b.sql']), /Duplicate/);
const files = readdirSync(new URL('../src/main/resources/db/migration/', import.meta.url))
  .filter(name => name.startsWith('V') && name.endsWith('.sql'));
console.log(`Validated ${validate(files)} unique migration versions`);
