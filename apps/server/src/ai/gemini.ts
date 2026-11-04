import { GoogleGenAI, createPartFromUri, type Part } from '@google/genai';
import {
  GEMINI_RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseModelOutput,
  type Analysis,
  type LinkMetadata,
} from '@savesutra/core';

export interface AnalyzeInput {
  meta: LinkMetadata & { articleText?: string };
  /** A local video file to upload (Instagram, X, TikTok…). Deleted from Gemini after use. */
  video?: { path: string; mimeType: string };
  /** For YouTube, Gemini can read the video straight from its URL. */
  youtubeUrl?: string;
  /** A shared image (screenshot), base64. */
  image?: { base64: string; mimeType: string };
}

export interface Analyzer {
  analyze(input: AnalyzeInput): Promise<Analysis>;
}

async function waitActive(ai: GoogleGenAI, name: string, timeoutMs = 120_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    const f = await ai.files.get({ name });
    if (f.state === 'ACTIVE') return;
    if (f.state === 'FAILED') throw new Error('Gemini could not process the video');
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for video processing');
    await new Promise((r) => setTimeout(r, 2000));
  }
}

/** Gemini-based analyzer: one multimodal call per save, JSON output validated by the core schema. */
export function createGeminiAnalyzer(apiKey: string, model: string): Analyzer {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async analyze(input) {
      const parts: Part[] = [];
      let uploaded: string | undefined;
      let engine: Analysis['engine'] = 'ai-text';
      try {
        if (input.youtubeUrl) {
          parts.push({ fileData: { fileUri: input.youtubeUrl, mimeType: 'video/*' } });
          engine = 'ai-video';
        } else if (input.video) {
          const file = await ai.files.upload({ file: input.video.path, config: { mimeType: input.video.mimeType } });
          uploaded = file.name;
          await waitActive(ai, file.name!);
          parts.push(createPartFromUri(file.uri!, file.mimeType ?? input.video.mimeType));
          engine = 'ai-video';
        } else if (input.image) {
          parts.push({ inlineData: { data: input.image.base64, mimeType: input.image.mimeType } });
          engine = 'ai-video';
        }
        let prompt = buildUserPrompt(input.meta, { hasVideo: engine === 'ai-video' });
        if (input.meta.articleText) prompt += `\n\nPage text:\n<<<\n${input.meta.articleText}\n>>>`;
        parts.push({ text: prompt });

        const res = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            // The schema object is the OpenAPI subset Gemini expects.
            responseSchema: GEMINI_RESPONSE_SCHEMA as never,
            temperature: 0.2,
          },
        });
        const text = res.text;
        if (!text) throw new Error('Empty response from Gemini');
        return parseModelOutput(text, engine, model);
      } finally {
        if (uploaded) await ai.files.delete({ name: uploaded }).catch(() => undefined);
      }
    },
  };
}
