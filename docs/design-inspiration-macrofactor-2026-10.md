# Design inspiration: MacroFactor (nutrition app) vs S&C mobile

October 2026. Research from screens captured on a phone (Xiaomi 18 Pro Max,
412 × 875 dp) via adb: screenshots plus the on-screen accessibility tree for
sizes. MacroFactor was only *looked at*: no app files, code, assets or
layouts were extracted, and nothing in this brief should copy its brand,
icons, fonts or exact layouts. The goal is to borrow principles and adapt them
to the S&C navy/gold identity.

Screens captured: MacroFactor Dashboard (top, carousel, scrolled), Food Log,
Strategy, Steps and Weight Trend chart details, More, "+" Shortcuts sheet;
S&C Home, Workouts, Nutrition.

---

## 1. What makes MacroFactor feel premium

**Colour has two jobs, never mixed.**
- Chrome (backgrounds, cards, buttons, nav) is near-monochrome: near-black
  page, charcoal cards one tone lighter, charcoal 48dp circular icon buttons.
- The primary action is *white* (inverted): the selected pill segment, the
  centre "+" button. No brand colour on buttons at all.
- Colour appears **only on data**, and each metric owns one hue everywhere:
  protein salmon, fat yellow, carbs green, calories blue, weight purple,
  expenditure rust. The colour tells you what you are looking at.

**Typography: one loud face, used once per screen.**
- A wide geometric display face only for the screen title ("DASHBOARD",
  "TODAY", "STRATEGY", "MORE") and the single hero number ("8 DAYS").
- Everything else is one sans: section titles ~22dp semibold, sentence case
  ("Insights & Analytics", "Body Metrics"); card titles ~17dp; values
  ~24dp regular with a small unit ("80.3 kg"). Almost no caps labels.

**Geometry is soft and consistent.**
- Cards ~16dp radius, borderless (tone, not lines, separates them).
- Every control is a full pill or circle: segmented toggles, time chips,
  date capsules, search bar, 48dp icon buttons.
- 16dp outer gutter; two-up card grid (180 × 155dp, 10dp gap).

**Uniform card anatomy = calm, scannable dashboard.**
Every insight card: title → time window ("Last 7 Days") → mini chart →
hairline → big value + unit + chevron. Cards are grouped under sentence-case
headings (Habits, Body Metrics, Nutrition, General) with "See All".

**Navigation built around logging.**
- 5 slots with a raised white "+" in the centre that opens a Shortcuts sheet
  (4 round quick actions + list: Recipes, Quick Add, Photos, Metrics).
- A persistent "Search for a food" bar (with barcode + AI buttons) floats
  above the tab bar on the main screens.

**One chart-detail template for every metric.**
Summary stats top-left (Average, Difference, date range) → full-width chart
with dashed gridlines and right-hand axis → pill range selector
(1W 1M 3M 6M 1Y All) + granularity dropdown → legend card → a tinted
"What is …?" explainer card in the metric's own hue.

**Distinctive data shapes.**
- Weekly nutrition as a 7 × 4 grid of bars (days × macros), today outlined.
- The plan ("Coached Program") as stacked colour blocks per day.
- Food log as an hourly timeline with a time pill + "+" per hour.
- Empty data still shows its *shape* (empty bars, flat axes), not an empty-
  state card.

## 2. Where S&C mobile differs today

| | MacroFactor | S&C now |
|---|---|---|
| Accent use | White actions, colour only on data | Gold on buttons, labels, dates, tab, figures |
| Buttons | Flat white/charcoal pills | Gradient gold pills with border |
| Cards | Borderless tonal, 16dp | Bordered, small radius |
| Display type | Screen title + 1 hero number | Teko on titles, greetings, figures, values |
| Home | Uniform metric grid | Two large centred empty-state cards + 3 tiles |
| Empty data | Shows the chart shape | Icon + paragraph + big button |
| Nutrition viz | Bars / grid per macro | Pie chart + list |
| Logging | Centre "+" sheet, global search | Per-screen buttons ("+ Log") |
| Charts | One template, range pills | Varied per screen |

Net effect: S&C reads as *branded marketing cards*; MacroFactor reads as an
*instrument*. That is the radical difference to close.

## 3. Proposed direction for S&C (adapted, not copied)

1. **Split chrome from data.**
   - Chrome: navy-black page, two tonal navy surfaces, white primary actions,
     charcoal-navy secondary pills and 48dp round icon buttons.
   - Gold becomes the *brand mark* only: logo, active tab, streak/PB
     celebration. Not buttons.
   - Data palette (one hue per metric, everywhere): Readiness = green→amber
     scale, Training load = blue, Sleep = indigo, Protein / Carbs / Fat = three
     distinct hues, Weight = violet, Hydration = cyan.
2. **Teko only for the screen title and one hero figure per screen.**
   Section titles in Inter semibold sentence case; values in Inter with small
   units. Drop most CAPS labels.
3. **Home becomes a metric dashboard.**
   - Top: a 7-day strip (each day a small column showing trained / readiness).
   - Then grouped two-up tiles with identical anatomy: Readiness, 7-day load,
     Sleep, Sessions, Weight, Protein, Hydration, Next class.
   - Each tile opens the shared chart-detail template.
