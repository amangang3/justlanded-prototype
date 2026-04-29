# Just Landed AI

An intern housing search assistant powered by Claude (Anthropic API). Built as a single-page Vite + React + TypeScript + Tailwind app, it lets interns enter housing preferences, searches listings (via RentCast, Blueground scraper, or synthetic data), ranks results with LLM reasoning and commute estimates, and drafts outreach messages — all in a Claude Artifact-style interface.

## Getting Started

```bash
npm install
cp .env.example .env   # fill in API keys (optional — synthetic data works out of the box)
npm run dev
```

## Phase 1 Build Tracks

| Track | Owner Files | Description |
|-------|------------|-------------|
| **A — Preferences UI** | `src/components/PreferencesForm.tsx` | Housing preferences form bound to Zustand store |
| **B — Listings + Ranking** | `src/tools/searchListings.ts`, `src/components/ResultsList.tsx`, `src/components/ListingCard.tsx`, `src/components/ListingDetailModal.tsx` | Search listings (synthetic, RentCast, or Blueground via the local scraper API), rank with Claude, display results |
| **C — Commute + Outreach** | `src/tools/getCommute.ts`, `src/tools/draftOutreach.ts` | Google Maps commute estimates, LLM-drafted outreach emails |
| **D — Settings** | `src/components/SettingsTab.tsx` | API key management, synthetic-data toggle |
| **E — QA Log** | `src/components/QALogTab.tsx` | Scrollable log of all LLM ↔ user interactions from Zustand qaLog |

### Shared contracts (do not modify)
- `src/types.ts` — canonical type definitions
- `src/state.ts` — Zustand store
- `src/App.tsx` — tab routing shell
