# Compliance and responsible use

This note explains how SaveSutra was designed to respect users, creators and platforms. It is an engineering summary, **not legal advice**.

## 1. India: Digital Personal Data Protection Act, 2023 and DPDP Rules, 2025

The DPDP Rules were notified on 13–14 November 2025 with a phased rollout. The substantive obligations (notice, consent, Data Principal rights, security safeguards, breach reporting) apply from **13 May 2027**. SaveSutra implements them already:

| Requirement | How SaveSutra meets it |
|---|---|
| Notice before consent, in clear language, itemising data and purpose | Onboarding shows the full notice (`PrivacyScreen.tsx`); website `privacy.html` |
| Free, specific, informed, unambiguous consent | Unticked checkbox + explicit "I agree", timestamp stored (`consentAt`). WhatsApp: welcome notice with privacy link before any link is processed |
| Withdrawal as easy as giving consent | Settings → *Delete all my data* (also resets consent); WhatsApp `stop` |
| Purpose limitation and data minimisation | Only links, notes and public metadata; no contacts, location or analytics SDKs; media never stored |
| Right to access / correction / erasure | View and edit every save; export Excel/CSV/JSON; delete one or all; server `DELETE /api/me` |
| Reasonable security safeguards | See [SECURITY.md](../SECURITY.md) |
| Grievance redressal (≤ 90 days) | GitHub issues route stated in the notice |
| Children | Notice states the app is not meant for under-18s |
| Retention | Until the user deletes; temp video deleted within minutes |

## 2. WhatsApp Business Platform

- From **15 January 2026**, Meta's Business Solution terms prohibit **general-purpose AI chatbots**. SaveSutra's bot has one business purpose (saving and finding the user's own links), and it rejects open questions: `parseBotCommand` → `unknown` → *"I can only save links and search your saves."*
- The bot only **replies** to user-initiated messages (customer-service window), so there are no marketing templates.
- Opt-out: `stop` deletes WhatsApp saves and silences the bot; `start` re-enables it.
- Allow-list by default (owner number), rate-limited, signature-verified webhook.

## 3. Platforms and creators (Instagram, YouTube, X, others)

- **Public content only.** No login, cookies, session tokens or private accounts, ever.
- **Notes, not copies.** Videos are downloaded at low resolution only to be analysed, then deleted (`finally` block); files uploaded to Gemini are deleted after each call. Thumbnails are linked, not re-hosted.
- **Personal reference.** No redistribution, no feed, no public sharing of others' content. The user always gets a link back to the original creator.
- **Rate-limited and polite.** Concurrency-limited queue and an identifying user agent.
- Users are reminded to respect each platform's terms and creators' rights.

## 4. AI transparency

- Every analysis is labelled with its engine (`rules`, `ai-text`, `ai-video`) and model.
- The system prompt forbids inventing facts and treats captions as untrusted data.
- Users can correct the category or re-run the analysis.

## 5. Accessibility (WCAG 2.2 AA intent)

- Category colour pairs chosen for ≥ 4.5:1 contrast; status never shown by colour alone.
- Real buttons, links and labelled inputs; visible focus rings; touch targets ≥ 44 px.
- `prefers-reduced-motion` respected; dark mode; table view as a keyboard-friendly alternative to the board.

## 6. Open-source licences

All dependencies are permissive (MIT, Apache-2.0, ISC, MPL-2.0 for the share-target plugin). React Flow (MIT) was chosen over tldraw because tldraw's SDK needs a commercial licence for production.
