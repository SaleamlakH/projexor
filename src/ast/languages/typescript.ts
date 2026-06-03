import ts from 'typescript';
import { ParseFailedError } from '../../core/errors';
import type {
  ASTResult,
  Class,
  Export,
  Function,
  Import,
  Parameter,
  Property,
} from '../../core/types';

const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions = {
  allowJs: true,
  esModuleInterop: true,
  resolveJsonModule: true,
  skipLibCheck: true,
  strict: true,
};

export const parse = (
  filePaths: string[],
  options?: ts.CompilerOptions,
): Record<string, ASTResult> => {
  const compilerOptions = { ...DEFAULT_COMPILER_OPTIONS, ...options };
  const program = ts.createProgram(filePaths, compilerOptions);
  const checker = program.getTypeChecker();
  const results: Record<string, ASTResult> = {};

  const visitNode = (
    serializers: ReturnType<typeof createSerializers>,
    node: ts.Node,
  ) => {
    if (ts.isImportDeclaration(node)) {
      serializers.serializeImport(node);
    } else if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      serializers.serializeExport(node);
    } else if (ts.isFunctionDeclaration(node)) {
      serializers.serializeFunction(node);
    } else if (ts.isVariableStatement(node)) {
      serializers.serializeVariableStatement(node);
    } else if (ts.isClassDeclaration(node)) {
      serializers.serializeClass(node);
    }
  };

  for (const filePath of filePaths) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) throw new ParseFailedError(filePath);

    const imports: Import[] = [];
    const exports: Export[] = [];
    const functions: Function[] = [];
    const classes: Class[] = [];

    const serializers = createSerializers(
      checker,
      sourceFile,
      imports,
      exports,
      functions,
      classes,
    );

    ts.forEachChild(sourceFile, (node) => visitNode(serializers, node));

    results[filePath] = {
      filePath,
      lines:
        sourceFile.getLineAndCharacterOfPosition(sourceFile.getEnd()).line + 1,
      supported: true,
      imports,
      exports,
      functions,
      classes,
    };
  }

  return results;
};

