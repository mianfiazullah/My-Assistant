export function safeStringify(obj: any, spaces?: number): string {
  if (obj === undefined) return "null";
  // We should NOT return the raw string if we want it to be valid JSON (it needs quotes)
  // unless we specifically know the caller doesn't want them. 
  // Given its usage in fetch bodies and localStorage, it should be valid JSON.
  
  const cache = new WeakSet();
  
  const replacer = (key: string, value: any) => {
    if (typeof value === "object" && value !== null) {
      // Check for circular reference first
      if (cache.has(value)) {
        return "[Circular]";
      }
      cache.add(value);

      // Handle common problematic objects that cause circular structure errors
      try {
        const constructorName = value.constructor ? value.constructor.name : null;
        
        if (
          (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) || 
          (typeof Node !== 'undefined' && value instanceof Node) || 
          (value && value.$$typeof) ||
          (constructorName && (
            constructorName === 'HTMLElement' || 
            constructorName === 'Node' ||
            constructorName === 'Y2' ||
            constructorName === 'Ka' ||
            constructorName === 'Window' ||
            constructorName === 'Document'
          ))
        ) {
          return `[Object: ${constructorName || 'Internal'}]`;
        }
        
        if (value instanceof Event) return "[Event]";
        if (constructorName === 'File' || constructorName === 'Blob') return `[${constructorName}]`;
      } catch (e) {
        return "[Unserializable]";
      }
    }
    return value;
  };

  try {
    return JSON.stringify(obj, replacer, spaces) || "null";
  } catch (error) {
    console.warn("safeStringify critical failure:", error);
    return "[Unserializable Object]";
  }
}
