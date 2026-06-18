import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EOL } from 'os';
import { minimize } from '../walker';
import fs from 'fs/promises';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
}));

describe('minimize', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('imports', () => {
    it('parse a side-effect import', async () => {
      const code = "import 'side-effect-pkg';";
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.path).toBe('dummy.ts');
      expect(result.originalLines).toBe(1);
      expect(result.sketch?.trim()).toMatch(`${code} // @location-line: 1`);
    });

    it('parses default, and named combined import', async () => {
      const code = "import type fs, { readFile, writeFile } from 'fs';";
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch?.trim()).toBe(`${code} // @location-line: 1`);
    });

    it('parse namespace import', async () => {
      const code = "import * as utils from './utils';";
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch?.trim()).toBe(`${code} // @location-line: 1`);
    });

    it('parse aliased named import', async () => {
      const code = "import { readFile as read, default as fs } from 'fs';";
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch?.trim()).toBe(`${code} // @location-line: 1`);
    });

    it('parse multiline named import', async () => {
      const code = `import {
      readFile,
      writeFile
    } from 'fs'`;

      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.originalLines).toBe(4);
      expect(result.sketchLines).toBe(3);
      expect(result.sketch?.trim()).toBe(
        `// @location-range: 1 - 4${EOL}import { readFile, writeFile } from 'fs';`,
      );
    });

    it('exclude inline comments in multiline import', async () => {
      const code = `import {
      readFile, // inline readFile comment
      writeFile // inline writeFile comment
    } from 'fs`;

      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch?.trim()).toBe(
        `// @location-range: 1 - 4${EOL}import { readFile, writeFile } from 'fs';`,
      );
    });

    it('include type modifier on imports', async () => {
      const code = `import type fs, { type readFile, type writeFile as writer } from 'fs';`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch?.trim()).toBe(`${code} // @location-line: 1`);
    });

    it('parse commonJs ts module import', async () => {
      const code = `import fs = require('fs');`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch?.trim()).toBe(`${code} // @location-line: 1`);
    });

    it('parse multiple imports from different source', async () => {
      const code = `import 'dotenv';
      import fs, { 
      type readFile,
      writeFile } from 'fs';
      import * as utils from './utils'
      import fs = require('fs');
      import utils = require('./utils')`;

      vi.mocked(fs.readFile).mockResolvedValue(code);
      const result = await minimize('dummy.ts');

      expect(result.originalLines).toBe(7);
      expect(result.sketchLines).toBe(7);
      expect(result.sketch?.trim()).toBe(
        `import 'dotenv'; // @location-line: 1${EOL}// @location-range: 2 - 4${EOL}import fs, { type readFile, writeFile } from 'fs';${EOL}import * as utils from './utils'; // @location-line: 5${EOL}import fs = require('fs'); // @location-line: 6${EOL}import utils = require('./utils'); // @location-line: 7`,
      );
    });
  });

  describe('exports', () => {
    it('parses default export assignment', async () => {
      const code = `export default minimize;`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch.trim()).toBe(`${code} // @location-line: 1`);
    });

    it('parses commonJs export assignment', async () => {
      const code = `export = minimize;`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch.trim()).toBe(`${code} // @location-line: 1`);
    });

    it('parses named exports', async () => {
      const code = `export type { add, type sub };`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(`${code} // @location-line: 1`);
    });

    it('parses aliased named exports', async () => {
      const code = `export { add as addition };`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(`${code} // @location-line: 1`);
    });

    it('parses named re-exports', async () => {
      const code = `export { add, sub } from 'math';`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(`${code} // @location-line: 1`);
    });

    it('compress multiline named exports to single line', async () => {
      const code = `export {
      type add, 
      sub};`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(
        `// @location-range: 1 - 3${EOL}export { type add, sub };`,
      );
    });

    it('compress multiline re-exports to single line', async () => {
      const code = `export {
      type add, 
      sub} from 'math';`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(
        `// @location-range: 1 - 3${EOL}export { type add, sub } from 'math';`,
      );
    });

    it('exclude inline comments in multiline exports', async () => {
      const code = `export {
      add, // add two numbers
      sub};`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(
        `// @location-range: 1 - 3${EOL}export { add, sub };`,
      );
    });

    it('parses wildcard re-exports', async () => {
      const code = `export * from 'math';`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(`${code} // @location-line: 1`);
    });

    it('parses re-exports as namespaces', async () => {
      const code = `export type * as utils from 'math';`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(`${code} // @location-line: 1`);
    });

    it('parse multiple imports from different source', async () => {
      const code = `export default minimize;
      export { 
      type add,
      sub };
      export { 
      type readFile,
      writeFile } from 'fs';
      export * from './utils'
      export * as utils from './utils'
      export = minimize;
      export = add;`;

      vi.mocked(fs.readFile).mockResolvedValue(code);
      const result = await minimize('dummy.ts');

      expect(result.originalLines).toBe(11);
      expect(result.sketchLines).toBe(10);
      expect(result.sketch?.trim()).toBe(
        `export default minimize; // @location-line: 1${EOL}// @location-range: 2 - 4${EOL}export { type add, sub };${EOL}// @location-range: 5 - 7${EOL}export { type readFile, writeFile } from 'fs';${EOL}export * from './utils'; // @location-line: 8${EOL}export * as utils from './utils'; // @location-line: 9${EOL}export = minimize; // @location-line: 10${EOL}export = add; // @location-line: 11`,
      );
    });
  });

  describe('top levels', () => {
    describe('preserves values', () => {
      it('keeps primitive values', async () => {
        const code = `
const a = true;
const b = 10;
const c = 'text';
const d = null;;
`;
        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
const a = true // @location-line: 2
const b = 10 // @location-line: 3
const c = 'text' // @location-line: 4
const d = null // @location-line: 5`.trim(),
        );
      });

      it('keeps object and array literals', async () => {
        const code = `
const languages = ['ts', 'js'];
const user = {id: 1, name: 'alice'};
`;
        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
const languages = ['ts', 'js'] // @location-line: 2
const user = {id: 1, name: 'alice'} // @location-line: 3`.trim(),
        );
      });

      it('keeps template literal and ternary expressions', async () => {
        const code = `
const query = \`name: \${name}\`
const role = user.admin ? 'admin' : 'user';
`;
        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
const query = \`name: \${name}\` // @location-line: 2
const role = user.admin ? 'admin' : 'user' // @location-line: 3`.trim(),
        );
      });

      it('keeps multiline literals', async () => {
        const code = `
const languages = [
  'ts',
  'js'
];

const user = {
  id: 1,
  name: 'alice'
};

const query = \`
  SELECT *
  FROM users
  WHERE id = 1\`;

const name = user
  ? user.name
  : undefined;
`;
        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 5
const languages = [
  'ts',
  'js'
]
// @location-range: 7 - 10
const user = {
  id: 1,
  name: 'alice'
}
// @location-range: 12 - 15
const query = \`
  SELECT *
  FROM users
  WHERE id = 1\`
// @location-range: 17 - 19
const name = user
  ? user.name
  : undefined`.trim(),
        );
      });

      it('keep multiple declaration by a single flag', async () => {
        const code = `
const a = 1, b = 2;`;
        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');
        expect(result.sketch.trim()).toBe(
          `
const a = 1, b = 2 // @location-line: 2`.trim(),
        );
      });

      it('includes modifiers', async () => {
        const code = `
export const a = true;
export const languages = ['ts', 'js'];
export const user = {id: 1, name: 'alice'};
export const languages = [
  'ts',
  'js'
];
export const user = {
  id: 1,
  name: 'alice'
};
export const name = user
  ? user.name
  : undefined;`;
        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
export const a = true // @location-line: 2
export const languages = ['ts', 'js'] // @location-line: 3
export const user = {id: 1, name: 'alice'} // @location-line: 4
// @location-range: 5 - 8
export const languages = [
  'ts',
  'js'
]
// @location-range: 9 - 12
export const user = {
  id: 1,
  name: 'alice'
}
// @location-range: 13 - 15
export const name = user
  ? user.name
  : undefined`.trim(),
        );
      });

      it('includes the correct declaration flag', async () => {
        const code = `
const a = true;
let b = 10;
var c = 'text';
`;
        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
const a = true // @location-line: 2
let b = 10 // @location-line: 3
var c = 'text' // @location-line: 4`.trim(),
        );
      });
    });

    describe('preserves structure without bodies', () => {
      it('keeps function declaration, expression and arrow function', async () => {
        const code = `
function log(name, age) {}
const logName = (name, age) {}
const logAge = (name, age) => {}`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
function log(name, age) {} // @location-line: 2
const logName = (name, age) {} // @location-line: 3
const logAge = (name, age) => {} // @location-line: 4`.trim(),
        );
      });

      it('build functions with multiline parameters to a single line', async () => {
        const code = `
function test(
  name,
  age) {};
  
const fnExp = function (
  name,
  age) {}

const fnArr = (
name,
age) => {} `;
        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 4
function test(name, age) {}
// @location-range: 6 - 8
const fnExp = function (name, age) {}
// @location-range: 10 - 12
const fnArr = (name, age) => {}`.trim(),
        );
      });

      it('keeps class declaration and expression', async () => {
        const code = `
class Minimizer {}
const Code = class {}`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
class Minimizer {} // @location-line: 2
const Code = class {} // @location-line: 3`.trim(),
        );
      });

      it('includes modifiers', async () => {
        const code = `
export async function log(name, age) {}
export const log = async (name, age) {}
export const log = async (name, age) => {}

export class Minimizer {}
export const Code = class {}`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
export async function log(name, age) {} // @location-line: 2
export const log = async (name, age) {} // @location-line: 3
export const log = async (name, age) => {} // @location-line: 4
export class Minimizer {} // @location-line: 6
export const Code = class {} // @location-line: 7`.trim(),
        );
      });

      it('keeps if else conditional structure', async () => {
        const code = `
if (age < 18) {
} else if (age > 18 && age < 21) {
} else {};`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 4
if (age < 18) {}
else if (age > 18 && age < 21) {}
else {}`.trim(),
        );
      });

      it('keeps for loop block structure', async () => {
        const code = `
for (let i = 0; i < 10; i++) {}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
for (let i = 0; i < 10; i++) {} // @location-line: 2`.trim(),
        );
      });

      it('keeps while loop block structure', async () => {
        const code = `
while (i < 10) {}`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
while (i < 10) {} // @location-line: 2`.trim(),
        );
      });

      it('keeps do while loop block structure', async () => {
        const code = `
do {
} while (i < 10)`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 3
do {} while (i < 10)`.trim(),
        );
      });

      it('keeps try catch finally block', async () => {
        const code = `
try {
} catch (error) {
} finally {
}`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 5
try {}
catch (error) {}
finally {}`.trim(),
        );
      });
    });
  });

  describe('inside blocks {}', () => {
    describe('function and class declarations and expressions', () => {
      it('keeps internal functions (declaration, and expression)', async () => {
        const code = `
function test() {
  function internalFnDecl(name, age) {}
  const fnExp = function (name, age) {}
  const fnArr = (name, age) => {}
}`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 6
function test() {
  function internalFnDecl(name, age) {} // @location-line: 3
  const fnExp = function (name, age) {} // @location-line: 4
  const fnArr = (name, age) => {} // @location-line: 5
}`.trim(),
        );
      });

      it('keeps class declaration, and expression', async () => {
        const code = `
function test() {
  class Minimize {}
  const Mini = class {}
}`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 5
function test() {
  class Minimize {} // @location-line: 3
  const Mini = class {} // @location-line: 4
}`.trim(),
        );
      });
    });

    describe('nested structures (if, for, while, do while, try)', () => {
      it('keeps if  conditional structure', async () => {
        const code = `
function test() {
  if (x < 18) {
  } else if (x < 22) {
  } else {
  }
}`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 7
function test() {
  // @location-range: 3 - 6
  if (x < 18) {}
  else if (x < 22) {}
  else {}
}`.trim(),
        );
      });

      it('keeps for loop structure', async () => {
        const code = `
function test() {
  for (let i = 0; i < 10; i++) {}
}`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 4
function test() {
  for (let i = 0; i < 10; i++) {} // @location-line: 3
}`.trim(),
        );
      });

      it('keeps while loop structure', async () => {
        const code = `
function test() {
  while (i < 10) {}
}`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 4
function test() {
  while (i < 10) {} // @location-line: 3
}`.trim(),
        );
      });

      it('keeps do...while loop structure', async () => {
        const code = `
function test() {
  do {
  } while (i < 10)
}`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 5
function test() {
  // @location-range: 3 - 4
  do {} while (i < 10)
}`.trim(),
        );
      });

      it('keeps try catch finally block', async () => {
        const code = `
function test() {
  try {
  } catch (error) {
  } finally {
  }
}`;

        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 7
function test() {
  // @location-range: 3 - 6
  try {}
  catch (error) {}
  finally {}
}`.trim(),
        );
      });
    });

    describe('external dependency (global)', () => {
      it('keeps only external referenced variables', async () => {
        const code = `
function test() {
  const a = 1;
  const x = name
  const y = a;
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 6
function test() {
  const x = name // @location-line: 4
}`.trim(),
        );
      });

      it('keeps binary expressions when they include global values', async () => {
        const code = `
function test() {
  const a = 1;
  const b = 2;
  const x = a + b;
  const y = 1 + 2;
  const z = a + limit;
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 8
function test() {
  const z = a + limit // @location-line: 7
}`.trim(),
        );
      });

      it('keeps unary expressions when operand is global values', async () => {
        const code = `
function test() {
  const flag = true;
  const a = !true;
  const b = !flag;
  const c = !isValid;
  const d = count++;
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 8
function test() {
  const c = !isValid // @location-line: 6
  const d = count++ // @location-line: 7
}`.trim(),
        );
      });

      it('keeps property access if base object is global values', async () => {
        const code = `
function test() {
  const user = { name: 'alice' };
  const a = user.name;
  const b = external.profile.name;
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 6
function test() {
  const b = external.profile.name // @location-line: 5
}`.trim(),
        );
      });

      it('keeps element access on global', async () => {
        const code = `
function test() {
  const cache = {};
  const a = cache['key'];
  const b = store[id];
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 6
function test() {
  const b = store[id] // @location-line: 5
}`.trim(),
        );
      });

      it('keeps element access on local when key is not local', async () => {
        const code = `
function test() {
  const cache = {};
  const a = cache['key'];
  const b = cache[key];
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 6
function test() {
  const b = cache[key] // @location-line: 5
}`.trim(),
        );
      });

      it('keeps array with external reference', async () => {
        const code = `
function test() {
  const local = 'local';
  const a = [1, local + 1, !true, local.length, local[0]];
  const b = [1, external + 1];
  const c = [1, !external];
  const d = [1, external.length];
  const e = [1, cache[external]];
  const f = [1, external];
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 10
function test() {
  const b = [1, external + 1] // @location-line: 5
  const c = [1, !external] // @location-line: 6
  const d = [1, external.length] // @location-line: 7
  const e = [1, cache[external]] // @location-line: 8
  const f = [1, external] // @location-line: 9
}`.trim(),
        );
      });

      it('keeps object with external reference', async () => {
        const code = `
function test() {
  const local = 'local';
  const a = { x: local + 1, y: !true, z: local.length, w: local[0] };
  const b = { x: external + 1 };
  const c = { x: !external };
  const d = { x: external.length };
  const e = { x: cache[external] };
  const f = { x: external };
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 10
function test() {
  const b = { x: external + 1 } // @location-line: 5
  const c = { x: !external } // @location-line: 6
  const d = { x: external.length } // @location-line: 7
  const e = { x: cache[external] } // @location-line: 8
  const f = { x: external } // @location-line: 9
}`.trim(),
        );
      });

      it('drops references to parameters', async () => {
        const code = `
function test(name: string, age: number) {
  const cache = {};
  const a = name;
  const b = age + 1;
  const c = !name;
  const d = name.length;
  const e = cache[name];
  const f = [1, name + 1, !age, name.length, cache[name]];
  const g = { x: name + 1, y: !age, z: name.length, w: cache[name] };
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 11
function test(name: string, age: number) {}`.trim(),
        );
      });
    });

    describe('calls', () => {
      it('keeps standalone call', async () => {
        const code = `
function test() {
  log();
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 4
function test() {
  log() // @location-line: 3
}`.trim(),
        );
      });

      it('keeps awaited call', async () => {
        const code = `
async function test() {
  await fetchUser();
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 4
async function test() {
  await fetchUser() // @location-line: 3
}`.trim(),
        );
      });

      it('keeps variable which contains call', async () => {
        const code = `
function test() {
  const a = get() + 1;
  const b = !get();
  const c = get().property;
  const d = cache[get()];
  const e = [1, get()];
  const f = { x: get() };
  const x = get() ?? fallback();
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 10
function test() {
  const a = get() + 1 // @location-line: 3
  const b = !get() // @location-line: 4
  const c = get().property // @location-line: 5
  const d = cache[get()] // @location-line: 6
  const e = [1, get()] // @location-line: 7
  const f = { x: get() } // @location-line: 8
  const x = get() ?? fallback() // @location-line: 9
}`.trim(),
        );
      });

      it('keeps method call on global', async () => {
        const code = `
function test(param: User) {
  const local = {};
  local.getName();
  param.getName();
  external.getName();
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 7
function test(param: User) {
  external.getName() // @location-line: 6
}`.trim(),
        );
      });

      it('keeps call assigned to local', async () => {
        const code = `
function test() {
  const x = format();
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 4
function test() {
  const x = format() // @location-line: 3
}`.trim(),
        );
      });

      it('keeps method call on local with call arguments', async () => {
        const code = `
function test() {
  const local = [1, 2, 3];
  local.push(getLevel());
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 5
function test() {
  local.push(getLevel()) // @location-line: 4
}`.trim(),
        );
      });

      it('keeps method call on local with external referenced argument', async () => {
        const code = `
function test() {
  const local = [1, 2, 3];
  local.push(next);
  local.push(next + 1);
  local.push(external.length);
  local.push(cache[limit]);
}`;
        vi.mocked(fs.readFile).mockResolvedValue(code);
        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 8
function test() {
  local.push(next) // @location-line: 4
  local.push(next + 1) // @location-line: 5
  local.push(external.length) // @location-line: 6
  local.push(cache[limit]) // @location-line: 7
}`.trim(),
        );
      });
    });

    describe('return and throw', () => {
      it('keeps returns', async () => {
        const code = `
function test() {
  return 1
};`;
        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 4
function test() {
  return 1 // @location-line: 3
}`.trim(),
        );
      });

      it('keeps throws', async () => {
        const code = `
function test() {
  throw new Error('message');
};`;
        vi.mocked(fs.readFile).mockResolvedValue(code);

        const result = await minimize('dummy.ts');

        expect(result.sketch.trim()).toBe(
          `
// @location-range: 2 - 4
function test() {
  throw new Error('message'); // @location-line: 3
}`.trim(),
        );
      });
    });
  });
});
