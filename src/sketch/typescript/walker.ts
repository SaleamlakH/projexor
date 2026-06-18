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

  let sketch: string = '';
  sourceFile.forEachChild((node) => {
    sketch += visit(node, sourceFile);
  });

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

function visit(node: ts.Node, sourceFile: ts.SourceFile, indentLevel = 0) {
  let sketch: string = '';

  if (ts.isImportDeclaration(node)) {
    sketch = constructImportDecl(node, sourceFile);
  }

  if (ts.isImportEqualsDeclaration(node)) {
    sketch = constructImportEqualDecl(node, sourceFile);
  }

  if (ts.isExportAssignment(node)) {
    sketch = constructExpAsmt(node, sourceFile);
  }

  if (ts.isExportDeclaration(node)) {
    sketch = constructExpDecl(node, sourceFile);
  }

  if (ts.isVariableStatement(node)) {
    sketch = buildVariable(node, sourceFile);
  }

  if (ts.isFunctionDeclaration(node)) {
    sketch = buildFunction(node, sourceFile, indentLevel);
  }

  if (ts.isClassDeclaration(node)) {
    sketch = buildClass(node, sourceFile);
  }

  if (ts.isIfStatement(node)) {
    const ifStmt = buildIfStatement(node, sourceFile, indentLevel);
    const indent = ' '.repeat(indentLevel);
    sketch = indent + ifStmt;
  }

  if (ts.isForStatement(node)) {
    sketch = buildFor(node, sourceFile);
  }

  if (ts.isWhileStatement(node)) {
    sketch = buildWhile(node, sourceFile);
  }

  if (ts.isDoStatement(node)) {
    sketch = buildDoWhile(node, sourceFile, indentLevel);
  }

  if (ts.isTryStatement(node)) {
    sketch = buildTry(node, sourceFile, indentLevel);
  }

  return sketch ? writeLocComments(node, sourceFile, sketch) : sketch;
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

function buildVariable(
  node: ts.VariableStatement,
  sourceFile: ts.SourceFile,
  checkNode?: (node?: ts.Node) => boolean,
) {
  const declarations: string[] = [];
  for (const decl of node.declarationList.declarations) {
    const variableName = decl.name.getText(sourceFile);
    const initializer = decl.initializer;
    if (ts.isFunctionLike(initializer)) {
      const header = extractBlockHeader(initializer, sourceFile);
      declarations.push(`${variableName} = ${header} {}`);
      continue;
    }

    // check decision
    if (checkNode && !checkNode(initializer)) return '';
    declarations.push(decl.getText(sourceFile));
  }

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

  return `${modifiers ? modifiers + ' ' : ''}${declKeyword} ${declarations.join(', ')}`;
}

function buildFunction(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
  indentLevel: number,
) {
  const header = extractBlockHeader(node, sourceFile);

  if (!node.body) return header;

  if (!node.body.statements.length) return `${header} {}`;

  const parameters: string[] = [];
  node.parameters.map((p) =>
    parameters.push(...getVariableNames(p, sourceFile)),
  );

  const block = buildBlock(node.body, sourceFile, indentLevel + 2, parameters);

  return `${header} ${block}`;
}

function buildClass(node: ts.ClassDeclaration, sourceFile: ts.SourceFile) {
  const header = extractBlockHeader(node, sourceFile);
  return `${header} {}`;
}

function buildIfStatement(
  node: ts.IfStatement,
  sourceFile: ts.SourceFile,
  indentLevel: number = 0,
): string {
  const header = extractBlockHeader(node, sourceFile);
  const ifStmt = `${header} {}`;

  const elseStatement = node.elseStatement;
  if (!elseStatement) return `${ifStmt}`;

  if (ts.isIfStatement(elseStatement)) {
    const nestedHeader = buildIfStatement(
      elseStatement,
      sourceFile,
      indentLevel,
    );
    return `${ifStmt}${EOL}${' '.repeat(indentLevel)}else ${nestedHeader}`;
  }

  return `${ifStmt}${EOL}${' '.repeat(indentLevel)}else {}`;
}

function buildFor(node: ts.ForStatement, sourceFile: ts.SourceFile) {
  const header = extractBlockHeader(node, sourceFile);
  return `${header} {}`;
}

function buildWhile(node: ts.WhileStatement, sourceFile: ts.SourceFile) {
  const header = extractBlockHeader(node, sourceFile);
  return `${header} {}`;
}

function buildDoWhile(
  node: ts.DoStatement,
  sourceFile: ts.SourceFile,
  indentLevel = 0,
) {
  const doWhile = `do {} while (${node.expression.getText(sourceFile)})`;
  const indent = ' '.repeat(indentLevel);
  return indent + doWhile;
}

function buildTry(
  node: ts.TryStatement,
  sourceFile: ts.SourceFile,
  indentLevel = 0,
) {
  const catchClause = node.catchClause
    ? extractBlockHeader(node.catchClause, sourceFile)
    : '';

  const finallyBlock = node.finallyBlock ? `finally {}` : '';

  const indent = ' '.repeat(indentLevel);
  const tryStmt = `${indent}try {}${EOL}${indent}${catchClause} {}${EOL}${indent}${finallyBlock}`;
  return tryStmt;
}

// --- inside blocks ---
function buildBlock(
  block: ts.Block,
  sourceFile: ts.SourceFile,
  indentLevel: number,
  locals: string[],
): string {
  const blockStmts: string[] = [];
  const indent = ' '.repeat(indentLevel);
  for (const stmt of block.statements) {
    if (ts.isReturnStatement(stmt) || ts.isThrowStatement(stmt)) {
      blockStmts.push(
        writeLocComments(stmt, sourceFile, indent + stmt.getText(sourceFile)),
      );
      continue;
    }

    if (ts.isExpressionStatement(stmt)) {
      const checkNode = createScanner(locals, sourceFile);
      const keepStmt = checkNode(stmt.expression);
      if (keepStmt) {
        const expression = indent + stmt.expression.getText(sourceFile);
        blockStmts.push(writeLocComments(stmt, sourceFile, expression));
      }

      continue;
    }

    if (ts.isVariableStatement(stmt)) {
      const checkNode = createScanner(locals, sourceFile);
      const varStmt = buildVariable(stmt, sourceFile, checkNode);
      const varWithLocComment = writeLocComments(
        stmt,
        sourceFile,
        indent + varStmt,
      );

      if (varStmt) {
        if (varWithLocComment.startsWith('//'))
          blockStmts.push(indent + varWithLocComment);
        else blockStmts.push(varWithLocComment);
      }

      const variableNames = getVariableNames(stmt, sourceFile);
      locals.push(...variableNames);
      continue;
    }

    const result = visit(stmt, sourceFile, indentLevel);
    blockStmts.push(indent + result);
  }

  const contents = blockStmts.join('');
  return contents ? `{${EOL}${contents}}` : '{}';
}

function createScanner(locals: string[], sourceFile: ts.SourceFile) {
  return function checkNode(node?: ts.Node): boolean {
    if (!node) return false;
    let keepStatement = false;

    function scan(node: ts.Node) {
      if (keepStatement) return;

      if (
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isClassExpression(node) ||
        ts.isMethodDeclaration(node)
      ) {
        keepStatement = true;
      }

      if (ts.isIdentifier(node)) {
        const isPropertyKey =
          ts.isPropertyAccessExpression(node.parent) &&
          node.parent.name === node;
        const isObjectKey =
          ts.isPropertyAssignment(node.parent) && node.parent.name === node;

        const isLocal = locals.includes(node.getText(sourceFile));

        if (!isPropertyKey && !isObjectKey && !isLocal) {
          keepStatement = true;
          return;
        }
      }

      ts.forEachChild(node, scan);
    }

    scan(node);
    return keepStatement;
  };
}

function getVariableNames(
  node: ts.VariableStatement | ts.ParameterDeclaration,
  sourceFile: ts.SourceFile,
) {
  const variables: string[] = [];

  const getVariables = (binding: ts.BindingName) => {
    if (ts.isIdentifier(binding)) {
      variables.push(binding.getText(sourceFile));
    } else {
      binding.elements.forEach((el) => {
        if (!ts.isOmittedExpression(el)) {
          getVariables(el.name);
        }
      });
    }
  };

  if (ts.isVariableStatement(node)) {
    node.declarationList.declarations.forEach((decl) => {
      getVariables(decl.name);
    });
  } else {
    getVariables(node.name);
  }

  return variables;
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

    return combinedClause.replace(/\s+/g, ' ');
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

  return `import ${modifiers ? modifiers.join(' ') : ''}${alias} = ${moduleRef};`;
}

function constructExpAsmt(
  node: ts.ExportAssignment,
  sourceFile: ts.SourceFile,
) {
  return node.getText(sourceFile);
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

    return combinedExport.trim().replace(/\s+/g, ' ');
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
