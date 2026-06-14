export function validatePrivateKey(key: string | undefined): `0x${string}` | undefined {
  if (!key) return undefined;
  if (!key.startsWith("0x")) key = "0x" + key;
  return key as `0x${string}`;
}
export function validateAddress(addr: string | undefined): `0x${string}` | undefined {
  if (!addr) return undefined;
  if (!addr.startsWith("0x")) addr = "0x" + addr;
  return addr as `0x${string}`;
}
