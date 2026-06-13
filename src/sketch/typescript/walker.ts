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

  const sketch = walker(sourceFile);
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

function walker(sourceFile: ts.SourceFile) {
  let sketch: string = '';

  sourceFile.forEachChild((node) => {
    if (ts.isImportDeclaration(node)) {
      sketch += constructImportDecl(node, sourceFile);
    }

    if (ts.isImportEqualsDeclaration(node)) {
      sketch += constructImportEqualDecl(node, sourceFile);
    }

    if (ts.isExportAssignment(node)) {
      sketch += constructExpAsmt(node, sourceFile);
    }

    if (ts.isExportDeclaration(node)) {
      sketch += constructExpDecl(node, sourceFile);
    }

    if (ts.isVariableStatement(node)) {
      sketch += buildVariable(node, sourceFile);
    }
  });

  return sketch;
}

// write location comments
function writeLocComments(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  content: string,
) {
  const startLine = getLine(node.getStart(sourceFile), sourceFile);
  const endLine = getLine(node.getEnd(), sourceFile);

  const headComment = `// #lines ${startLine} - ${endLine}`;
  const inlineComment = `// #line ${startLine}`;

  return startLine !== endLine
    ? `${headComment}${EOL}${content}${EOL}`
    : `${content} ${inlineComment}${EOL}`;
}

function buildVariable(node: ts.VariableStatement, sourceFile: ts.SourceFile) {
  return writeLocComments(node, sourceFile, node.getText(sourceFile));
}

function constructImportDecl(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
) {
  const source = (node.moduleSpecifier as ts.StringLiteral).text;
  const clause = node.importClause;

  const parts: string[] = [];

  const writeImport = () => {
    const combinedClause = parts.length
      ? `import ${parts.join(', ')} from '${source}';`
      : `import '${source}';`;

    return writeLocComments(
      node,
      sourceFile,
      combinedClause.replace(/\s+/g, ' '),
    );
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
) {
  const modifiers = node.modifiers?.map((mod) => mod.getText(sourceFile));

  const alias = node.name.getText(sourceFile).trim();

  const moduleRef = node.moduleReference
    .getText(sourceFile)
    .replace(/\s+/g, ' ')
    .trim();

  const content = `import ${modifiers ? modifiers.join(' ') : ''}${alias} = ${moduleRef};`;
  return writeLocComments(node, sourceFile, content);
}

function constructExpAsmt(
  node: ts.ExportAssignment,
  sourceFile: ts.SourceFile,
) {
  return writeLocComments(node, sourceFile, node.getText(sourceFile));
}

function constructExpDecl(
  node: ts.ExportDeclaration,
  sourceFile: ts.SourceFile,
) {
  const source = node.moduleSpecifier?.getText(sourceFile);
  const parts: string[] = [];

  const writeExport = () => {
    const typePrefix = node.isTypeOnly ? ' type' : '';
    const fromSource = source ? ` from ${source};` : ';';

    const combinedExport = parts.length
      ? `export${typePrefix} ${parts.join(', ')}${fromSource}`
      : `export * ${fromSource}`;

    return writeLocComments(
      node,
      sourceFile,
      combinedExport.trim().replace(/\s+/g, ' '),
    );
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
