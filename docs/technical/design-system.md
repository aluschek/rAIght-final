# rAIght design system

The app follows the **SAP Fiori design language, Horizon look** (the visual style, not the brand): a light shell bar across the top, a white side navigation, a dynamic page header with breadcrumb, white cards and tables on a light grey canvas, one blue accent (`#0070F2`), 8 px rounded buttons and inputs. The deck's content and tone carry over; its forest-green / lime palette does not.

**Reference:** the [SAP Fiori design guidelines](https://experience.sap.com/fiori-design-web/) (shell bar, dynamic page, list report, object status, semantic colours). Where the guidelines and this file disagree, **this file wins**. **The colour, radius and shadow values come from SAP's open theming package** (`@sap-theming/theming-base-content`, `sap_horizon/css_variables.css`, Apache-2.0). We use the look only: **no SAP logo, name or product names** in the UI ([ADR 0008](../decisions/0008-independent-vendor-framing.md)).

Use the tokens in `app/assets/tokens.css`; **never hard-code hex values in components**.

## 1. Character

Calm, factual, data-first. Light grey canvas, white cards with a 16 px radius, one blue accent, a light shell bar. Large areas are white or very light grey, strong colours only in small marks. **Green, red and amber mean status only** (Fiori semantic colours: Positive, Negative, Critical), so the brand colour is not green. A Fiori-style interface is also what colleagues know from other enterprise tools. Numbers are the hero: big, tabular, with unit, comparison and source. Red means "problem / uniform", orange means tokens, green means healthy. No illustrations, no glow. Every element answers a question Lena has.

## 2. Logo

The logo is a **mark plus a wordmark**, both drawn in code (no image files except the favicon):

- **Mark:** a deep-blue rounded square with **three rising steps that touch**, like a staircase (with gaps it would read as a bar chart); the lowest step is solid white, the other two are half transparent. It says the product's idea in one picture: *use the lowest step that does the job*. Built by `rAIght.logoMark()` in `app/assets/shell.js`; the same drawing is `app/assets/favicon.svg` (the one place where hex values are written out, because a standalone SVG cannot read tokens).
- **Wordmark:** `rAIght` in IBM Plex Sans Bold, 20 px, letter-spacing −0.025em. The capital I has serifs, so "AI" is not read as "Al". Only **"AI"** is blue (on the shell bar the logo sits at 26 px mark / 17 px wordmark).

```html
<span class="logo-mark"><!-- logoMark() --></span><span class="logo">r<span class="logo-ai">AI</span>ght</span>
```

- The small pill next to the wordmark shows only the current version (for example "v1.1.0"; the word "Demo" was dropped for go-live). The version comes from `app/data/content/about.json`, the same file as the About page, so it is changed in one place.
- Sizes: 26 px in the shell bar, 56 px on the About page. Never use the mark without its rounded square, and never stretch it.
- Tagline: "Not more AI, but r**AI**ght." – pitch and docs, not a page footer in the app.
- Don't recolour, outline, add a shadow, add letters inside the mark, or swap the font.

## 3. Colour tokens

Palette values live in `app/assets/tokens.css`. Components use the **semantic** tokens:

| Token | Use |
|---|---|
| `--color-bg` / `--color-surface` / `--color-surface-subtle` | canvas, cards, table header and hover rows |
| `--color-surface-tint` | selected row, secondary buttons, soft blue chips |
| `--color-surface-neutral`, `--color-track` | neutral chips, bar tracks |
| `--color-surface-inverse` | dark emphasis panel (flat navy) |
| `--shellbar-bg`, `--shellbar-text`, `--shellbar-hover`, `--shellbar-height` | light shell bar (44 px), its text and hover tint |
| `--color-text`, `--color-text-soft`, `--color-text-muted` | primary, secondary, caption text |
| `--color-primary`, `--color-primary-dark` | buttons, links, active nav, focus |
| `--color-border`, `--color-border-strong` | dividers, light borders |
| `--color-field-border`, `--color-button-border`, `--color-header-line` | input borders, default button border, page-header line (Horizon values) |
| `--color-avatar-bg`, `--color-avatar-text` | avatar circle with the initial: light blue fill, dark blue letter (Horizon Accent 6, `#D1EFFF` / `#0057D2`) |
| `--color-link`, `--color-focus`, `--color-hover` | links and hover borders (`#0064D9`), focus ring (`#0032A5`), grey hover row and button (`#EAECEE`) |
| `--color-good` / `--color-good-surface` | healthy values and chips |
| `--color-danger`, `--color-danger-text`, `--color-danger-surface`, `--color-danger-border` | problems: fills, red text, tints, outline buttons |
| `--color-warning-surface`, `--color-delta-text` | unused / delta chips |

**Data series (colour carries meaning):** tokens `--color-data-tokens` (orange) · uniform `--color-data-uniform` (red) · healthy `--color-data-healthy` (green) · other agents `--color-data-other` (blue) · inactive `--color-data-inactive` (grey). Chart helpers: `--color-grid`, `--color-axis-line`, `--color-series-1…4` (provider tiles).

**Contrast:** ink on canvas > 12 : 1 · muted text on white ≥ 4.5 : 1 · white on primary blue 4.6 : 1 · danger text on white 7 : 1. Don't use `--color-danger` (fill red) for small text; use `--color-danger-text`.

**Dark mode:** not part of the demo.

## 4. Typography

The Fiori font stack **`"72", "72full", Arial, Helvetica, system-ui, sans-serif`** for everything (the 72 font is loaded from the Apache-2.0 package `@sap-theming/theming-base-content` via the jsDelivr CDN, weights 300 / 400 / 600 / 700; if it cannot load, Arial or the system font takes over, as the guidelines allow); tabular figures for all numbers (`font-variant-numeric: tabular-nums`). `--font-mono` for tool names in paths. The logo wordmark keeps IBM Plex Sans.

| Role | Size / weight |
|---|---|
| Page title (page header) | 24 px / 700 |
| KPI value | 26–32 px / 400 (light, like a Fiori numeric header) |
| Card title | 16 px / 700 |
| Body, table cells | 13–14 px / 400 |
| KPI label | 14 px / 700 |
| Caption, subtitle, axis | 12–14 px / 400, muted |
| Table header | 13 px / 700, soft ink |
| Group labels (side navigation, dark panel) | 11 px / 700, UPPERCASE, 0.04–0.08em |

Sentence case everywhere; italic only for captions and quotes.

## 5. Layout

```
┌────────────────────────────────────────────────────────────┐
│ Shell bar (light, 44 px): logo + version pill ········ person menu
├──────────┬─────────────────────────────────────────────────┤
│ Side     │ Page header: breadcrumb, title + description · search / actions
│ navigation├────────────────────────────────────────────────┤
│ 256 px   │ Content (max 1360 px): headline + filters,       │
│ white    │ KPI row → cards → table → footnote               │
└──────────┴─────────────────────────────────────────────────┘
```

- **Shell bar:** white (`--shellbar-bg`) with a thin bottom line and a light shadow, sticky, 44 px. Left: menu button (small screens only), logo and the version pill; right: the person menu. No Fiori elements that the demo does not show (global search, notifications, product switch).
- **Side navigation:** below the shell bar, sticky; the menu depends on the role. **Process owner:** Overview (Dashboard), Build (Plan an automation), Monitor (Automations, Escalations with an open-case badge). **CIO office:** Overview (Dashboard, the company-wide page, read-only). **Admin:** Admin (Providers, Access). Below a divider for everyone: **Guidelines** (training material) and **About**. Active item = soft blue fill, blue text, 3 px blue bar on the left edge.
- **Page header** (Fiori dynamic page header, `.topbar`): white, 1 px bottom border and a light shadow; a **breadcrumb** above the title (`Home › Page`, added by `shell.js`, not shown on a role's home page; the agent page shows `Home › Automations › …`); page title with a one-line description under it (`.page-sub`); the page's search and primary action on the right. The person menu (avatar, name, role; opens a list to view the demo as another person) lives in the shell bar.
- **Greeting** (both dashboards): "Welcome back, <name>" (26 px / 700, filled by `shell.js` from the person shown; only a person's name is in `--color-primary`, a role account such as the CIO office just reads "Welcome back") with the one-sentence summary beneath it, filters on the right; on narrow screens the filters drop below. No coloured box around the sentence.
- **Filters:** 36–40 px high, white, 1 px border, 8 px radius (Fiori select); a set filter gets a blue border and "Clear filters".
- **Content grid:** KPI tiles `repeat(auto-fit, minmax(220px, 1fr))`; card rows as a 12-column grid (7 / 5) that stacks below 1180 px; gap 18 px.
- **Responsive:** below 900 px the side navigation is hidden and opens from the menu button in the shell bar (the person's name is hidden, the avatar stays); wide tables scroll inside their card, never the page.

### Shape

| | Value |
|---|---|
| Card | white, no border, **radius 16 px**, padding 16–20 px, Horizon shadow `--shadow-card` (1 px ring + soft lift) |
| Inputs, selects, search | **radius 4 px**, 1 px border `--color-field-border` (dark slate, as in Horizon); hover turns the border `--color-link`, focus `--color-focus` with a 1 px ring |
| Buttons, tags | **radius 8 px** (`--radius-pill` is 8 px, kept as the token name); never fully round |
| Status tags (Object Status) | radius 8 px, 1 px border in the semantic colour, optional leading dot |
| Provider tile | 40 px square, radius 12, two-letter code (CS, PA, AI, n8) in the provider's series colour |

## 6. Components

| Component | Spec |
|---|---|
| **KPI card** (Fiori numeric header) | label (14/700) + 34 px icon tile in a soft tone; big light value (32/400) + optional delta tag; one context line below. A rising token count is shown **red** (more tokens is not good) |
| **Primary button** (Emphasized) | 8 px radius, blue fill, white 13–14/600 text; **one per page**; no trailing arrow needed |
| **Secondary button** | white fill, blue border and text ("Keep agent") |
| **Outline button** (Default) | white fill, `--color-button-border`, link-blue text, grey hover `--color-hover` |
| **Danger button** (Reject) | pink fill `--color-danger-fill`, red text, pink border ("Retire agent") |
| **Status tag** (Object Status) | radius 8, 1 px border, dot + text: *Uniform* red (Negative) · *Healthy* green (Positive) · *Unused · 124 d* amber (Critical) · *Retired* grey |
| **Needs-attention row** | provider tile · name + status pill + one-sentence reason · token and same-path figures · action button |
| **Data table** (Fiori responsive table) | 13/700 header on a light fill, 48 px rows, 1 px row dividers, blue hover tint, numbers right-aligned; first column = tile + name (link) + provider · step + purpose; last column = suggestion button |
| **Inline bar (tokens)** | 110 × 8 px track, orange fill, value to the right |
| **Same-path value** | 14/800; red if `uniform_agent`, green otherwise, "–" if unused; colour comes from the threshold |
| **Sparkline** | 96 × 26 px polyline, 2 px; red uniform, green healthy, grey inactive |
| **Dark emphasis panel** | flat navy, white text, light-blue overline; used for the rAIght suggestion |
| **Path chain** | tool names as mono chips joined by `→` |
| **Settings rows** (About) | A card of collapsible rows (title, one-line summary, chevron) that open into their configuration. Used for **Demo data** | 
| **Company dashboard** (CIO office) | Same page pattern as the dashboard: headline, four KPI cards, line chart of tokens per month, stacked bars per owner (uniform red, other agents blue), and a ranked list "Where to look first". Aggregated figures only; no per-agent buttons, no names of single agents or runs |
| **Step progress** (Plan an automation) | Three rising steps in the shape of the logo mark (heights 52, 72 and 92 px, labels at the bottom). The current step is solid blue, finished steps are soft blue with a tick, the rest is light grey. Use it for short flows of a few steps only; it replaces round step pills |
| **Plan layout** | Two columns: the wizard on the left, the six ladder steps with their cost on the right (sticky; at the last step it marks the steps the triage ended on). Step 1 starts with chips "Start from an example" that fill name and description |
| **Flow sketch** (Plan an automation, Guidelines) | Read-only picture of the chosen ladder step: rounded boxes joined by arrows. Dashed grey = trigger, white = fixed step, blue with a small "tokens" tag = a step that uses an AI (costs tokens), green = done, amber = hand to a person (drawn as a side exit). An agent loop is a dashed box marked "may repeat"; several agents side by side are stacked. A chip shows tokens per run and one sentence explains the step. It is a sketch, not an editor: automations are built in the provider |
| **Confirm button** | A destructive action asks once: the first click turns the button into "Confirm remove" (back to normal after 4 s), the second click does it. Used to remove an automation saved in this session; the sample agents cannot be removed, only retired when unused |
| **Role notice** | When a role opens a page it may not use (for example the CIO office on Plan an automation) the page shows a short card: what the page is for, who may use it, and a button back to the dashboard. Never an empty or broken page |
| **Access page** (Admin) | Role legend (3 short cards), table of people with a role select and a Remove button, add form with inline errors, one-line demo note. The person shown is locked |
| **Providers page** (Admin) | Table: provider code tile and name, status (Connected / Disconnected), last import, automation count, Disconnect or Connect button |
| **rAIght Assistant** | Round blue button bottom right (56 px) opens a 430 px chat panel: header with the title only and a plug button that opens the **MCP servers and skills** panel: a simulated list of example MCP servers (Jira MCP server, Internal Knowledge Hub, n8n, plus "+ Connect another MCP server", which takes an address and adds a simulated entry that answers nothing) and a list of **skills** the assistant really has (Ladder triage, n8n draft, Token report), each with an on/off switch; a skill switched off really removes that ability. A reply that needs a switched-off server or skill says so and offers "Open MCP servers and skills"; every reply ends with a small "Used: …" line naming its source), message bubbles, suggestion chips, input with Send. Answers can carry link buttons. For a task to automate, the answer is one bubble: the best-fit step with a plain sentence, the reasons as a short list (marked "from your description" or "you told me"), the flow sketch, and actions ("Plan this automation", "Make an n8n draft"). A draft comes with Download, Copy and a **simulated** create button that asks for confirmation. Agents are never drafted. Escape closes it. Only on the dashboard. The answers are prepared from the sample data and the MCP servers are only drawn, never real (no model call, [ADR 0006](../decisions/0006-pure-clickable-demo.md)); always say so in the UI. A built-in assistant on a customer's own platform is a pitch point only and is **not built in this version** |
| **Toast** | white message card with a green left edge, bottom right, 3.5 s, confirms a state change (e.g. "Reference check reminder retired") |

## 7. Charts

- **Forms:** trend over months → line chart, one line per series, area under the problem series, dots on points, hover tooltip with guide line; shares vs threshold → horizontal bars with a 2 px threshold marker; trends in tables → sparklines; daily volume → thin vertical bars.
- Light gridlines, solid axis line, 11 px muted labels; legend above the chart as short line swatches.
- Card title + subtitle state unit and period ("millions of tokens per month · May – Oct 2026").
- Footnote under data that needs explaining: *"Tokens straight from the run logs · 'Same path' = share of runs with identical steps · no extra AI checks the AI"*.
- No 3D, no pie charts, no animation beyond hover.

## 8. Icons

**Our own icons**, drawn in the style of SAP's Horizon icons (16-px grid, filled, drawn in `currentColor`), as inline SVG built by `rAIght.sapIcon(name, size)` in `app/assets/shell.js`; the path data lives in the `SAP_ICONS` map there, so no font or image file is loaded. Size 18 px in menus and tiles, 14–16 px inline. One set only; no stroke/filled mix, no emoji. Icon-only buttons need an `aria-label`. To add an icon, draw it on the same 16-px grid and add its path data to `SAP_ICONS`.

## 9. Voice and page structure

**Pages read top-down:** a noun title ("Dashboard", "Escalations"), at most one subtitle line, then the answer or next step first (a headline, a verdict, a primary button), then the detail (lists, charts), then explanations as footnotes. Never copy issue titles, ADR text or concept paragraphs into the UI; a page must work as software, not read as documentation. Menu labels are places or tasks ("Dashboard", "Plan an automation"), not parts of the concept.


Short, plain English, sentence case, verbs first on buttons ("Convert to workflow", "Retire agent"). Use [glossary](../concept/09-glossary.md) terms, but **write for colleagues who are not technical**: say what something does before you name it, explain every technical word once in a plain sentence without examples or comparisons, keep sentences short. The Guidelines page is where the words are explained; other pages should not need it to be understood. Talk to Lena as the owner ("your automations"), never as someone being checked. Every number has a unit and a comparison or threshold next to it.

## 10. Don'ts

- No slide patterns: no wide-tracked overline above every heading, no full-width headline sentences as page titles.
- **No gradients and no glow** anywhere (logo mark, avatar, buttons and panels are flat colours). The one dark emphasis panel is the only dark area. KPI icon tiles are neutral grey: colour is for status, not decoration. The assistant button and its panel header use the two-sparkle icon, the one place where it is used.
- No red fill colour for small text; no colour outside the tokens. If you need one, add it to the tokens first.
- Lena's avatar is the initial "L" on a circle, not a picture.
- No logos of Microsoft, OpenAI, n8n or any other company: providers appear **by name only** ([ADR 0005](../decisions/0005-scope-external-agents.md)). The two-letter provider tiles are codes, not logos.
- **Fiori look only, no SAP branding:** no SAP logo, name or product names anywhere in the UI ([ADR 0008](../decisions/0008-independent-vendor-framing.md)). Don't add Fiori elements the demo does not show (global search, notifications, product switch).

## 11. State and loading

- Demo changes (retired agent, saved automation, handled case) live in `sessionStorage`; **About → Reset demo data** clears them so the demo can start over.
- While the sample data loads, the content area is dimmed and fades in once it is there; never show an empty page frame.
- Elements that are not interactive must not look interactive (for example the period label "Last 30 days" is plain text, not a pill).
