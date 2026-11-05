// Helpers for unit tests that stand in for Mongoose models.

/** Thenable that also exposes the chainable query methods the services call (sort, select). */
export function query<T>(result: T) {
  const q: any = {
    sort: () => q,
    select: () => q,
    limit: () => q,
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

export function configStub(values: Record<string, string> = {}) {
  return { get: (key: string) => values[key] } as any;
}
