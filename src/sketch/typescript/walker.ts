import { EOL } from 'os';
import fs from 'fs/promises';
import ts from 'typescript';
import type { SketchResult } from '../../core/types';

export async function minimize(filePath: string): Promise<SketchResult> {
  const sourceText = await fs.readFile(filePath, 'utf-8');

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );

  const sketch = walker(sourceFile, '//');
  return {
    sketch,
    path: filePath,
    originalLines: getLine(sourceFile.getEnd(), sourceFile),
    sketchLines: countLine(sketch),
  };
}

function countLine(codeString: string): number {
  if (!codeString || codeString.trim() === '') return 0;
  return codeString.split(EOL).length;
}

function getLine(pos: number, sourceFile: ts.SourceFile): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
}

function walker(sourceFile: ts.SourceFile, commentPrefix: string) {
  let sketch: string = '';

  sourceFile.forEachChild((node) => {
    if (ts.isImportDeclaration(node)) {
      sketch += constructImportDecl(node, sourceFile, commentPrefix);
    }

    if (ts.isImportEqualsDeclaration(node)) {
      sketch += constructImportEqualDecl(node, sourceFile, commentPrefix);
    }

    if (ts.isExportAssignment(node)) {
      sketch += constructExpAsmt(node, sourceFile, commentPrefix);
    }

    if (ts.isExportDeclaration(node)) {
      sketch += constructExpDecl(node, sourceFile, commentPrefix);
    }
  });

  return sketch;
}

function constructImportDecl(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  commentPrefix: string,
) {
  const startLine = getLine(node.getStart(), sourceFile);
  const endLine = getLine(node.getEnd(), sourceFile);
  const source = (node.moduleSpecifier as ts.StringLiteral).text;
  const clause = node.importClause;

  const parts: string[] = [];

  const writeImport = () => {
    const combinedClause = parts.length
      ? `import ${parts.join(', ')} from '${source}';`
      : `import '${source}';`;

    const headComment = `${commentPrefix} #lines ${startLine} - ${endLine}${EOL}`;
    const inlineComment = `${commentPrefix} #line ${startLine}${EOL}`;

    return startLine !== endLine
      ? `${headComment}${combinedClause.replace(/\s+/g, ' ')}${EOL}`
      : `${combinedClause.replace(/\s+/g, ' ')} ${inlineComment}`;
  };

  // side effect import
  if (!clause) return writeImport();

  // default import
  if (clause.name) {
    const mod = clause.phaseModifier
      ? (ts.tokenToString(clause.phaseModifier) ?? '')
      : '';
    const clauseName = clause.name.getText(sourceFile).trim();

    parts.push(`${mod ? `${mod} ${clauseName}` : clauseName}`);
  }

  const bindings = clause.namedBindings;
  if (!bindings) return writeImport();

  // namespace import
  if (ts.isNamespaceImport(bindings)) {
    parts.push(bindings.getText(sourceFile).trim());
  }

  // named import
  if (ts.isNamedImports(clause.namedBindings)) {
    const specifiers = clause.namedBindings.elements
      .map((element) => element.getText(sourceFile).trim())
      .join(', ');

    parts.push(`{ ${specifiers} }`);
  }

  return writeImport();
}

function constructImportEqualDecl(
  node: ts.ImportEqualsDeclaration,
  sourceFile: ts.SourceFile,
  commentPrefix: string,
) {
  const line = getLine(node.getStart(), sourceFile);
  const modifiers = node.modifiers?.map((mod) => mod.getText(sourceFile));

  const alias = node.name.getText(sourceFile).trim();

  const moduleRef = node.moduleReference
    .getText(sourceFile)
    .replace(/\s+/g, ' ')
    .trim();

  return `import ${modifiers ? modifiers.join(' ') : ''}${alias} = ${moduleRef}; ${commentPrefix} #line ${line}${EOL}`;
}

function constructExpAsmt(
  node: ts.ExportAssignment,
  sourceFile: ts.SourceFile,
  commentPrefix: string,
) {
  const startLine = getLine(node.getStart(sourceFile), sourceFile);
  return `${node.getText(sourceFile)} ${commentPrefix} #line ${startLine}${EOL}`;
}

function constructExpDecl(
  node: ts.ExportDeclaration,
  sourceFile: ts.SourceFile,
  commentPrefix: string,
) {
  const startLine = getLine(node.getStart(sourceFile), sourceFile);
  const endLine = getLine(node.getEnd(), sourceFile);
  const source = node.moduleSpecifier?.getText(sourceFile);
  const parts: string[] = [];

  const writeExport = () => {
    const typePrefix = node.isTypeOnly ? ' type' : '';
    const fromSource = source ? `from ${source}` : '';
    const headComment = `${commentPrefix} #lines ${startLine} - ${endLine}${EOL}`;
    const inlineComment = `${commentPrefix} #line ${startLine}${EOL}`;

    const combinedExport = parts.length
      ? `export${typePrefix} ${parts.join(', ')} ${fromSource}`
      : `export * ${fromSource}`;

    return startLine !== endLine
      ? `${headComment}${combinedExport.trim().replace(/\s+/g, ' ')};${EOL}`
      : `${combinedExport.trim().replace(/\s+/g, ' ')}; ${inlineComment}`;
  };

  if (!node.exportClause) return writeExport();

  if (ts.isNamespaceExport(node.exportClause)) {
    parts.push(node.exportClause.getText(sourceFile));
    return writeExport();
  }

  if (ts.isNamedExports(node.exportClause)) {
    const specifiers = node.exportClause.elements.map((element) =>
      element.getText(sourceFile).trim(),
    );

    parts.push(`{ ${specifiers.join(', ')} }`);
  }

  return writeExport();
}
