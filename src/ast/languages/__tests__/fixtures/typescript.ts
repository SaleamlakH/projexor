// @ts-nocheck
// ---- imports ----

import { readFile } from 'fs';

// prettier-ignore
import { 
  join, 
  resolve 
} from 'path';
import { User as UserModel } from './models';
import defaultExport from './default';
import * as utils from './utils';
import './side-effect';

// ---- exports ----

// prettier-ignore
export { 
  namedExportFn, 
  NamedExportClass, 
  NAMED_EXPORT_VAR 
};
export { join as joinPath };
export default defaultExport;

// ---- exported variables ----

export const API_URL = 'https://api.example.com';
export const MAX_RETRIES = 3;

// ---- non-exported variables (for multiline re-export) ----

const NAMED_EXPORT_VAR = 'named';

// ---- functions ----

/**
 * Fetches a user by id.
 */
export function fetchUser(id: string, retry: boolean): Promise<UserModel> {
  return Promise.resolve({ id, name: 'John' } as UserModel);
}

function internalHelper(value: string): string {
  return value.trim();
}

/**
 * Builds a query string.
 */
export const buildQuery = (params: Record<string, string>): string => {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
};

const internalArrow = (x: number): number => x * 2;

export async function syncData(endpoint: string): Promise<void> {
  await fetch(endpoint);
}

function inferredReturn() {
  return 42;
}

function namedExportFn(value: string): string {
  return value;
}

// ---- classes ----

/**
 * Manages user sessions.
 */
export class SessionManager {
  private sessions: Map<string, UserModel>;
  readonly maxSessions: number;

  constructor(
    private userId: string,
    maxSessions: number,
  ) {
    this.sessions = new Map();
    this.maxSessions = maxSessions;
  }

  /**
   * Starts a new session.
   */
  startSession(token: string): boolean {
    return this.sessions.size < this.maxSessions;
  }

  endSession(token: string): void {
    this.sessions.delete(token);
  }
}

class InternalCache {
  items: string[] = [];

  add(item: string): void {
    this.items.push(item);
  }
}

class NamedExportClass {
  label: string = '';

  describe(): string {
    return this.label;
  }
}
