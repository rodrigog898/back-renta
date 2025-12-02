
type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number; 
  halfOpenAfterMs?: number; 
  name?: string;
}

export class CircuitBreaker {
  private state: State = 'CLOSED';
  private failures = 0;
  private lastOpenedAt = 0;
  private readonly failureThreshold: number;
  private readonly halfOpenAfterMs: number;
  private readonly name: string;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.halfOpenAfterMs = opts.halfOpenAfterMs ?? 15000;
    this.name = opts.name ?? 'cb';
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state === 'OPEN') {
      if (now - this.lastOpenedAt >= this.halfOpenAfterMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error(`Circuit ${this.name} is OPEN`);
      }
    }

    try {
      const res = await fn();
      this.onSuccess();
      return res;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failures = 0;
    if (this.state !== 'CLOSED') this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastOpenedAt = Date.now();
    }
  }
}
