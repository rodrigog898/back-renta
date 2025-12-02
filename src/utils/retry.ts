
export type RetryOptions = {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  onRetry?: (err: unknown, attempt: number) => void;
  isRetryable?: (err: unknown) => boolean;
};

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const {
    retries = 5,
    minDelayMs = 200,
    maxDelayMs = 5000,
    factor = 2,
    onRetry,
    isRetryable
  } = opts;

  let attempt = 0;
  let delay = minDelayMs;

  // jitter helper
  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const retryable = isRetryable ? isRetryable(err) : true;
      if (!retryable || attempt > retries) {
        throw err;
      }
      onRetry?.(err, attempt);
      await sleep(delay + Math.floor(Math.random() * delay * 0.1)); // add jitter
      delay = Math.min(maxDelayMs, Math.floor(delay * factor));
    }
  }
}
