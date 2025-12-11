export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly expose: boolean;

  constructor(message: string, status: number = 500, expose: boolean = true) {
    super(message);
    this.name = 'AppError';
    this.code = String(status);
    this.status = status;
    this.expose = expose;
    Error.captureStackTrace(this, this.constructor);
  }
}
