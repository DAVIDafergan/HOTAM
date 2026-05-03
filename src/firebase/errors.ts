'use client';

type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

interface SecurityRuleRequest {
  auth: { uid: string } | null;
  method: string;
  path: string;
  resource?: { data: any };
}

function buildErrorMessage(req: SecurityRuleRequest): string {
  return `Missing or insufficient permissions: The following request was denied:\n${JSON.stringify(req, null, 2)}`;
}

/**
 * Custom error class for database permission errors.
 * Kept structurally identical to the original for compatibility with FirebaseErrorListener.
 */
export class FirestorePermissionError extends Error {
  public readonly request: SecurityRuleRequest;

  constructor(context: SecurityRuleContext) {
    const req: SecurityRuleRequest = {
      auth: null,
      method: context.operation,
      path: `/databases/(default)/documents/${context.path}`,
      resource: context.requestResourceData ? { data: context.requestResourceData } : undefined,
    };
    super(buildErrorMessage(req));
    this.name = 'DatabasePermissionError';
    this.request = req;
  }
}
