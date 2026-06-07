export interface ProjectStructure {
  root: string;
  tree: FileNode[];
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children: FileNode[];
}

export interface ASTResult {
  filePath: string;
  lines: number;
  supported: boolean;
  imports: Import[];
  exports: Export[];
  functions: Function[];
  classes: Class[];
}

export interface Import {
  name: string;
  source: string;
  line: number;
}

export interface Export {
  name: string;
  type: 'function' | 'class' | 'variable' | 'default';
  line: number;
}

export interface Function {
  name: string;
  parameters: Parameter[];
  returnType: string;
  jsDoc: string | null;
  startLine: number;
  endLine: number;
}

export interface Parameter {
  name: string;
  type: string;
}

export interface Class {
  name: string;
  methods: Function[];
  properties: Property[];
  jsDoc: string | null;
  startLine: number;
  endLine: number;
}

export interface Property {
  name: string;
  type: string;
}

export interface SuccessResult<T> {
  success: true;
  data: T;
}

export interface FailureResult {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
