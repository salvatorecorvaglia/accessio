export function toFormData(obj: any, form?: FormData, namespace?: string): FormData {
  const fd = form || new FormData();
  let formKey: string;

  if (obj === null || obj === undefined) {
    return fd;
  }

  if (obj instanceof Date) {
    fd.append(namespace || '', obj.toISOString());
  } else if (typeof obj === 'object' && !(obj instanceof File) && !(obj instanceof Blob)) {
    Object.keys(obj).forEach((key) => {
      if (Array.isArray(obj)) {
        formKey = namespace ? `${namespace}[${key}]` : key;
      } else {
        formKey = namespace ? `${namespace}.${key}` : key;
      }
      toFormData(obj[key], fd, formKey);
    });
  } else {
    fd.append(namespace || '', obj);
  }

  return fd;
}
