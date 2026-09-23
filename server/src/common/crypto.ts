import { createHash, timingSafeEqual } from 'node:crypto';
export function canonicalJson(value: unknown): string {
  if (value===null || typeof value!=='object') return JSON.stringify(value);
  if (Array.isArray(value)) return '['+value.map(canonicalJson).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJson((value as Record<string,unknown>)[key])).join(',')+'}';
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function secureEqual(a: string,b: string) { const aa=Buffer.from(a),bb=Buffer.from(b); return aa.length===bb.length && timingSafeEqual(aa,bb); }
