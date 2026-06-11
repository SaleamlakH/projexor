import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EOL } from 'os';
import { minimize } from '../walker';
import fs from 'fs/promises';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
}));

describe('minimize function', () => {
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
});
