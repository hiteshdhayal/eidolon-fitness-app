# BUILD SPEC — Eidolon

Indian diet plans, training knowledge, and reel companion site for Hitesh Dhayal (@hiteshdhayal).

## 0. How to work on this project

You are a senior full-stack engineer and an experienced editorial/product designer. Read this entire spec before writing code. Re-read the relevant section before starting each phase.

Rules:

1. Build in the phases in §23. After each phase: run typecheck, lint, tests and a production build; fix all errors; commit with a clear message; give a short summary (done / next / what you need); then STOP until told to continue.
2. Never invent facts about the creator: no fake credentials, testimonials, follower counts, transformation stories, ratings, or "as seen in" logos.
3. When something is ambiguous, choose the simplest option consistent with this spec and log it in `docs/DECISIONS.md` (one line per decision).
4. Add a dependency only when it clearly earns its place; log why in DECISIONS.md.
5. Health content must be conservative and evidence-based and must never contradict medical advice. When unsure, say less and point to a doctor.
6. Never put secrets or API keys in frontend code.
7. Empty config values must hide their UI. Never render `{{…}}`, "undefined", or an empty label.

## 1. What we're building and why

**Purpose:** The link shared in the Instagram bio and reels. People come for a free, personalized Indian diet plan. They stay for exercise knowledge and articles that go with reels. Then they follow on Instagram.

**Success metrics:** questionnaire completion rate, return visits, Instagram follow clicks, affiliate clicks.

**Audience:** Indian adults aged 18–45. About 90% are on mobile, often mid-range Android phones on patchy 4G, and English fluency varies. Use plain Indian English and call dishes by their local names.

**Principles, in priority order:**

1. Trust: accurate, safe, honest, no dark patterns.
2. Zero friction: no sign-up, mostly taps, about 2 minutes.
3. Speed: feels instant on a ₹12,000 Android phone.
4. Restraint: professional design where typography does the work.
5. Retention: every page gives a reason to come back and a reason to follow.

## 2. Tech stack (use exactly this unless blocked)

