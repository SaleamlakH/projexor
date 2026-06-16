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

    if (ts.isFunctionDeclaration(node)) {
      sketch += buildFunction(node, sourceFile);
    }

    if (ts.isClassDeclaration(node)) {
      sketch += buildClass(node, sourceFile);
    }

    if (ts.isIfStatement(node)) {
      sketch += writeLocComments(
        node,
        sourceFile,
        buildIfStatement(node, sourceFile),
      );
    }

    if (ts.isForStatement(node)) {
      sketch += buildFor(node, sourceFile);
    }

    if (ts.isWhileStatement(node)) {
      sketch += buildWhile(node, sourceFile);
    }

    if (ts.isDoStatement(node)) {
      sketch += buildDoWhile(node, sourceFile);
    }

    if (ts.isTryStatement(node)) {
      sketch += buildTry(node, sourceFile);
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

  const headComment = `// @location-range: ${startLine} - ${endLine}`;
  const inlineComment = `// @location-line: ${startLine}`;

  return startLine !== endLine
    ? `${headComment}${EOL}${content}${EOL}`
    : `${content} ${inlineComment}${EOL}`;
}

function extractBlockHeader(node: ts.Node, sourceFile: ts.SourceFile) {
  const headerNodes: string[] = [];
  const children = node.getChildren(sourceFile);
  for (const child of children) {
    if (child.kind === ts.SyntaxKind.Block) break;

    const text = child.getText(sourceFile).trim();
    if (text === '{') break;

    headerNodes.push(text);
  }

  const pattern =
    ts.isFunctionLike(node) && node.name ? /^[.,:;()[\]]/ : /^[.,:;)[\]]/;
  const header = headerNodes
    .reduce((acc: string, text: string) => {
      if (acc === '') return text;
      if (pattern.test(text) || acc.endsWith('(') || acc.endsWith('[')) {
        return `${acc}${text}`;
      }
      return `${acc} ${text}`;
    }, '')
    .replace(/\s+/g, ' ');

  return header.trim();
}

function buildVariable(node: ts.VariableStatement, sourceFile: ts.SourceFile) {
  const declarations = node.declarationList.declarations.map((decl) => {
    const variableName = decl.name.getText(sourceFile);
    if (ts.isFunctionLike(decl.initializer)) {
      const header = extractBlockHeader(decl.initializer, sourceFile);
      return `${variableName} = ${header} {}`;
    }

    return decl.getText(sourceFile);
  });

  const modifiers = node.modifiers
    ?.map((mod) => mod.getText(sourceFile))
    .join(' ');
  const flags = node.declarationList.flags;
  const declKeyword =
    (flags & ts.NodeFlags.Const) !== 0
      ? 'const'
      : (flags & ts.NodeFlags.Let) !== 0
        ? 'let'
        : 'var';

  const content = `${modifiers ? modifiers + ' ' : ''}${declKeyword} ${declarations.join(', ')}`;
  return writeLocComments(node, sourceFile, content);
}

function buildFunction(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
) {
  const header = extractBlockHeader(node, sourceFile);
  return writeLocComments(node, sourceFile, `${header} {}`);
}

function buildClass(node: ts.ClassDeclaration, sourceFile: ts.SourceFile) {
  const header = extractBlockHeader(node, sourceFile);
  return writeLocComments(node, sourceFile, `${header} {}`);
}

function buildIfStatement(
  node: ts.IfStatement,
  sourceFile: ts.SourceFile,
): string {
  const header = extractBlockHeader(node, sourceFile);
  const ifStmt = `${header} {}`;

  const elseStatement = node.elseStatement;
  if (!elseStatement) return `${ifStmt}`;

  if (ts.isIfStatement(elseStatement)) {
    const nestedHeader = buildIfStatement(elseStatement, sourceFile);
    return `${ifStmt}${EOL}else ${nestedHeader}`;
  }

  return `${ifStmt}${EOL}else {}`; // body
}

function buildFor(node: ts.ForStatement, sourceFile: ts.SourceFile) {
  const header = extractBlockHeader(node, sourceFile);
  return writeLocComments(node, sourceFile, `${header} {}`);
}

function buildWhile(node: ts.WhileStatement, sourceFile: ts.SourceFile) {
  const header = extractBlockHeader(node, sourceFile);
  return writeLocComments(node, sourceFile, `${header} {}`);
}

function buildDoWhile(node: ts.DoStatement, sourceFile: ts.SourceFile) {
  const doWhile = `do {} while (${node.expression.getText(sourceFile)})`;
  return writeLocComments(node, sourceFile, doWhile);
}

function buildTry(node: ts.TryStatement, sourceFile: ts.SourceFile) {
  const catchClause = node.catchClause
    ? extractBlockHeader(node.catchClause, sourceFile)
    : '';

  const finallyBlock = node.finallyBlock ? `finally {}` : '';

  const tryStmt = `try {}${EOL}${catchClause} {}${EOL}${finallyBlock}`;
  return writeLocComments(node, sourceFile, tryStmt);
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
