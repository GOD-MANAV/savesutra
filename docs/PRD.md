# SaveSutra: product requirements

**Owner:** Manav Yadav · **Status:** v1.0 shipped (Android APK, PWA, server, WhatsApp bot) · **Last updated:** 4 Nov 2026

## 1. Problem

People save far more than they ever use. In India the default "save for later" is **WhatsApp**: links forwarded to yourself, a family member or a one-person group. Reels go to Instagram "Saved", videos to "Watch later", screenshots to the gallery.

Six months later:

- Links have **no title or context**: `instagram.com/reel/C7x…` says nothing.
- The useful part is **inside** the content: the café named at 0:20, the AI tool shown on screen, the link "in bio".
- There's **no search across places**, so the save is effectively lost.

> Origin: I sent every interesting reel to my mom's WhatsApp for safekeeping. After hundreds of links I couldn't tell which link was what.

## 2. Users

| Persona | Saves | Job to be done |
|---|---|---|
| **Student / early professional** (primary) | AI tools, career and PM posts, tutorials, internship links | "Find that AI tool for slides before my presentation." |
| **Planner** | Cafés, trips, recipes | "Show me every Goa thing I saved before the trip." |
| **Family sharer** | Forwards links to a parent or partner | "Keep sending on WhatsApp, but make it findable." |

## 3. Competitive landscape (researched Nov 2026)

| Product | Strength | Gap SaveSutra fills |
|---|---|---|
| Instagram Saved / YouTube Watch later | Zero effort | Single platform, no search by content |
| Raindrop.io | Mature bookmarks, multiple views | Mostly manual organising; no video understanding |
| mymind | Calm design, AI tagging | Paid, no WhatsApp, little extraction inside video |
| ReelPin, InstaSave, ClipVault, Ordo, Vestron | AI notes for reels | Mostly Instagram-only, app-only capture |
| Keepi, Crumbs (WhatsApp bots) | WhatsApp capture | No structured views, smart collections or chat import |

**Positioning:** *WhatsApp-first capture + deep extraction across all content types + four ways to see it, private by default.*

## 4. Goals and success metrics

| Goal | Metric | v1 target |
|---|---|---|
| Capture is effortless | Median time from share to saved | < 3 s (analysis continues in background) |
| Saves become findable | Search sessions ending in an opened save | > 60% |
| Content is understood | Saves with ≥ 1 extracted entity or link | > 70% with AI key |
| Saves get used | Saves marked *Done* or opened again within 30 days | > 25% |
| Trust | Users who export or delete without contacting support | 100% (self-serve) |

**Non-goals (v1):** social feed, public sharing, downloading or re-hosting other people's media, general-purpose AI chat.

## 5. Requirements

### Capture (P0)
- Android share-sheet target for text/links and images; PWA Web Share Target.
- Paste a link in the app, with an optional note and screenshot.
- WhatsApp bot: send a link to save it; `find`, `more`, `recent`, `delete`, `help`, `stop`.
- Import a WhatsApp "Export chat" `.txt`: every link, with its original date and the message as a note.
- De-duplicate by canonical URL (tracking parameters removed).

### Understanding (P0)
- Platform and content type detection (reel, video, short, post, thread, article, image, doc).
- Summary, 3 to 6 key points, category (11 including **AI**), tags.
- Entities: tools, places, products, books, people, prices, ingredients, steps.
- Links found in the caption, **audio** or **on screen**, labelled by source.
- Works with no AI key (rules engine); full analysis with Gemini (on device or server).
- Every analysis labelled with its engine and model.

### Organising and finding (P0)
- Views: Cards (grouped by day), Table (numbered, sortable, column picker, Excel/CSV), Board (whiteboard grouped by category, draggable, positions saved), Timeline (day/week/month + heatmap).
- Smart collections: AI tools, Tools & apps, Places, Books, Recipes, Products, Links found inside, Pinned, To try.
- Typo-tolerant search with filters `cat:`, `from:`, `#tag`.
- Status: Saved / To try / Done, Pin, notes, change category.
- Weekly digest and "On this day".

### Trust (P0)
- Consent-first onboarding with plain-language notice.
- Export (Excel, CSV, JSON), restore from JSON, delete everything.
- Public content only; temporary media deleted after analysis.

### Later (P1/P2)
- Semantic search, shared family collections, reminders, iOS share extension, Hindi UI.

## 6. Key decisions

| Decision | Why |
|---|---|
| **Local-first**, server optional | Privacy, zero cost, works offline; server only for WhatsApp and heavy video |
| **Gemini** for analysis | Native video understanding (YouTube by URL), JSON-schema output, generous free tier |
| **Bring-your-own key** on device | No backend cost; user controls their data |
| Bot is **save and search only** | WhatsApp Business Platform rules ban general-purpose AI chatbots from 15 Jan 2026 |
| **React Flow** over tldraw for the board | MIT licence; tldraw's SDK needs a paid production licence |
| **Capacitor** for Android | One codebase for the web demo, PWA and APK; native share target and HTTP |
| No voice features in v1 | Scope choice for the challenge |

## 7. Risks

| Risk | Mitigation |
|---|---|
| Platforms block metadata fetches | Graceful fallback to URL plus rules; user note always searchable; yt-dlp kept current |
| AI hallucination | "Use only the material" prompt, schema validation, labels, user can re-analyse or edit category |
| Platform terms | Public content only, no media storage, personal-use framing, no redistribution |
| Free-tier rate limits | Sequential on-device queue, backoff, server concurrency limit |
| Data protection (DPDP) | Notice + consent + rights in-app; see [COMPLIANCE.md](COMPLIANCE.md) |

## 8. Launch checklist

- [x] Tests (core, server, app) and CI
- [x] APK built and released by GitHub Actions
- [x] Web demo + website on GitHub Pages
- [x] Privacy notice, security review, compliance notes
- [x] Promo video and screenshots