- Astro (latest stable supported by the machine's Node), TypeScript `strict`, static output.
- Preact islands (`@astrojs/preact`) only for interactive parts: questionnaire, plan view, progress tracker, calculators, filters. Every other page ships zero JS apart from the header sentinel and analytics.
- Astro Content Collections (Markdown/MDX + zod schemas) for reels, articles, exercises, workouts, products and health notes.
- Styling: Tailwind CSS v4 with the default palette removed (`--color-*: initial;` inside `@theme`) and only the §3 tokens defined. Plain CSS with custom properties is acceptable instead, but the tokens are the only allowed source of values.
- Fonts self-hosted via Fontsource packages (no Google Fonts CDN).
- Icons: Lucide, used sparingly.
- Charts: hand-written SVG (no chart library).
- Client storage: localStorage with a versioned schema, zod validation, and migrations.
- Tests: Vitest (engine and utilities), Playwright (key flows at 375px, 768px and 1440px), @axe-core/playwright (accessibility).
- pnpm, ESLint, Prettier.
- No database, no auth, no backend in v1. The diet plan is computed entirely in the browser.

## 3. Design system

### 3.1 Direction

The style is **night race / performance lab**: high-energy, fast, precise, confident. That means strong type, hairline rules, numbered sections, generous white space, high contrast, and photography that blends into the page. It should feel calm, controlled and expensive, with the tension of a starting grid.

Borrow the _feel_ of F1 broadcast graphics, Porsche Motorsport, Nike Training and WHOOP, without copying any of them.

### 3.2 Color: Obsidian, Ice, Racing Red

```css
/* Obsidian (cool, near-black) */
--obsidian-950: #060607;
--obsidian-900: #0b0c0e; /* primary dark background */
--obsidian-800: #131417; /* raised surface on dark */
--obsidian-700: #1c1e22; /* outlines/wordmark on dark */
--obsidian-600: #2a2d33; /* borders on dark */
--obsidian-500: #3a3e45;

/* Steel (mid tones) */
--steel-500: #5e6570; /* muted text on ICE only */
--steel-400: #8b939d; /* muted text on OBSIDIAN */
--steel-300: #aeb5be;

/* Ice (cool light gray) */
--ice-300: #c3cbd3; /* borders on light */
--ice-200: #d3dae1;
--ice-100: #e4e9ee; /* primary light background */
--ice-50: #f1f4f7; /* text on dark; long-form reading bg */
--ice-0: #f8fafb; /* raised surface on light */

/* Racing red */
--red-700: #9e0b07; /* pressed */
--red-600: #c10a04; /* hover; red TEXT on light surfaces */
--red-500: #e10600; /* primary accent: fills, bars, large type */
--red-400: #ff3b30; /* red TEXT/icons on dark surfaces */
```

**Surfaces.** Theme each section with an attribute that remaps the semantic tokens. Components only ever use the semantic tokens:

```css
[data-surface='obsidian'] {
  --bg: var(--obsidian-900);
  --surface: var(--obsidian-800);
  --text: var(--ice-50);
  --text-muted: var(--steel-400);
  --border: var(--obsidian-600);
  --border-strong: var(--ice-100);
  --accent: var(--red-500);
  --accent-hover: var(--red-600);
  --accent-text: var(--red-400);
  --focus: var(--red-400);
}
[data-surface='ice'] {
  --bg: var(--ice-100);
  --surface: var(--ice-0);
  --text: var(--obsidian-900);
  --text-muted: var(--steel-500);
  --border: var(--ice-300);
  --border-strong: var(--obsidian-900);
  --accent: var(--red-500);
  --accent-hover: var(--red-600);
  --accent-text: var(--red-600);
  --focus: var(--red-600);
}
```

**Contrast rules.** These ratios are approximate. Verify every pairing with axe and fix anything that fails.

| Foreground → background   | Ratio  | Allowed for                                            |
| ------------------------- | ------ | ------------------------------------------------------ |
| ice-50 on obsidian-900    | ~17:1  | everything                                             |
| steel-400 on obsidian-900 | ~6:1   | muted body text                                        |
| red-400 on obsidian-900   | ~5.4:1 | red text of any size on dark                           |
| red-500 on obsidian-900   | ~3.9:1 | large text (≥ 24px, or ≥ 19px bold) and UI shapes only |
| white/ice-0 on red-500    | ~5:1   | button labels                                          |
| obsidian-900 on ice-100   | ~16:1  | everything                                             |
| steel-500 on ice-100      | ~4.7:1 | muted body text                                        |
| red-600 on ice-100        | ~5.5:1 | red text of any size on light                          |
| red-500 on ice-100        | ~4:1   | large text and UI shapes only                          |

**Proportions.** In any viewport, aim for roughly 60% obsidian, 30% ice, and no more than 10% red.

**Red is allowed for:** primary CTA fills; the speed bar before eyebrows; one accent phrase per headline; section numbers on hover; active nav underline; progress bars; selected-state markers; focus rings; the single kinetic band; warning callout bars; key data highlights on the future plan page; `::selection` (red-500 background, white text).

**Red is never used for:** body text; large background areas beyond the kinetic band and buttons; gradients; glows or text shadows; borders on every card.

**No other hue is allowed anywhere.** No orange, yellow, green, blue or purple, including success states. Show success with a check icon and text.

### 3.3 Typography

- **Display and headings: Archivo** (variable, weights 600–900, width axis 62–125).
- **Body and UI: IBM Plex Sans** at 400, 500 and 600.
- **Labels, data, macros, eyebrows: IBM Plex Mono** at 400 and 500, with tabular numerals. Eyebrows are uppercase, 12px, tracking 0.12em.
- **Display (hero and final CTA):** Archivo 900, width 110, UPPERCASE, line-height 0.9, tracking -0.01em, `clamp(2.75rem, 1rem + 7vw, 7rem)`.
- **Headline accent phrase:** Archivo Italic 900 in `--accent`. Load the italic variable file but do not preload it.
- **h2:** Archivo 800, width 105, UPPERCASE, `clamp(1.75rem, 1rem + 3vw, 3.25rem)`, line-height 0.95.
- **h3:** Archivo 700, width 100, sentence case, 1.375rem.
- **Body:** Plex Sans, 1.0625rem (17px), line-height 1.65; article body 1.125rem. Paragraph measure 60–72ch.
- **Small:** 0.875rem. **Label:** 0.75rem mono.
- **Big section numbers ("01", "02"):** Archivo 900, width 125, about 96px, outlined only (`-webkit-text-stroke: 1.5px var(--border-strong); color: transparent`). On row hover they fill with `--accent` over 200ms.
- **Banned fonts:** Inter, Geist, Poppins, Montserrat, Roboto, Open Sans, Lato, Space Grotesk, Outfit, Plus Jakarta Sans, DM Sans, Manrope, and any script or handwritten font.
- Preload exactly two font files (Archivo upright and Plex Sans regular). Subset to Latin. Use `font-display: swap`.

### 3.4 Layout and spacing

- 4px base unit. Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160.
- 12-column grid, max content width 1240px, gutters 24px (16px on mobile). Vertical section padding: clamp(64px, 10vw, 144px).
- Mobile-first: design at 375px, then 768px, 1024px and 1440px.
- Build structure from 1px hairline rules, not boxes and shadows. Prefer asymmetric editorial compositions over centered stacks.
- Section header pattern: speed bar + mono eyebrow with a number ("01 — HOW IT WORKS"), then h2, an optional one-line intro, and a rule.

### 3.5 Components

All of these live on `/styleguide` (noindex), shown on both obsidian and ice surfaces.

- **Primary button:** red-500 fill with ice-0 text, 0 radius, 52px tall. Label Archivo 800, width 110, uppercase, 14px, tracking 0.06em, trailing arrow. Hover red-600 with the arrow moving 4px right over 180ms. Active red-700.
- **Secondary button:** 1px `--border-strong` outline, transparent, `--text` label. Hover fills `--text` from left to right via background-size over 220ms, label switches to `--bg`.
- **Text link:** 1px underline at 4px offset. Hover changes the underline to 2px `--accent`.
- **Focus (all interactive elements):** 2px solid `--focus` outline, 3px offset.
- **Speed bar:** 32×4px `--accent` bar before every eyebrow, 12px gap.
- **Option cards:** base `--surface` with 1px `--border`. Selected: obsidian-900 fill on ice surfaces (or ice-50 fill with obsidian text on obsidian surfaces), a 4px red left bar, and a check icon. Built on real inputs.
- **Inputs:** 56px tall, 2px radius. On dark: obsidian-800 fill, obsidian-600 border, ice-50 text. On light: ice-0 fill, ice-300 border. Focus border uses `--focus`. Unit suffix in mono inside the field.
- **Callouts:** 3px left bar — `--text` for info, `--accent` for warning or "see a doctor" — with an icon.
- **Tabs:** active tab has a 3px red bottom bar.
- **Progress bar:** 3px red on `--border`.
- **Cards:** `--surface`, 1px `--border`, 0 radius, no shadow. Hover moves the border to `--border-strong`.
- **Tags:** Plex Mono uppercase, 1px `--border`.
- **Other components:** segmented control, searchable select, stepper, accordion, toast, mobile bottom sheet, table, stat block.

### 3.6 Imagery and icons

- Use only real black-and-white photos of the creator, supplied in `src/assets/hero/` and `src/assets/reels/`.
- Never use stock photos, AI-generated images, 3D renders, illustrations of people, or food stock photography.
- Process photos at build time: grayscale with a cool tint (`#E4E9EE`) and high contrast, so they match obsidian and ice.
- Photos blend into the background. No boxes, borders, dashed outlines, shadows, rounded corners or visible rectangle edges. Use masks for fades.
- Lucide icons at 1.5px stroke and 20px, only where they help scanning. Never put icons inside circles.

### 3.7 Motion

- 150–220ms ease-out, animating only opacity and translations of up to 8px, except the specified hero reveal and kinetic band.
- **Headline reveal on load:** each line slides up from a clipped container (translateY 105% → 0), 650ms, cubic-bezier(0.16, 1, 0.3, 1), staggered 90ms. Sub, CTAs and photo fade in after it. Runs once.
- **Section reveals:** CSS scroll-driven animations (`animation-timeline: view()`) inside `@supports`, opacity 0→1 and translateY 24px→0. Where unsupported, content is visible. No JS.
- **Hover energy:** button wipes, arrow nudges, underline growth, outlined numbers filling red. Nothing else.
- **Kinetic band:** CSS-only, 45s linear infinite, paused on hover.
- Respect `prefers-reduced-motion`: nothing animates, the band is static.
- No parallax, scroll-jacking, marquees beyond the single band, typewriter text, count-up numbers, confetti, cursor effects or animated gradients.

### 3.8 Anti-slop hard bans

- **Effects and decoration:** gradients (except the hero photo masks and the text scrim in §D8), glows, neon, text shadows, blur or glassmorphism, blobs, waves, noise or grain overlays.
- **Color:** any hue outside the §3.2 tokens. That includes success, error, links, charts and hover states.
- **AI tells:** emojis in the UI, sparkle or magic-wand icons, "AI-powered" badges, and the default shadcn/v0 look.
- **Layout clichés:** bento grids, rows of three icon + title + blurb cards, pill shapes everywhere, a centered hero with a badge, carousels for primary content.
- **Motion overreach:** more than one marquee per page, parallax, scroll-jacking, confetti, cursor effects.
- **Fake or unfinished content:** fake stats, fake testimonials, fake logos, lorem ipsum in shipped pages, visible `{{…}}` placeholders.

### 3.9 Voice and copy

- Write in first person as the creator ("I built this so…"). Be direct, warm and specific, in Indian English. Short sentences and numbers over adjectives.
- Banned words: unlock, elevate, transform your journey, revolutionize, game-changer, seamless, empower, supercharge, dive in, holistic, next-level, "journey" as filler, "in today's fast-paced world", "look no further".
- No guilt or body-shaming language and no before/after framing.

## 4. Site map

| Route                                                        | Purpose                                                |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| `/`                                                          | Home                                                   |
| `/plan`                                                      | Questionnaire                                          |
| `/my-plan`                                                   | Saved plan (tabs: Plan · Groceries · Progress)         |
| `/learn`, `/learn/[slug]`                                    | Exercise library and exercise detail                   |
| `/workouts`, `/workouts/[slug]`                              | Ready-made workout templates                           |
| `/reels`, `/reels/[slug]`                                    | All reels; one page per reel with a written summary    |
| `/articles`, `/articles/[slug]`                              | Articles that go with reels, including affiliate posts |
| `/tools/bmi`, `/tools/calories`, `/tools/protein`            | Calculators (SEO entry points)                         |
| `/links`                                                     | Ultra-light link-in-bio page                           |
| `/about`                                                     | About me                                               |
| `/disclaimer`, `/privacy`, `/affiliate-disclosure`, `/terms` | Legal                                                  |
| `/styleguide`                                                | Component gallery (noindex)                            |
| 404                                                          | Helpful 404 with links                                 |

Until a real page ships, every linked route has a polished noindex placeholder (`src/layouts/ComingSoon.astro`). A post-build link checker keeps this honest.

**Header:** transparent over the hero, then solid obsidian after ~80px. Text wordmark **EIDOLON** with a red square. Nav links Diet plan · Learn · Articles · Reels with a red underline on hover and on the current page. Follow button and a red "Build my plan →" button on desktop. On mobile, a full-screen obsidian menu with huge links and red index numbers.

**Sticky bar (mobile):** content pages get a slim bottom bar with a full-width red "Build my free diet plan →". Hide it on `/plan` and `/my-plan`.

**Footer:** obsidian-950 with the wordmark, nav columns, Instagram link, a one-line disclaimer, an affiliate disclosure line, and © year · eidolon.cloud.

## 5. Home page (top to bottom)

1. **Hero (obsidian):** eyebrow with speed bar, display headline with a red italic phrase, sub, primary CTA to `/plan`, Follow link, proof line, giant outlined background wordmark, blended photo, text scrim. See §D8.
2. **Kinetic red band:** rotated, overlapping the hero and How it works. See §D7.1.
3. **How it works (ice):** 01 Answer a few taps, 02 Get a 7-day plan from your region's food, 03 Track progress and swap meals. One rule above the first row, one between rows. Outlined numbers fill red on hover.
4. **"Your state's kitchen":** a state picker (Haryana, Punjab, Tamil Nadu, Kerala, West Bengal, Gujarat, Maharashtra, Assam…) with a sample veg day and non-veg day that update instantly.
5. **Latest reels:** 6 grayscale 9:16 thumbnails (horizontal scroll on mobile) and an "All reels" link.
6. **Learn teaser:** 3–4 exercise and workout links as an editorial list.
7. **Latest articles:** date, title, one-line dek and reading time.
8. **About me:** short version plus credentials when supplied; hide the credential line while empty.
9. **FAQ accordion:** Is it free? Is this medical advice? Do I need protein powder? Where is my data stored? Does it work with PCOS / diabetes / thyroid? Can I use it in a hostel?
10. **Final CTA (obsidian):** "YOUR PLAN IS _2 MINUTES_ AWAY." with the primary button and a Follow link, 16px gap, plus a thin red line above the eyebrow.

## 6. Diet plan questionnaire (`/plan`)

### 6.1 UX rules

- One question per screen, with big tappable option cards.
- Single-choice questions auto-advance 150ms after a tap. Numeric and multi-select questions use a "Next" button pinned to the bottom on mobile.
- Top bar: back arrow, mono step counter ("07 / 18") and a 3px progress bar (red fill).
- Each question can have one muted helper line underneath. Exact copy is in §6.2.
- Autosave every answer to localStorage. On return, offer "Continue where you left off" or "Start over".
- Full keyboard support (arrow keys and Enter), proper labels, and an `aria-live` announcement for each new question.
- Intro screen: "Takes about 2 minutes. Your answers stay on your phone — nothing is sent to a server." One-line disclaimer and a "Start" button.
- Review screen: list every answer with an "Edit" link, then "Build my plan".
- No required free-text fields.

### 6.2 Questions (ids, options, helper text, branching)

**About you**

- `goal` (single): Lose fat · Build muscle · Eat healthier and get fitter · Gain weight
- `sex` (single): Male · Female · Prefer not to say. Helper: "Used to estimate your calorie needs."
- `age` (number, 13–90). Under 18 goes to guidance mode (§7.1).
- `height`: cm or ft + in segmented control, default ft + in. Valid range 120–220 cm.
- `weight`: kg, 30–250, one decimal place.
- `targetWeight`: optional, shown only for lose/gain goals, with a "Skip" link. Helper: "Optional. A realistic pace is about 0.5 kg a week."

**Health** (multi-select; "None of these" clears the other options)

- Female `conditions`: PCOS / PCOD · Thyroid: hypothyroid (underactive) · Thyroid: hyperthyroid (overactive) · Low iron / anaemia · Vitamin D or B12 deficiency · Diabetes or prediabetes · High blood pressure · High cholesterol or triglycerides · Fatty liver · Acidity, bloating or IBS · Perimenopause / menopause · Pregnant · Breastfeeding · Kidney disease · Heart condition · None of these
- Male `conditions`: Diabetes or prediabetes · High blood pressure · High cholesterol or triglycerides · Fatty liver · High uric acid / gout · Thyroid issue · Vitamin D or B12 deficiency · Acidity, bloating or IBS · Kidney disease · Heart condition · None of these
- Prefer not to say: union of both lists.
- Helper: "Pick all that apply. This only changes food choices and safety notes — and it stays on your phone."
- `diabetesType` (if diabetes was picked): Prediabetes · Type 2 · Type 1 · Not sure
- `medications` (multi): None · Diabetes tablets (e.g. metformin, glimepiride) · Insulin · Thyroid medicine · Blood pressure medicine · Cholesterol medicine · Other regular medicine
  - Helper: "Your plan never changes your medicines. This only adds safety notes. Always follow your doctor."

**Activity**

- `trainingDays`: Not training right now · 1–2 days a week · 3–4 days · 5–6 days · Every day
- `trainingType` (multi, skipped if not training): Gym / weights · Home workouts · Running or cycling · Sports · Yoga or pilates
- `steps`: Under 3,000 · 3,000–6,000 · 6,000–9,000 · 9,000–12,000 · More than 12,000 · Not sure
  - Helper: "Check your weekly average — on iPhone in the Health or Fitness app, on Android in Google Fit or Samsung Health."
- `dayType` (only if steps = Not sure): Mostly sitting · Some walking · On my feet most of the day · Physical work

**Food**

- `state`: searchable select of all 28 states and 8 UTs, plus "Outside India". Helper: "Your plan will use the food you grew up eating."
  - If Outside India, ask `homeRegion`: "Which state's food do you cook at home?"
- `cuisineMix`: Mostly my region's food · Mix in food from other regions
- `dietType`: Vegetarian · Eggetarian (veg + eggs) · Non-vegetarian · Vegan · Jain. Jain sublabel: "No onion, garlic or root vegetables"
- `meats` (multi, non-veg only): Chicken · Fish & seafood · Eggs · Mutton · Pork · Beef
- `restrictions` (multi): Lactose intolerant · No dairy at all · Gluten-free · Peanut allergy · Tree-nut allergy · Soy-free · No onion & garlic · None
  - Helper: "Lactose intolerant? Many people still do fine with curd — I'll keep milk out either way."
- `foodSource`: I cook for myself · Family cooks at home · Hostel, PG or mess · I mostly order or eat out
  - Helper: "If you don't control the menu, I'll show you how to build your plate instead."
- `mealPattern`: 3 meals · 3 meals + snacks · 2 meals (I skip breakfast)
- `budget`: Keep it cheap · Moderate · Flexible. Helper: "Affects things like paneer, nuts, fish and tofu."
- `supplements`: Food only, please (default) · Open to it if it helps. Helper: "You never need supplements for this plan."
- `firstName` (optional): "What should I call you?" with a Skip option.

## 7. Plan engine (`src/lib/engine/`)

The engine is pure TypeScript with no DOM access, fully deterministic and unit-tested. Every constant lives in `engine/constants.ts` with a comment explaining it, so a professional can tune it later.

### 7.1 Safety gate

This runs first and returns a mode: `full`, `gentle` or `guidance`.

**Guidance mode (no numbers):**

- Age under 18: no calorie numbers, deficits or weight targets. Show balanced regional meal ideas, protein-rich foods, and activity and sleep tips, plus "talk to a parent or doctor before trying to change your weight."
- Pregnant: general healthy-eating guidance only, with no deficit, plus "your gynaecologist or a registered dietitian should set your targets."
- Kidney disease: no protein targets, because protein, potassium and phosphorus need medical individualization. Show a prominent "see your doctor" note.

**Gentle mode:**

- Breastfeeding: maintenance calories with no deficit, plus a consult note.
- Type 1 diabetes, insulin, or diabetes tablets: deficit of at most 10%, carbs spread evenly across meals, plus "Some diabetes medicines (like insulin or glimepiride) can cause low sugar when you eat less. Talk to your doctor before cutting calories."
- Heart condition, or age 65+: deficit of at most 10%, plus a consult note.

**Rules in every mode:**

- If current BMI is under 18.5 and the goal is "Lose fat", switch the goal to "Eat healthier and get fitter" and explain kindly.
- If the target weight implies BMI under 18.5, reject it with: "That's below a healthy weight for your height. Let's aim for {{X}} kg or above."
- Never produce a rate of loss above 1% of body weight per week.

### 7.2 Numbers

- **BMI:** Asian cutoffs (WHO Asia-Pacific): under 18.5 underweight; 18.5–22.9 healthy; 23–24.9 overweight; 25+ obese. Display neutrally.
- **BMR (Mifflin-St Jeor):** Male `10w + 6.25h − 5a + 5`; Female the same with `− 161`; Prefer not to say `− 78`.
- **Activity factor** = steps base + training add, capped at 1.9.
  - Steps base: under 3k 1.20; 3–6k 1.30; 6–9k 1.40; 9–12k 1.50; 12k+ 1.60.
  - "Not sure" maps dayType to 1.20 / 1.30 / 1.45 / 1.60.
  - Training add: 0 / 0.05 / 0.10 / 0.15 / 0.20.
- **TDEE** = BMR × activity factor.
- **Goal adjustment:** Lose fat −20%, capped at −500 kcal (−15% if BMI < 23, −10% in gentle mode). Build muscle +250 kcal if BMI < 23, otherwise maintenance. Gain weight +15%, capped at +500. Eat healthier = maintenance.
- **Calorie floor:** never below max(BMR, 1,200 female / 1,500 male / 1,350 unspecified), rounded to the nearest 50.
- **Protein**, g/kg of reference weight (current weight, or weight at BMI 25 if BMI above 25): not training 1.0; training 1–4 days 1.2–1.4; training 5+ days or muscle goal 1.6; +0.2 during fat loss, cap 1.8, at least 1.0 for 50+. Feasibility check against the food database; lower and explain if food alone can't reach it. Mention supplements only if open to them.
- **Fat:** 25–30% of calories (minimum 0.6 g/kg). **Carbs:** the remainder.
- **Lower-carb conditions:** PCOS, diabetes/prediabetes, fatty liver, high triglycerides → carbs ≤ 45% of calories, low-GI grains, protein and fiber at every meal.
- **Fiber:** 25–40 g. **Water:** ~35 ml/kg + 500 ml on training days. **Salt:** under 5 g/day, stronger messaging for high BP.
- **Steps target:** midpoint of the current band + 2,000, capped at 10,000. People already above that keep their level.

### 7.3 Meal generation

- **Calorie split:** 3 meals 30 / 40 / 30; 3 meals + snacks 25 / 10 / 30 / 10 / 25; 2 meals 45 / 15 / 40.
- **Filtering:** diet type, meats, restrictions and allergies, budget, condition preferences.
  - Jain excludes onion, garlic, potato, carrot, radish, beetroot and other roots and tubers.
  - Lactose intolerant excludes milk but allows curd and hard cheese with a note. No dairy at all excludes all dairy.
  - Vegan excludes dairy, eggs and honey.
- **Region weighting:** ≥ 70% from the person's state or region, rest pan-Indian; "Mix in" lowers to 50%.
- **Portion scaling:** ½-katori steps, whole rotis and idlis, 50 g paneer steps. Daily calories within ±7% of target, protein ≥ 90%.
- **Variety:** no main twice in a day; any main at most twice a week; "occasional" dishes at most once a week.
- **Determinism:** seed the RNG with a hash of the answers, so the same answers produce the same plan. Swap shows 3 similar alternatives; shuffle regenerates a day.
- **Output:** 7 days, with time, local name + English gloss, household measure + grams, kcal/protein, prep note.
- **Hostel/mess and eat-out modes:** plate-building rules instead of recipes (½ plate sabzi/salad, ¼ dal/paneer/egg/chicken, ¼ roti or rice; what to pick at a mess; region-specific ordering guides).
- **Grocery list:** weekly, grouped by category, with persistent checkboxes.

### 7.4 Health notes

Store in `src/content/health-notes/*.md`, one file per condition or medication. Frontmatter: `appliesTo`, `priority`, `reviewedBy`. Leave `reviewedBy` empty; show "Reviewed by …" only when filled. Seed drafts: PCOS/PCOD, hypothyroid on medicine, low iron/anaemia, diabetes/prediabetes, metformin, high BP, high cholesterol/triglycerides/fatty liver, high uric acid/gout, lactose intolerance, vitamin D/B12, acidity/IBS, menopause. Keep them short, practical and non-diagnostic.

Every plan also shows: "This plan is general guidance, not medical advice. Check with your doctor, especially if you have a medical condition or take medicines."

### 7.5 Types

`Answers`, `SafetyResult`, `Targets`, `Meal`, `DayPlan`, `Plan`, `GroceryList` in `engine/types.ts`, with matching zod schemas in `engine/schema.ts`.

### 7.6 Tests (minimum 40 Vitest cases)

BMR and TDEE against known values; calorie floors and caps; Asian BMI bands; every safety gate, including teen mode returning no numbers; Jain/lactose/vegan/meat filtering; region share ≥ 70%; daily kcal within ±7%; determinism; hostel-mode output shape.

## 8. Food database (`src/data/foods/`)

- One file per region, validated by zod at build time.
- Schema: `id`, `name`, `localNames[]`, `slots[]`, `states[]`, `region`, `diet { veg, egg, nonveg, vegan, jainSafe }`, `contains { dairy, lactoseHigh, gluten, peanut, treeNut, soy, egg, fish, shellfish, chicken, mutton, pork, beef, onionGarlic, rootVeg }`, `serving { measure, grams }`, `perServing { kcal, protein, carbs, fat, fiber }`, `gi`, `budget` (1–3), `occasional`, `eatOutFriendly`, `prepMinutes`, `source`, `verified` (default false).
- Use IFCT 2017 (ICMR–NIN) where possible; otherwise compute from ingredients and set `verified: false`.
- Round kcal to the nearest 10 and macros to whole grams; label "approx.".
- Align advice with ICMR-NIN Dietary Guidelines for Indians (2024).
- Generate `docs/food-review.csv` for dietitian review.
- At least 220 items. Each region: 8 breakfasts, 10 lunch/dinner mains, 6 sides, 5 snacks, staples, protein add-ons.
- Map all 36 states and UTs to a region, with state-level staple overrides (North: Haryana, Punjab, Delhi/UP, Himachal/Uttarakhand, J&K; West: Gujarat, Rajasthan, Maharashtra, Goa; South: Tamil Nadu, Kerala, Karnataka, Andhra/Telangana; East: West Bengal, Odisha, Bihar/Jharkhand; Northeast: Assam, Manipur, Meghalaya, Nagaland, Sikkim, Mizoram; Central: MP, Chhattisgarh).

## 9. Plan page (`/my-plan`)

- Empty state with a CTA to `/plan`.
- Header: "{{firstName}}'s plan" (or "Your plan"), the date, chips summarizing answers, "Edit answers".
- **Key numbers on the obsidian surface:** calories, protein, carbs, fat, fiber, water and steps target as big Archivo numbers with mono labels. **Red marks the user's target and current values; steel is used for everything else.**
- "How I worked this out" accordion in plain language.
- Health notes as callouts, plus a banner in gentle or guidance mode.
- Tabs: Plan (Mon–Sun, Swap, Shuffle day), Groceries, Progress.
- "Download as PDF" with a dedicated A4 monochrome print stylesheet (red only for the speed rules), one day per page.
- Related reels matched by goal, conditions, diet type and region.
- Follow block with a FollowLink.
- Web Share API with copy-link fallback; share only the site URL.
- Data controls: Export (JSON) · Import · Delete everything.
- Disclaimer at the bottom.

## 10. Progress tracker (Progress tab)

- Log weight in kg with a date (default today), optional waist in cm.
- SVG line chart with raw points and a 7-day moving average, range toggle (4w / 12w / all). **Red marks the user's current value and target line; steel is used for axes, historical points and everything else.**
- Summary: change since start, average weekly change, number of check-ins.
- Gentle rules: losing > 1% body weight per week for 2+ weeks → suggest adding food; no change for 3+ weeks during fat loss → gentle suggestions; a change of 3 kg or more since the plan was made → prompt to update the plan.
- Weekly check-in nudge on return visits.
- No streak pressure, no red/green state colors, no shaming. Quiet line: "If food or weight is causing you stress, talking to a doctor or counsellor helps."

## 11. Learn (`/learn`, `/workouts`)

- Exercise schema: `name`, `otherNames`, `muscles[]`, `equipment`, `level`, `steps[]`, `cues[]`, `commonMistakes[]`, `easierVersion`, `harderVersion`, `relatedReel`, `media`, `draft`.
- At least 30 fundamentals marked `draft: true` (squat variations, hinge, lunges, glute bridge, push-up progressions, rows, overhead press, lat pulldown, plank variations).
- Filters by muscle, equipment and level in a tiny island.
- Workout templates: beginner home full-body (3 days), gym beginner full-body (3 days), upper/lower (4 days), walking plan. Sets × reps × rest table, progression rule.
- Guides: "How to find your step count", "Protein without shakes: Indian veg sources", "How to read a nutrition label".

## 12. Reels (`/reels`)

- Schema: `title`, `slug`, `instagramUrl`, `date`, `thumbnail`, `topics[]`, `summary`, `relatedArticle`, `relatedExercise`, `featured`.
- 9:16 grayscale grid, filterable by topic.
- Each reel gets a page with a written summary and key points, related content, and a CTA.
- Facade embed: thumbnail + play icon; load Instagram's embed only after a tap, only for that reel. Never load Instagram scripts on page load. Always offer "Watch on Instagram".

## 13. Articles and affiliate links (`/articles`)

- MDX frontmatter: `title`, `description`, `date`, `updated`, `tags[]`, `relatedReel`, `hasAffiliateLinks`, `draft`.
- Layout: title, dek, dates, reading time, table of contents, body at 68ch, author box, related reels/articles, CTA to the plan.
- MDX components: `<ProductCard>`, `<ComparisonTable>`, `<ReelEmbed>`, `<Callout>`, `<KeyTakeaways>`.
- `ProductCard`: no prices, "Check price" button.
- Affiliate links: `rel="sponsored nofollow noopener"`, `target="_blank"`, analytics event.
- Disclosure at the top, before the first link: "I earn a commission if you buy through these links, at no extra cost to you." Plus Amazon Associate line if used.
- Supplements: no disease or cure claims; encourage third-party lab testing and FSSAI licensing; food comes first.
- Seed article: "Top 5 supplement brands to consider in India" with placeholder product cards and no real brand claims.

## 14. Tools (`/tools/*`)

BMI (Asian cutoffs), calorie needs and protein calculators. Reuse the plan engine; explain the method; visible FAQ with FAQPage schema; CTA to the full plan.

## 15. `/links` (link-in-bio)

No header or nav; under 30 KB total. Wordmark, one-line bio, full-width stacked buttons (plan, latest reel article, my picks, exercise library, Instagram). Button order editable from one config file.

## 16. SEO

- Unique title ≤ 60 characters, meta description ≤ 155, canonical, OG and Twitter tags. Page title pattern: "{Page} · Eidolon".
- OG images generated at build time with a monochrome template (wordmark plus title in Archivo).
- JSON-LD: Person and WebSite on home; BlogPosting and BreadcrumbList on articles; FAQPage only where FAQs are visible. Never fake Review or Rating markup.
- Sitemap, `robots.txt`, RSS for articles, consistent trailing slashes, clean slugs. Stub routes are excluded from the sitemap.
- Rich internal linking between reels, articles, exercises, tools and the plan.
- Search intent examples: "PCOD diet plan vegetarian", "high protein South Indian breakfast", "Haryana vegetarian diet plan".

## 17. Performance budgets

- Mobile Lighthouse 95+ in all four categories on every page type.
- LCP < 2.0 s, CLS < 0.05, INP < 200 ms on a throttled mid-range Android profile.
- Zero JS on article, reel and learn pages, apart from analytics and the tap-to-load embed.
- Questionnaire and plan island under 80 KB gzipped. Food database loaded lazily.
- Images through `astro:assets` as AVIF/WebP with srcset and explicit dimensions, lazy unless above the fold.
- The 1080w AVIF hero is ≤ 180 KB.

## 18. Analytics

Self-hosted Umami (cookieless) at `stats.eidolon.cloud`. Events: `plan_start`, `plan_step` (index only), `plan_complete` (goal, region, dietType only), `follow_click` (location), `affiliate_click`, `reel_open`, `pdf_download`, `progress_log`. Never send health conditions, age, weight, medications or names.

## 19. Privacy, safety and legal

- All answers and logs stay in localStorage. Nothing is sent to a server. Say so on the intro screen, the plan page and the privacy page.
- DPDP Act 2023: health data is sensitive; v1 keeps no personal data on the server. Future accounts or email capture need explicit consent and deletion.
- Disclaimers: dedicated page plus short versions on the intro screen, plan page and footer.
- Numeric plans are 18+; younger users get guidance mode.
- Nginx security headers: strict CSP (Instagram domains only on pages with embeds), HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.

## 20. Accessibility

WCAG 2.2 AA. Visible focus (2px `--focus`, 3px offset), real form controls and labels, `aria-live` announcements, 44px touch targets, reduced-motion support, `lang="en-IN"`, logical heading order, alt text on every image. axe zero violations on every page type at 375, 768 and 1440.

## 21. Content workflow

- `pnpm new:reel` and `pnpm new:article` create files with frontmatter filled in.
- One products file for affiliate items reused across articles.
- README section "How to add a reel / article / product / exercise" with copy-paste steps.
- Anything marked `draft: true` is excluded from production builds.

## 22. Deployment (VPS)

Ubuntu LTS with Nginx serving static `dist/` from `/var/www/eidolon.cloud/current`. `scripts/deploy.sh` builds, rsyncs to `releases/<timestamp>`, does an atomic symlink swap, keeps 5 releases. `scripts/rollback.sh` goes back one. Certbot TLS with auto-renew, HTTP→HTTPS and www→apex redirects, Brotli/gzip, immutable hashed assets, no-cache HTML. Non-root deploy user, SSH keys only, UFW, fail2ban, unattended upgrades. Umami via Docker Compose at `stats.eidolon.cloud`. Deliverables: `deploy/nginx.conf`, `deploy/umami/docker-compose.yml`, `docs/DEPLOY.md`.

## 23. Phases and acceptance criteria

1. **Foundation:** Astro setup, tokens, fonts, base layout, header and footer, and every component on `/styleguide`.
2. **Phase 1.5:** real Eidolon config, FollowLink everywhere, no 404s (stubs + link checker), Obsidian/Ice/Red identity, kinetic band, blended hero photo, restyled styleguide, 404 and stubs, screenshots.
3. **Engine and food database:** safety gates, 220+ foods, `food-review.csv`, and 40+ passing tests.
4. **Questionnaire and plan page:** full flow with autosave, swap/shuffle, groceries, PDF, related reels and follow CTA. Playwright personas: veg male from Haryana; non-veg female from Kerala with PCOS; Jain from Gujarat; a teen; a pregnant user; hostel mode.
5. **Progress tracker:** logging, chart, gentle rules, export/import/delete.
6. **Content system:** reels, articles and affiliate components; learn, workouts, tools and `/links`; scaffolding scripts and seed content.
7. **Polish:** home, about and legal pages, SEO, analytics, performance and accessibility pass.
8. **Deployment:** configs, scripts and DEPLOY.md.

Before reporting any UI phase as done, review screenshots against §3.8 and §3.9 and fix every violation.

## 24. Real values

| Key           | Value                                        |
| ------------- | -------------------------------------------- |
| Brand         | Eidolon                                      |
| Creator       | Hitesh Dhayal                                |
| Instagram     | @hiteshdhayal                                |
| Domain        | eidolon.cloud                                |
| Site URL      | https://eidolon.cloud                        |
| Credentials   | empty for now                                |
| Contact email | empty for now (footer links to Instagram DM) |

All config lives in `src/config/site.ts`. Empty values hide their UI. The build fails if `{{` appears in any built HTML.

## 25. Later (do not build now)

- Hindi version (IBM Plex Sans Devanagari and hreflang tags)
- Optional accounts with plan delivery by email or WhatsApp (with consent)
- Dark mode
- A server-side AI Q&A assistant
