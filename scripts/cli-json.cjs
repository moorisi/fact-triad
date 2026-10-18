const util = require('node:util');
const original = util.inspect;
util.inspect = function(value, options, ...rest) {
  if (options?.depth === null && options?.colors === false) return JSON.stringify(value, (_, x) => typeof x === 'bigint' ? String(x) : x);
  return original.call(this, value, options, ...rest);
};
require('node:module').syncBuiltinESMExports();
const log = console.log;
console.log = (...values) => log(...values.map(x => x && typeof x === 'object' ? JSON.stringify(x, (_, y) => typeof y === 'bigint' ? String(y) : y) : x));
// Select StudioNet only for this child process; do not change saved CLI settings.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const configPath = path.join(os.homedir(), '.genlayer', 'genlayer-config.json');
const read = fs.readFileSync;
fs.readFileSync = function(file, ...args) {
  const value = read.call(this, file, ...args);
  if (typeof file === 'string' && path.resolve(file) === configPath) {
    const config = JSON.parse(String(value));
    config.network = 'studionet';
    if (process.env.PROOF_ACCOUNT) config.activeAccount = process.env.PROOF_ACCOUNT;
    const out = JSON.stringify(config);
    return typeof value === 'string' ? out : Buffer.from(out);
  }
  return value;
};