const createSerializers = (
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  imports: Import[],
  exports: Export[],
  functions: Function[],
  classes: Class[],
) => {
  const emitImport = (data: Import) => imports.push(data);
  const emitExport = (data: Export) => exports.push(data);
  const emitFunction = (data: Function) => functions.push(data);
  const emitClass = (data: Class) => classes.push(data);

  const isExported = (
    node:
      | ts.FunctionDeclaration
      | ts.FunctionExpression
      | ts.VariableStatement
      | ts.ClassDeclaration,
  ): boolean => {
    return !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    );
  };

  const emitExportIfNeeded = (
    node:
      | ts.FunctionDeclaration
      | ts.FunctionExpression
      | ts.VariableStatement
      | ts.ClassDeclaration,
    data: { name: string; type: Export['type']; line: number },
  ) => {
    if (isExported(node)) {
      emitExport(data);
    }
  };

  const getLine = (pos: number): number => {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  };

  const getJsDoc = (node: ts.NamedDeclaration): string | null => {
    if (!node.name) return null;

    const symbol = checker.getSymbolAtLocation(node.name);
    if (!symbol) return null;

    const doc = symbol.getDocumentationComment(checker);
    if (!doc.length) return null;

    return ts.displayPartsToString(doc);
  };

  const getReturnType = (node: ts.SignatureDeclaration): string => {
    const signature = checker.getSignatureFromDeclaration(node);
    if (!signature) return 'unknown';
    return checker.typeToString(checker.getReturnTypeOfSignature(signature));
  };

  // --- imports ---

  const serializeImport = (node: ts.ImportDeclaration): void => {
    const source = (node.moduleSpecifier as ts.StringLiteral).text;
    const clause = node.importClause;
    if (!clause) {
      emitImport({
        name: '',
        source,
        line: getLine(node.getStart()),
      });
      return;
    }

    // default import
    if (clause.name) {
      emitImport({
        name: clause.name.getText(sourceFile),
        source,
        line: getLine(clause.name.getStart()),
      });
    }

    const bindings = clause.namedBindings;
    if (!bindings) return;

    // namespace import
    if (ts.isNamespaceImport(bindings)) {
      emitImport({
        name: bindings.name.getText(sourceFile),
        source,
        line: getLine(bindings.name.getStart()),
      });
      return;
    }

    // named imports
    if (ts.isNamedImports(bindings)) {
      for (const specifier of bindings.elements) {
        const localName = specifier.name.getText(sourceFile);
        const originalName = specifier.propertyName
          ? specifier.propertyName.text
          : localName;

        const name =
          originalName !== localName
            ? `${originalName} as ${localName}`
            : localName;

        emitImport({
          name,
          source,
          line: getLine(specifier.name.getStart()),
        });
      }
    }
  };

  // --- exports ---
  const serializeExport = (
    node: ts.ExportDeclaration | ts.ExportAssignment,
  ): void => {
    // default export
    if (ts.isExportAssignment(node)) {
      emitExport({
        name: node.expression.getText(sourceFile),
        type: 'default',
        line: getLine(node.expression.getStart()),
      });

      return;
    }

    // skip re-exports
    if (!node.exportClause) return;

    // named export
    if (ts.isNamedExports(node.exportClause)) {
      for (const specifier of node.exportClause.elements) {
        let symbol = checker.getSymbolAtLocation(specifier.name);

        // for function and classes
        if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
          symbol = checker.getAliasedSymbol(symbol);
        }
        const decl = symbol?.declarations?.[0];

        const type =
          decl &&
          (ts.isFunctionDeclaration(decl) ||
            ts.isArrowFunction(decl) ||
            ts.isFunctionExpression(decl))
            ? 'function'
            : decl && ts.isClassDeclaration(decl)
              ? 'class'
              : 'variable';

        const localName = specifier.name.getText(sourceFile);
        const originalName = specifier.propertyName
          ? specifier.propertyName.text
          : localName;

        const name =
          originalName !== localName
            ? `${originalName} as ${localName}`
            : localName;

        emitExport({
          type,
          name,
          line: getLine(specifier.name.getStart()),
        });
      }
    }
  };

  // --- functions ---
  const serializeParameter = (node: ts.ParameterDeclaration): Parameter => {
    return {
      name: node.name.getText(sourceFile),
      type: checker.typeToString(checker.getTypeAtLocation(node)),
    };
  };

  const serializeFunction = (node: ts.FunctionDeclaration): void => {
    if (!node.name) return; // anonymous

    const name = node.name.getText(sourceFile);
    const line = getLine(node.name.getStart());

    emitExportIfNeeded(node, {
      name,
      line,
      type: 'function',
    });

    emitFunction({
      name,
      parameters: node.parameters.map(serializeParameter),
      returnType: getReturnType(node),
      jsDoc: getJsDoc(node),
      startLine: getLine(node.getStart()),
      endLine: getLine(node.getEnd()),
    });
  };

  const serializeVariableStatement = (node: ts.VariableStatement): void => {
    for (const declaration of node.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (!initializer) continue;

      const name = declaration.name.getText(sourceFile);
      const line = getLine(declaration.name.getStart());

      const isFn =
        ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer);

      if (isFn) {
        emitExportIfNeeded(node, { name, line, type: 'function' });

        emitFunction({
          name,
          parameters: initializer.parameters.map(serializeParameter),
          returnType: getReturnType(initializer),
          jsDoc: getJsDoc(declaration),
          startLine: getLine(declaration.getStart()),
          endLine: getLine(declaration.getEnd()),
        });

        continue;
      }

      emitExportIfNeeded(node, { name, line, type: 'variable' });
    }
  };

  // --- classes ---

  const serializeClass = (node: ts.ClassDeclaration): void => {
    if (!node.name) return; // anonymous

    const name = node.name.getText(sourceFile);

    emitExportIfNeeded(node, {
      name,
      type: 'class',
      line: getLine(node.name.getStart()),
    });

    const methods: Function[] = [];
    const properties: Property[] = [];

    for (const member of node.members) {
      const startLine = getLine(member.getStart());
      const endLine = getLine(member.getEnd());

      if (ts.isConstructorDeclaration(member)) {
        methods.push({
          startLine,
          endLine,
          name: 'constructor',
          parameters: member.parameters.map(serializeParameter),
          returnType: 'void',
          jsDoc: getJsDoc(member),
        });

        // detect assigned parameter properties - this.x =
        member.body?.statements.forEach((stmt) => {
          if (!ts.isExpressionStatement(stmt)) return;

          const expr = stmt.expression;
          if (!ts.isBinaryExpression(expr)) return;

          if (expr.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;
          if (!ts.isPropertyAccessExpression(expr.left)) return;

          if (expr.left.expression.kind !== ts.SyntaxKind.ThisKeyword) return;

          // prevent duplication
          const name = expr.left.name.getText(sourceFile);
          if (properties.some((p) => p.name === name)) return;

          properties.push({
            name: name,
            type: checker.typeToString(checker.getTypeAtLocation(expr.left)),
          });
        });
      }

      if (ts.isMethodDeclaration(member) && member.name) {
        methods.push({
          startLine,
          endLine,
          name: member.name.getText(sourceFile),
          parameters: member.parameters.map(serializeParameter),
          returnType: getReturnType(member),
          jsDoc: getJsDoc(member),
        });
      }

      if (ts.isPropertyDeclaration(member) && member.name) {
        properties.push({
          name: member.name.getText(sourceFile),
          type: checker.typeToString(checker.getTypeAtLocation(member)),
        });
      }
    }

    emitClass({
      name,
      methods,
      properties,
      jsDoc: getJsDoc(node),
      startLine: getLine(node.getStart()),
      endLine: getLine(node.getEnd()),
    });
  };

  return {
    serializeClass,
    serializeExport,
    serializeImport,
    serializeFunction,
    serializeVariableStatement,
  };
};
