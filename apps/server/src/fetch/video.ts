import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface DownloadedVideo {
  path: string;
  mimeType: string;
  sizeBytes: number;
  /** Always call this: the video is deleted right after analysis. */
  cleanup: () => Promise<void>;
}

/**
 * Download a small, low-resolution copy of a public video for one-off analysis.
 * Capped by length and size, written to a temp folder, and deleted afterwards
 * by `cleanup()`. SaveSutra never keeps or redistributes the media.
 */
export async function downloadVideo(
  url: string,
  opts: { ytDlpPath?: string; maxSeconds: number; maxMb: number; timeoutMs?: number },
): Promise<DownloadedVideo | undefined> {
  const dir = await mkdtemp(join(tmpdir(), 'savesutra-'));
  const cleanup = () => rm(dir, { recursive: true, force: true });
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-part',
    '--socket-timeout', '15',
    '--match-filter', `duration <= ${opts.maxSeconds}`,
    '--max-filesize', `${opts.maxMb}M`,
    '-f', 'worst[ext=mp4][height>=240]/worst[ext=mp4]/worst',
    '-o', join(dir, 'video.%(ext)s'),
    url,
  ];
  const ok = await new Promise<boolean>((resolveP) => {
    let child;
    try {
      child = spawn(opts.ytDlpPath ?? 'yt-dlp', args, { stdio: 'ignore' });
    } catch {
      return resolveP(false);
    }
    const timer = setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs ?? 90_000);
    child.on('error', () => resolveP(false));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveP(code === 0);
    });
  });
  const files = ok ? await readdir(dir).catch(() => []) : [];
  const file = files.find((f) => f.startsWith('video.'));
  if (!file) {
    await cleanup();
    return undefined;
  }
  const path = join(dir, file);
  const { size } = await stat(path);
  const ext = file.split('.').pop()!;
  return { path, sizeBytes: size, mimeType: ext === 'webm' ? 'video/webm' : 'video/mp4', cleanup };
}