4. **Centre "+" action.** Bottom bar: Home · Schedule · ( + ) · Train · More.
   "+" opens a sheet: Log workout, Daily check-in, Log meal, Add water,
   Weigh-in. Recovery and Nutrition move under Home tiles / More (or keep
   Nutrition as a tab and fold Schedule into Home — decision below).
5. **One chart-detail screen** used by every metric: summary stats, full-width
   chart, range pills, legend, explainer card tinted in the metric hue.
6. **Empty states show the shape** (empty bars/axes + one line + small pill
   button) instead of large centred cards.
7. **Soft geometry:** 16dp cards without borders, pill controls, round icon
   buttons, 16dp gutters, 10–12dp gaps.

## 4. Decisions for you

- **Tabs:** (a) Home · Schedule · + · Train · More, or (b) Home · Train · + ·
  Fuel · More with Schedule inside Home.
- **Gold:** brand mark only (recommended), or keep gold for the primary action.
- **Website consistency:** this moves the app away from the website's square
  3–4px geometry; DESIGN.md would need an "app" exception (rounded app,
  square web) or the web member area should follow.

## 5. Suggested next step

Prototype on a branch in `sc-coaching-mobile`: new tokens + Home dashboard +
"+" sheet + one chart-detail screen (Readiness), built as a preview APK and
installed on your phone to judge at real size before touching other screens.

---

## 6. Onboarding and goal setup (added 25 Oct 2026)

Source: about 50 screenshots you took yourself of MacroFactor's full
onboarding (Basics → Goal → Program → feature tour → plan picker → first
30 days → health disclaimer). As above, these are principles only. Don't
copy their wording, icons, body-fat illustrations, testimonials or
"MFers"-style brand voice.

### Patterns worth adopting

1. **One question per screen.** The section name ("Basics") sits in the
   header with a thin progress bar under it. The question is a large bold
   heading, and a full-width white primary button is fixed to the bottom.
   The button stays disabled until there's an answer, unless a sensible
   default is preselected.
2. **Option cards.** Icon on the left, then a label with an optional
   one-line explanation, and a radio button on the right. A selected card
   gets a 2dp white border. A day-of-week checklist uses plain rows with
   checkboxes.
3. **Inputs you handle, not type.** Scroll wheels for date of birth and
   height, a horizontal ruler for weight (with a kg/lb switch), and a
   slider for rate. Values update live.
4. **"Why we ask" card.** A tinted info card sits under sensitive
   questions.
5. **A three-step overview between sections.** A vertical stepper (✓
   Basics · 2 Goal · 3 Program) with a single "Go to …" button makes the
   flow feel short and finite.
6. **Live consequence tiles (the key pattern for our goal timeline).**
   Two tiles at the top (daily budget and projected end date) update as
   you drag the target and the rate. Slower, Standard and Faster presets
   sit over a slider. The rate can be edited both as kg and as % of body
   weight, per week and per month.
7. **An honest summary.** Each summary card has a header row with a label
   and a value, and a plain-English paragraph below it. The end date is
   explicitly called *optimistic*, with advice to allow a few extra weeks.
8. **Guardrails as a visible choice.** "Standard" versus "Low (proceed
   with caution)", with a warning icon.
9. **The result is shown, then explained.** "Your plan is ready" shows a
   7-day stacked column chart. Under it, "How was your plan designed?"
   gives a numbered timeline: each step has a coloured value and one
   sentence. This is the strongest trust pattern in the flow.
10. **Set expectations.** A "First 30 days" timeline (day 1, day 3, next
    Monday, day 30) tells new users when the app gets smarter.
11. **Consent screen.** Plain-language health disclaimer and privacy
    summary. A separate toggle for each document, and "Accept and
    Continue" stays disabled until both are on.

### Patterns to avoid or adapt

- **Body-fat photo grid:** their artwork. If we ask at all, use a plain
  range picker.
- **Testimonials:** use only real member quotes, with permission. Never
  invent them.
- **Calculating animation:** fine once, under about 1.5s, and skip it when
  reduced motion is on.
- **Paywall:** not relevant to members on a gym membership. Any digital
  plan picker must follow the existing IAP rules and the store's own
  wording.

### What this means for S&C

| S&C surface | Borrow |
|---|---|
| Post-signup setup (`PostSignupSetupModal`) | Patterns 1–5: becomes a short stepped flow (About you → Your goal → Your week) instead of one modal |
| Goal timeline (Profile) | Patterns 6–7 and 9: live end-date and sessions-per-week tiles, rate presets, an honest summary, then "How your plan was built" |
| Training days | Pattern 2's checklist: pick training days, which feeds Schedule |
| Readiness / coach plan explainers | Pattern 9: a numbered "how this was worked out" timeline |
| First run | Pattern 10: "Your first 2 weeks" (first check-in, first coach review, trend unlocks after 2 points) |
| Consent | Pattern 11: only if legal review wants explicit health-data consent; check against the existing privacy and terms flow first |
| Weight chart | Smoothed trend line over raw weigh-ins, plus Average and Difference figures (already in the chart-detail template) |

Planned for **Phase 2** alongside the goal timeline redesign. None of this
is built yet.
