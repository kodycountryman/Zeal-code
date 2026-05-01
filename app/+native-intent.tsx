export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  try {
    const url = new URL(path);
    return `${url.pathname}${url.search}${url.hash}` || '/';
  } catch {
    return path.startsWith('/') ? path : '/';
  }
}
