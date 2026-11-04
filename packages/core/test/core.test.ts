import { describe, expect, it } from 'vitest';
import {
  analyzeWithRules,
  classify,
  cleanSocialTitle,
  demoItems,
  detectPlatform,
  extractFirstUrl,
  extractHashtags,
  extractLinks,
  extractPlaces,
  extractPrices,
  isSafePublicUrl,
  normalizeUrl,
  parseBotCommand,
  parseModelOutput,
  searchItems,
  toCsv,
  toRows,
  botReplies,
} from '../src/index.ts';

describe('url', () => {
  it('pulls the link out of shared text', () => {
    expect(extractFirstUrl('Check this out! https://www.instagram.com/reel/C7xAbc/?igsh=MWQ1 so good')).toBe(
      'https://www.instagram.com/reel/C7xAbc/?igsh=MWQ1',
    );
    expect(extractFirstUrl('instagram.com/reel/C7xAbc/')).toBe('https://instagram.com/reel/C7xAbc/');
    expect(extractFirstUrl('no link here')).toBeNull();
  });

  it('normalises share links so duplicates collapse', () => {
    expect(normalizeUrl('https://www.instagram.com/reel/C7xAbc/?igsh=MWQ1&utm_source=ig_web')).toBe('https://www.instagram.com/reel/C7xAbc/');
    expect(normalizeUrl('https://instagram.com/reels/C7xAbc')).toBe('https://www.instagram.com/reel/C7xAbc/');
    expect(normalizeUrl('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(normalizeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&t=20')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(normalizeUrl('https://twitter.com/a/status/1?s=20')).toBe('https://x.com/a/status/1');
    expect(normalizeUrl('https://example.com/blog/post/?utm_campaign=x#top')).toBe('https://example.com/blog/post');
  });

  it('detects platform and kind', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc/')).toMatchObject({ platform: 'instagram', kind: 'reel' });
    expect(detectPlatform('https://www.instagram.com/p/abc/')).toMatchObject({ platform: 'instagram', kind: 'post' });
    expect(detectPlatform('https://www.youtube.com/shorts/abc')).toMatchObject({ platform: 'youtube', kind: 'short' });
    expect(detectPlatform('https://x.com/a/status/1')).toMatchObject({ platform: 'x', kind: 'post' });
    expect(detectPlatform('https://blog.example.com/a')).toMatchObject({ platform: 'web', kind: 'article' });
  });

  it('blocks SSRF targets', () => {
    expect(isSafePublicUrl('https://www.instagram.com/reel/abc/')).toBe(true);
    for (const bad of [
      'http://localhost:3000',
      'http://127.0.0.1/',
      'http://10.0.0.5/',
      'http://192.168.1.1/admin',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/',
      'file:///etc/passwd',
      'https://user:pass@example.com/',
      'https://example.com:8443/',
      'http://intranet/',
    ]) {
      expect(isSafePublicUrl(bad), bad).toBe(false);
    }
  });
});

describe('extract', () => {
  const caption = `3 hidden cafés in Hauz Khas 😍
1. Rooftop café – lake view
2. Bookstore café
📍 Hauz Khas Village - New Delhi
Full list: linktr.ee/delhi.foodtrail and https://maps.app.goo.gl/xyz123
Under ₹500 for two, bingsu Rs. 250
#delhi #cafes #खाना`;

  it('finds links, including bare ones', () => {
    const urls = extractLinks(caption, 'caption').map((l) => l.url);
    expect(urls).toContain('https://linktr.ee/delhi.foodtrail');
    expect(urls).toContain('https://maps.app.goo.gl/xyz123');
  });

  it('finds hashtags in any script', () => {
    expect(extractHashtags(caption)).toEqual(['delhi', 'cafes', 'खाना']);
  });

  it('finds prices and places', () => {
    expect(extractPrices(caption)).toEqual(expect.arrayContaining(['₹500', 'Rs. 250']));
    expect(extractPlaces(caption)[0]).toMatchObject({ type: 'place', name: 'Hauz Khas Village' });
  });

  it('classifies with keywords and hashtags', () => {
    expect(classify(caption, ['delhi', 'cafes']).category).toBe('Food');
    expect(classify('Goa itinerary for 3 days with beach hostels').category).toBe('Travel');
    expect(classify('How to crack the PM interview at Google').category).toBe('Career');
    expect(classify('lorem ipsum').category).toBe('Other');
  });

  it('cleans Open Graph social titles', () => {
    expect(cleanSocialTitle('Delhi Food Trail on Instagram: "3 hidden cafés"')).toEqual({ author: 'Delhi Food Trail', title: '3 hidden cafés' });
    expect(cleanSocialTitle('My video - YouTube')).toEqual({ title: 'My video' });
  });

  it('builds a full rule-based analysis', () => {
    const a = analyzeWithRules({
      url: 'https://www.instagram.com/reel/C7xAbc/',
      platform: 'instagram',
      kind: 'reel',
      title: 'Delhi Food Trail on Instagram: "3 hidden cafés in Hauz Khas"',
      description: caption,
    });
    expect(a.engine).toBe('rules');
    expect(a.category).toBe('Food');
    expect(a.title).toBe('3 hidden cafés in Hauz Khas');
    expect(a.links.length).toBe(2);
    expect(a.keyPoints[0]).toContain('Rooftop');
    expect(a.tags).toContain('delhi');
  });
});

