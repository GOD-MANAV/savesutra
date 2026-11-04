import { lookup } from 'node:dns/promises';
import { isPrivateAddress, isSafePublicUrl } from '@savesutra/core';

export class UnsafeUrlError extends Error {}

/** Resolve the host and refuse private, loopback or link-local addresses (SSRF protection). */
export async function assertPublicHost(url: string): Promise<void> {
  if (!isSafePublicUrl(url)) throw new UnsafeUrlError('Only public http(s) links can be saved');
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  const addrs = await lookup(host, { all: true, verbatim: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError('Link points to a private network address');
  }
}

const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 SaveSutraBot/1.0 (+https://github.com/GOD-MANAV/savesutra)';

/**
 * fetch() for untrusted URLs: checks every redirect hop, caps the body size and
 * time, and never sends cookies or credentials.
 */
export async function safeFetchText(
  url: string,
  opts: { maxBytes?: number; timeoutMs?: number; accept?: string } = {},
): Promise<{ url: string; status: number; contentType: string; text: string }> {
  const maxBytes = opts.maxBytes ?? 1_500_000;
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(current);
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
      headers: { 'user-agent': UA, accept: opts.accept ?? 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5', 'accept-language': 'en-IN,en;q=0.9,hi;q=0.8' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, current).toString();
      continue;
    }
    const contentType = res.headers.get('content-type') ?? '';
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks));
    return { url: current, status: res.status, contentType, text };
  }
  throw new UnsafeUrlError('Too many redirects');
}
