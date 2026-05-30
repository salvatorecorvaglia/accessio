export function toFormData(obj: any, form?: FormData, namespace?: string): FormData {
  const fd = form || new FormData();
  let formKey: string;

  if (obj === null || obj === undefined) {
    return fd;
  }

  if (obj instanceof Date) {
    fd.append(namespace || '', obj.toISOString());
  } else if (
    typeof obj === 'object' &&
    !(typeof File !== 'undefined' && obj instanceof File) &&
    !(typeof Blob !== 'undefined' && obj instanceof Blob)
  ) {
    Object.keys(obj).forEach((key) => {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') return;
      if (Array.isArray(obj)) {
        formKey = namespace ? `${namespace}[${key}]` : key;
      } else {
        formKey = namespace ? `${namespace}.${key}` : key;
      }
      toFormData(Reflect.get(obj, key), fd, formKey);
    });
  } else {
    fd.append(namespace || '', obj);
  }

  return fd;
}
