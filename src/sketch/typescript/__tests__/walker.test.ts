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
      expect(result.sketch?.trim()).toMatch(`${code} // #line 1`);
    });

    it('parses default, and named combined import', async () => {
      const code = "import type fs, { readFile, writeFile } from 'fs';";
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch?.trim()).toBe(`${code} // #line 1`);
    });

    it('parse namespace import', async () => {
      const code = "import * as utils from './utils';";
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch?.trim()).toBe(`${code} // #line 1`);
    });

    it('parse aliased named import', async () => {
      const code = "import { readFile as read, default as fs } from 'fs';";
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch?.trim()).toBe(`${code} // #line 1`);
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
        `// #lines 1 - 4${EOL}import { readFile, writeFile } from 'fs';`,
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
        `// #lines 1 - 4${EOL}import { readFile, writeFile } from 'fs';`,
      );
    });

    it('include type modifier on imports', async () => {
      const code = `import type fs, { type readFile, type writeFile as writer } from 'fs';`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch?.trim()).toBe(`${code} // #line 1`);
    });

    it('parse commonJs ts module import', async () => {
      const code = `import fs = require('fs');`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch?.trim()).toBe(`${code} // #line 1`);
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
        `import 'dotenv'; // #line 1${EOL}// #lines 2 - 4${EOL}import fs, { type readFile, writeFile } from 'fs';${EOL}import * as utils from './utils'; // #line 5${EOL}import fs = require('fs'); // #line 6${EOL}import utils = require('./utils'); // #line 7`,
      );
    });
  });

  describe('exports', () => {
    it('parses default export assignment', async () => {
      const code = `export default minimize;`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch.trim()).toBe(`${code} // #line 1`);
    });

    it('parses commonJs export assignment', async () => {
      const code = `export = minimize;`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch.trim()).toBe(`${code} // #line 1`);
    });

    it('parses named exports', async () => {
      const code = `export type { add, type sub };`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(`${code} // #line 1`);
    });

    it('parses aliased named exports', async () => {
      const code = `export { add as addition };`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(`${code} // #line 1`);
    });

    it('parses named re-exports', async () => {
      const code = `export { add, sub } from 'math';`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(`${code} // #line 1`);
    });

    it('compress multiline named exports to single line', async () => {
      const code = `export {
      type add, 
      sub};`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(
        `// #lines 1 - 3${EOL}export { type add, sub };`,
      );
    });

    it('compress multiline re-exports to single line', async () => {
      const code = `export {
      type add, 
      sub} from 'math';`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(
        `// #lines 1 - 3${EOL}export { type add, sub } from 'math';`,
      );
    });

    it('exclude inline comments in multiline exports', async () => {
      const code = `export {
      add, // add two numbers
      sub};`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(
        `// #lines 1 - 3${EOL}export { add, sub };`,
      );
    });

    it('parses wildcard re-exports', async () => {
      const code = `export * from 'math';`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(`${code} // #line 1`);
    });

    it('parses re-exports as namespaces', async () => {
      const code = `export type * as utils from 'math';`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(`${code} // #line 1`);
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
        `export default minimize; // #line 1${EOL}// #lines 2 - 4${EOL}export { type add, sub };${EOL}// #lines 5 - 7${EOL}export { type readFile, writeFile } from 'fs';${EOL}export * from './utils'; // #line 8${EOL}export * as utils from './utils'; // #line 9${EOL}export = minimize; // #line 10${EOL}export = add; // #line 11`,
      );
    });
  });

  describe('global variables', () => {
    it('captures primitive variables', async () => {
      const code = `
const a = 1;
const isA = false; 
const languages = ['ts', 'js'];
const user = {id: 1, name: 'alice'};
`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch.trim()).toBe(
        `
const a = 1; // #line 2
const isA = false; // #line 3
const languages = ['ts', 'js']; // #line 4
const user = {id: 1, name: 'alice'}; // #line 5`.trim(),
      );
    });

    it('captures multiline objects and arrays', async () => {
      const code = `
const languages = [
  'ts',
  'js'
];

const user = {
  id: 1,
  name: 'alice'
};`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(
        `
// #lines 2 - 5
const languages = [
  'ts',
  'js'
];
// #lines 7 - 10
const user = {
  id: 1,
  name: 'alice'
};`.trim(),
      );
    });

    it('capture multiple declaration by a single flag', async () => {
      const code = `
const a = 1, b = 2;`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');
      expect(result.sketch.trim()).toBe(
        `
const a = 1, b = 2; // #line 2`.trim(),
      );
    });

    it('keep rhs multiline template literal without any change', async () => {
      const code = `
const query = \`
  SELECT *
  FROM users
  WHERE id = 1\`;
`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch.trim()).toBe(
        `
// #lines 2 - 5
const query = \`
  SELECT *
  FROM users
  WHERE id = 1\`;`.trim(),
      );
    });

    it('keep rhs ternary conditional without any change', async () => {
      const code = `
const role = user.admin ? 'admin' : 'user';
const name = user
  ? user.name
  : undefined;
`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch.trim()).toBe(
        `
const role = user.admin ? 'admin' : 'user'; // #line 2
// #lines 3 - 5
const name = user
  ? user.name
  : undefined;`.trim(),
      );
    });

    it('exclude inline comments on single line variables', async () => {
      const code = `
const a = 1; // start number
const languages = ['ts', 'js']; // programming languages
`;
      vi.mocked(fs.readFile).mockResolvedValue(code);

      const result = await minimize('dummy.ts');

      expect(result.sketch.trim()).toBe(
        `
const a = 1; // #line 2
const languages = ['ts', 'js']; // #line 3`.trim(),
      );
    });

    // minimize function expression, arrow functions,
    // minimize object with function properties
    // minimize class expression
  });
});
