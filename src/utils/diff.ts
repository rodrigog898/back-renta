
export interface DiffResult {
  added: Record<string, any>;
  removed: Record<string, any>;
  changed: Record<string, { before: any; after: any }>;
}

export function diffObjects(a: any, b: any, depth = 0, maxDepth = 3, path = ''): DiffResult {
  const added: Record<string, any> = {};
  const removed: Record<string, any> = {};
  const changed: Record<string, { before: any; after: any }> = {};

  if (a == null && b == null) return { added, removed, changed };

  const aKeys = a ? Object.keys(a) : [];
  const bKeys = b ? Object.keys(b) : [];
  const keys = new Set([...aKeys, ...bKeys]);

  for (const k of keys) {
    const ak = a ? a[k] : undefined;
    const bk = b ? b[k] : undefined;
    const p = path ? `${path}.${k}` : k;

    if (typeof ak === 'object' && typeof bk === 'object' && ak && bk && depth < maxDepth) {
      const nested = diffObjects(ak, bk, depth + 1, maxDepth, p);
      Object.assign(added, nested.added);
      Object.assign(removed, nested.removed);
      Object.assign(changed, nested.changed);
      continue;
    }

    if (ak === undefined && bk !== undefined) {
      added[p] = bk;
    } else if (ak !== undefined && bk === undefined) {
      removed[p] = ak;
    } else if (JSON.stringify(ak) !== JSON.stringify(bk)) {
      changed[p] = { before: ak, after: bk };
    }
  }

  return { added, removed, changed };
}
