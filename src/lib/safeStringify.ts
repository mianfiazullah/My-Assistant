export function safeStringify(obj: any, spaces?: number): string {
  if (obj === undefined) return "null";
  if (typeof obj === "string") return JSON.stringify(obj);
  
  try {
    const cache = new WeakSet();
    const result = JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === "object" && value !== null) {
          // Handle DOM nodes and React elements
          if (
            value instanceof HTMLElement || 
            value instanceof Node || 
            (value && value.$$typeof) ||
            (value.constructor && (value.constructor.name === 'HTMLElement' || value.constructor.name === 'Node'))
          ) {
            return "[DOM Element or React Node]";
          }
          
          if (cache.has(value)) {
            return "[Circular]";
          }
          cache.add(value);
        }
        return value;
      },
      spaces
    );
    return result || "null";
  } catch (error) {
    console.warn("safeStringify failed, falling back to basic serialization", error);
    try {
      // Fallback that doesn't use cache but handles depth or something?
      // Actually just return a placeholder for the problematic object
      return "[Unserializable Object]";
    } catch (e) {
      return '"[Error during serialization]"';
    }
  }
}
