export function safeStringify(obj: any, spaces?: number): string {
  const cache = new Set();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (value instanceof HTMLElement || value instanceof Node || (value && value.$$typeof)) {
           return "[React Node or DOM Element]";
        }
        if (cache.has(value)) {
          // Circular reference found
          return "[Circular]";
        }
        // Store value in our collection
        cache.add(value);
      }
      return value;
    },
    spaces
  );
}
