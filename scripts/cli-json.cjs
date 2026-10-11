const util = require('node:util');
const original = util.inspect;
util.inspect = function(value, options, ...rest) {
  if (options?.depth === null && options?.colors === false) return JSON.stringify(value, (_, x) => typeof x === 'bigint' ? String(x) : x);
  return original.call(this, value, options, ...rest);
};
require('node:module').syncBuiltinESMExports();
const log = console.log;
console.log = (...values) => log(...values.map(x => x && typeof x === 'object' ? JSON.stringify(x, (_, y) => typeof y === 'bigint' ? String(y) : y) : x));
