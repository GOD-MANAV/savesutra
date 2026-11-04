import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { CapacitorShareTarget } from '@capgo/capacitor-share-target';

export const isNative = () => Capacitor.isNativePlatform();

export interface IncomingShare {
  text: string;
  title?: string;
  image?: { base64: string; mimeType: string };
}

async function fileToBase64(uri: string): Promise<string | undefined> {
  try {
    const res = await fetch(Capacitor.convertFileSrc(uri));
    const blob = await res.blob();
    if (blob.size > 6_000_000) return undefined;
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = () => resolve(undefined);
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/**
 * Listen for content shared into the app: Android's share sheet in the APK,
 * or the Web Share Target when installed as a PWA.
 */
export async function listenForShares(onShare: (s: IncomingShare) => void): Promise<void> {
  // PWA share target: the browser opens ./?share_url=…&share_text=…
  const params = new URLSearchParams(window.location.search);
  const sharedText = [params.get('share_url'), params.get('share_text'), params.get('share_title')].filter(Boolean).join(' ');
  if (sharedText) {
    onShare({ text: sharedText, title: params.get('share_title') ?? undefined });
    history.replaceState(null, '', window.location.pathname + window.location.hash);
  }
  if (!isNative()) return;
  await CapacitorShareTarget.addListener('shareReceived', async (event) => {
    const text = event.texts.join(' ').trim();
    const img = event.files?.find((f) => f.mimeType.startsWith('image/'));
    const base64 = img ? await fileToBase64(img.uri) : undefined;
    onShare({ text, title: event.title, image: base64 && img ? { base64, mimeType: img.mimeType } : undefined });
  });
}

/** Android back button follows in-app history, and leaves the app from the home screen. */
export function wireBackButton(): void {
  if (!isNative()) return;
  void CapApp.addListener('backButton', () => {
    if (window.location.hash && window.location.hash !== '#/' && window.location.hash !== '#') history.back();
    else void CapApp.exitApp();
  });
}

/** Save a generated file: a normal download on the web, the share sheet in the Android app. */
export async function saveFile(name: string, data: Blob | string, mimeType: string): Promise<void> {
  if (isNative()) {
    const base64 =
      typeof data === 'string'
        ? undefined
        : await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
            r.onerror = () => reject(r.error);
            r.readAsDataURL(data);
          });
    const written = await Filesystem.writeFile({
      path: name,
      directory: Directory.Cache,
      data: base64 ?? (data as string),
      ...(base64 ? {} : { encoding: Encoding.UTF8 }),
    });
    await Share.share({ title: name, url: written.uri, dialogTitle: `Share ${name}` });
    return;
  }
  const blob = typeof data === 'string' ? new Blob([data], { type: mimeType }) : data;
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}

/** Share a save's link with the system share sheet (or copy it on desktop). */
export async function shareLink(title: string, url: string): Promise<'shared' | 'copied'> {
  if (isNative()) {
    await Share.share({ title, text: title, url });
    return 'shared';
  }
  if (navigator.share) {
    await navigator.share({ title, url }).catch(() => undefined);
    return 'shared';
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

export async function openExternal(url: string): Promise<void> {
  window.open(url, '_blank', 'noopener,noreferrer');
}
