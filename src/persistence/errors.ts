export type SaveErrorCode =
  | 'corrupt'
  | 'unknown-format'
  | 'too-new'
  | 'migration-missing'
  | 'invalid-state'
  | 'not-found'
  | 'storage';

export class SaveError extends Error {
  readonly code: SaveErrorCode;
  constructor(code: SaveErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SaveError';
    this.code = code;
  }
}
