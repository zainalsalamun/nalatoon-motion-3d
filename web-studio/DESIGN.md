# Nalatoon 3D Diorama Console — Anti-AI-Slop Design System

Inspired by open-source Anti-AI-Slop frameworks on GitHub (`pbakaus/impeccable`, `Vanszs/AntiSlopUI`, `cesaroeduardo/antiwebslop`, `LeoStehlik/no-slop-ui`).

## 1. Aesthetic Direction: Tactile Film & Diorama Console
Instead of generic "AI Dark SaaS" aesthetics, this studio UI follows the visual language of **Dieter Rams hardware consoles, DaVinci Resolve grading panels, and stop-motion film monitors**:
- **Surfaces**: Warm matte charcoal (`#131210` canvas, `#191815` panels, `#201e1b` recessed inputs) separated by **1px architectural hairlines** (`#2c2924`).
- **Zero Card-in-Card Nesting**: Sections inside panels use flat typographic dividers and subtle horizontal rules—never rounded cards stacked inside rounded containers.
- **Purposeful Color (OKLCH Harmony)**:
  - Primary Action: **Cinema Vermilion / Clay Terracotta** (`oklch(0.64 0.19 36)` / `#e4572e`) — echoes film-camera REC buttons and Indonesian clay-tile roofs in the 3D scenes.
  - Status LEDs: **Sage Olive** (`#6ba368`) for online/ready, **Warm Ochre** (`#d99b26`) for pending/queue, **Signal Red** (`#d9483b`) for error—rendered as crisp `7px` hardware LED dots, never bloated pill badges.
- **Typography**:
  - Display & Section Headers: `Space Grotesk` (crisp geometric technical character, tight tracking)
  - Body & Indonesian Labels: `Plus Jakarta Sans` (high legibility for Bahasa Indonesia)
  - Readouts, Timecodes, Logs: `JetBrains Mono` with `font-variant-numeric: tabular-nums`
- **Stage Framing**: Subtle 24px drafting-table dot/grid background + clean camera viewfinder corner brackets around the 9:16 3D player.

## 2. Hard Anti-AI-Slop Bans (Enforced by `npm run lint:slop`)
1. **No AI-Cliché Gradients**: Banned `#6366f1`–`#8b5cf6` indigo/violet gradients, cyan-emerald neon logos, and ambient glowing `radial-gradient` background blobs.
2. **No `Sparkles` Icon**: Banned `lucide-react` `Sparkles` / `Wand2` cliché AI icons. Use concrete studio/hardware metaphors (`Radio`, `SlidersHorizontal`, `Mic`, `Clapperboard`, `Film`).
3. **No Generic `Inter` Default Stack**: Must use the intentional studio font pairing above.
4. **No Glassmorphism Overuse**: Banned `backdrop-filter: blur(...)` chrome bars and neon glow `box-shadow`s.
5. **No Decorative Fluff Copy**: No marketing buzzwords, no "LOCAL WEB APP" filler pills, no emoji in UI chrome.