describe('model output', () => {
  it('validates and cleans AI JSON', () => {
    const a = parseModelOutput(
      '```json\n{"title":"T","summary":"S","keyPoints":["a"],"category":"Weird","tags":["#Delhi","delhi"],"entities":[{"type":"spaceship","name":"X"}],"links":[{"url":"bit.ly/abc","source":"audio"},{"url":"https://bit.ly/abc","source":"screen"}],"confidence":"0.9"}\n```',
      'ai-video',
      'm',
    );
    expect(a.category).toBe('Other');
    expect(a.tags).toEqual(['delhi']);
    expect(a.entities[0]!.type).toBe('product');
    expect(a.links).toEqual([{ url: 'https://bit.ly/abc', label: undefined, source: 'audio' }]);
    expect(a.confidence).toBe(0.9);
  });

  it('rejects junk', () => {
    expect(() => parseModelOutput('not json', 'ai-text')).toThrow();
  });
});

describe('search', () => {
  const items = demoItems(new Date('2026-11-04T12:00:00Z'));
  it('ranks by meaning-ish keywords with typos', () => {
    expect(searchItems(items, 'cafe hauz khas')[0]!.item.analysis!.title).toContain('Hauz Khas');
    expect(searchItems(items, 'goaa itinerary')[0]!.item.analysis!.title).toContain('Goa');
    expect(searchItems(items, 'paneer')[0]!.item.analysis!.category).toBe('Food');
  });
  it('supports filters', () => {
    expect(searchItems(items, 'cat:travel').every((h) => h.item.analysis!.category === 'Travel')).toBe(true);
    expect(searchItems(items, '#goa').length).toBe(1);
    expect(searchItems(items, 'from:youtube').every((h) => h.item.platform === 'youtube')).toBe(true);
  });
});

describe('bot', () => {
  it('parses commands', () => {
    expect(parseBotCommand('https://youtu.be/abc for the trip')).toMatchObject({ type: 'save', note: 'for the trip' });
    expect(parseBotCommand('find goa cafes')).toEqual({ type: 'find', query: 'goa cafes' });
    expect(parseBotCommand('dhundo paneer')).toEqual({ type: 'find', query: 'paneer' });
    expect(parseBotCommand('more 129')).toEqual({ type: 'more', seq: 129 });
    expect(parseBotCommand('#129')).toEqual({ type: 'more', seq: 129 });
    expect(parseBotCommand('delete 12')).toEqual({ type: 'delete', seq: 12 });
    expect(parseBotCommand('STOP')).toEqual({ type: 'stop' });
    expect(parseBotCommand('hi')).toEqual({ type: 'help' });
    expect(parseBotCommand('what is the capital of France?').type).toBe('unknown');
  });
  it('formats replies within WhatsApp limits', () => {
    const it0 = demoItems()[0]!;
    expect(botReplies.saved(it0)).toContain('Saved #');
    expect(botReplies.more(it0).length).toBeLessThan(4096);
    expect(botReplies.unknown()).toMatch(/only save links/);
  });
});

describe('export', () => {
  it('produces safe CSV', () => {
    const rows = toRows(demoItems());
    rows[0]!.Note = '=HYPERLINK("http://evil")';
    const csv = toCsv(rows);
    expect(csv.startsWith('﻿#,Title')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });
});

import { digest, entityIndex, groupByPeriod, parseWhatsAppExport, smartCollections } from '../src/index.ts';

describe('organize', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  const items = demoItems(now);
  it('builds a timeline', () => {
    const days = groupByPeriod(items, 'day', now);
    expect(days[0]!.label).toBe('Today');
    expect(groupByPeriod(items, 'month', now).length).toBeGreaterThanOrEqual(2);
  });
  it('collects every AI tool across saves', () => {
    const c = smartCollections(items).find((x) => x.id === 'ai-tools')!;
    expect(c.entities!.map((e) => e.name)).toEqual(expect.arrayContaining(['NotebookLM', 'Gamma']));
    expect(entityIndex(items, ['place']).length).toBeGreaterThan(5);
  });
  it('summarises the week', () => {
    const d = digest(items, now);
    expect(d.total).toBeGreaterThan(5);
    expect(d.byCategory[0]!.count).toBeGreaterThan(1);
  });
});

describe('WhatsApp import', () => {
  it('reads Android and iOS exports', () => {
    const txt = [
      '12/10/23, 9:41 pm - Manav: https://www.instagram.com/reel/AAA/?igsh=1',
      '13/10/23, 10:02 am - Maa: ok beta',
      '[14/10/2023, 21:15:09] Manav: For Goa trip',
      'https://youtu.be/BBB?si=x and also linktr.ee/x',
      '15/10/23, 8:00 am - Manav: https://www.instagram.com/reel/AAA/ again',
    ].join('\n');
    const links = parseWhatsAppExport(txt);
    expect(links.map((l) => l.url)).toEqual(['https://www.instagram.com/reel/AAA/', 'https://www.youtube.com/watch?v=BBB']);
    expect(links[0]!.sharedAt!.slice(0, 10)).toBe(new Date(2023, 9, 12, 21, 41).toISOString().slice(0, 10));
    expect(links[1]!.text).toContain('Goa trip');
  });
});
