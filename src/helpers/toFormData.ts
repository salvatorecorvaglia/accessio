export function toFormData(
  obj: any,
  form?: FormData,
  namespace?: string,
  seen?: WeakSet<any>,
  options?: { brackets?: boolean },
): FormData {
  const fd = form || new FormData();
  let formKey: string;

  if (obj === null || obj === undefined) {
    return fd;
  }

  const visited = seen || new WeakSet<any>();

  if (obj instanceof Date) {
    fd.append(namespace || '', obj.toISOString());
  } else if (
    typeof obj === 'object' &&
    !(typeof File !== 'undefined' && obj instanceof File) &&
    !(typeof Blob !== 'undefined' && obj instanceof Blob) &&
    !(typeof ArrayBuffer !== 'undefined' && obj instanceof ArrayBuffer) &&
    !(typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(obj)) &&
    !(typeof Buffer !== 'undefined' && Buffer.isBuffer(obj))
  ) {
    if (visited.has(obj)) {
      return fd;
    }
    // Marks the current path only — unmarking on the way out breaks cycles while still
    // emitting an object that legitimately appears under two different keys.
    visited.add(obj);

    Object.keys(obj).forEach((key) => {
      if (Array.isArray(obj)) {
        formKey = namespace ? `${namespace}[${key}]` : key;
      } else {
        const useBrackets = options?.brackets ?? false;
        formKey = namespace ? (useBrackets ? `${namespace}[${key}]` : `${namespace}.${key}`) : key;
      }
      toFormData(obj[key], fd, formKey, visited, options);
    });

    visited.delete(obj);
  } else {
    fd.append(namespace || '', obj);
  }

  return fd;
}
