export function assertPathInPrefix(path: string, prefix: string) {
  const norm = path.replace(/\\/g, '/').replace(/^\/+/, '');
  const cleanPrefix = prefix.replace(/^\/+/, '');
  if (!norm.startsWith(cleanPrefix)) throw new Error('Path outside group scope');
  return norm;
}
