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

---

## 7. MacroFactor Workouts app (added 25 Oct 2026)

Source: screens captured over adb on 25 Oct 2026, covering onboarding with
throwaway answers, then (after you logged in and accepted their terms
yourself) the Dashboard, Workout, "+" Shortcuts, Levels, More, a workout
preview and the in-workout logger. A test workout was started and then
**discarded without saving**. Their muscle-map art, exercise photos and
icons are theirs. Draw our own if we use the ideas.

### Structure

- **The same system as the nutrition app.** Tabs are Dashboard · Workout ·
  + · Levels · More, with uppercase wide page titles, round icon buttons,
  white pill CTAs, 16dp cards and option cards with a radio button on the
  right. The sameness across both apps is the brand.
- **Onboarding:** Basics → Gym & Equipment (gym type, nickname, an
  editable equipment list) → Program. The Program step asks for goal,
  sessions per week (stepper), split, session length (20–120 min), how rep
  ranges progress, more/less focus per muscle (thumbs down/up next to a
  muscle thumbnail), deload yes/no, quick strength checks ("5 strict
  pull-ups?"), name and colour. Then a "Generating your program" checklist
  ticks off each factor (experience → muscle priority → equipment →
  exercise selection → … → smart progression). A "First 30 days" timeline
  closes the flow (week 1 baseline, week 2 personalised loads, week 3+
  optimised).

### Screens worth borrowing from

1. **Dashboard "Weekly Workouts":** three rings (Muscles, Sets, Exercises),
   each showing "0 / 17 left" against a weekly target, plus an Active
   Program / All Workouts toggle. Below that come insight tiles (Workouts,
   Weight Trend) and Habits (weigh-in and workout streaks). **For S&C:** a
   weekly ring row on Train: sessions done / planned, sets, check-ins.
2. **Workout tab = the week as a list.** A date-capsule strip sits at the
   top (same as our WeekStrip). The "Active Program · Week 1" card holds
   each day in order: name, list of exercises, muscle chips and a
   done-checkbox, with "Rest Day" as its own row. **For S&C:** this is
   exactly how a coach-assigned week should read on Train and Schedule.
3. **Workout preview before starting.** "Target Muscles" cards (muscle
   thumbnail, number of exercises, number of sets), "4 Exercises ·
   Estimated workout time is 22 min", then exercise rows (photo, name,
   numbered sets with rep targets and a coloured RIR badge, muscle chips),
   with a full-width white **Start Workout** button. **For S&C:** a
   pre-session screen for coach workouts, including estimated time.
4. **In-workout logger.**
   - Header: elapsed timer, rest timer and a progress bar.
   - A horizontal strip of exercise thumbnails (current one underlined,
     "+" to add).
   - The exercise name with "Set 1 of 2".
   - A pill toolbar: Info, Warm Up, Targets, Swap.
   - Set table: Set number, Target ("7–9 reps / 2 RIR"), weight and reps
     fields, and a checkbox. The coloured RIR badge sits on the reps
     field.
   - "+" adds a set.

   **For S&C:** our log-workout screen should move to this
   target-next-to-input table and the thumbnail strip. Mind the crash
   rules in memory: no stacked modal and navigation transitions.
5. **Effort scale:** RIR 0–6+ as coloured dots (red 0–1, amber 2–3, green
   4–5, blue 6+), explained once in onboarding and then used as small
   badges everywhere. Map it to our existing RPE/effort field rather than
   adding a new metric.
6. **Workout options sheet:** Pause, Minimize, Finish, Workout settings,
   Gym settings, then Discard, with a confirm dialog ("Your progress will
   be lost…", Discard / Go Back).
7. **Levels:** a full-body muscle map tinted by average weekly sets (1-week
   range dropdown, front/back flip). The empty state still shows the grey
   body with "Complete workouts to see your Set Levels", then per-region
   lists (Chest 0 sets…). **For S&C:** a later "muscle coverage" view built
   from logged sessions. It needs our own SVG body map.
8. **"+" Shortcuts sheet:** a row of round quick actions (Weight, Photos,
   Metrics, History), an "Up Next • Upper" card, then Empty Workout / New
   Program / New Workout rows. This confirms our QuickActionSheet layout.
   Adding an "Up next" card for the next coach session is a cheap win.
9. **Theme picker (relevant to our light mode):** three visual cards, each
   a mini mock-up of the app in that theme with sample text and the data
   colour dots: **System** (split light and dark), **Light**, **Dark**.
   Use this exact three-card pattern in our Settings.
10. **More:** the profile header, then grouped lists (General, Feature
    Settings with Dashboard / Workout / Shortcuts / Weight Trend /
    Exercises / Gym Profiles, Theme, Data Management with Export /
    Visibility / Account deletion). Feature settings let users customise
    the dashboard and shortcuts, which supports the editable tab bar and
    home idea in Phase 4.

### Avoid

- Self-built programs as the default. S&C members are coached, so the
  coach's plan comes first. A self-built flow is only for app-only members,
  if ever.
- Copying their muscle-map illustrations or exercise photography.

---

## 8. Artwork inventory, for later inspiration (added 25 Oct 2026)

These are notes on the *kinds* of artwork both MacroFactor apps use, so we
can commission or draw our own in the S&C style later. Do not copy, trace
or extract any of these assets.

| Artwork | Where it appears | Style | S&C idea |
|---|---|---|---|
| **Flat food illustrations** | Nutrition: food log favourites and recents, quick-add chips | Small (~32dp) full-colour flat icons, one per food type (tomato, cherries, burger, egg, pasta), no outlines | A small set of our own food-group icons (protein, carbs, veg, fruit, dairy, drinks, snacks) in our data colours. We already have `food-icons.ts` as a fallback tier |
| **Body-fat silhouettes** | Nutrition onboarding (3×3 grid, 3–4% up to 40%+) | Flat grey torsos with simple darker line work for muscle definition, a selected state with a white border and a check chip | Only if we add a body-fat question. Simple neutral silhouettes in navy tones, both sexes |
| **Muscle-map body (front and back)** | Workouts: workout-complete hero, Levels tab, muscle-focus rows, target-muscle cards | Flat grey segmented anatomy with highlighted muscles in a single blue, plus small cropped thumbnails per muscle | We already have `BodyDiagram`, `MuscleMap` and `MuscleSetLevels`. Restyle them to a single highlight hue and add cropped per-muscle thumbnails |
| **Exercise photos** | Workouts: preview rows, logger thumbnail strip | Real photos of one model on a light-grey studio backdrop, the same framing for every exercise | Our own consistent exercise shots or short loops, filmed in the S&C gym against one plain wall |
| **Monochrome glyph icons** | Both: option cards (sex, activity, diet type, training type, protein level, gym type), More lists, shortcuts | Solid white glyphs, ~28dp, chunky and friendly, one per option | A consistent solid icon set. Ionicons filled covers most; commission a few sport-specific ones (sled, kettlebell, rower) |
| **Coloured data blocks** | Nutrition: the 7-day macro column chart and pills | Rounded colour blocks with the value inside (blue kcal, coral P, yellow F, green C) | Our weekly plan view: one block per day, coloured by session type |
| **Planet/orbit animation** | Nutrition: "building your program" moment | Three coloured planets on thin orbit rings, in the data colours | A short, branded loading moment: rings in our readiness colours, under ~1.5s |
| **Phone mock-ups** | Both: feature tour carousels | A real screen inside a thin device frame, under a huge wide-caps headline | Our App Store screenshots and the first-run tour |
| **Achievement chips** | Workouts: PR cards (trophy and star badge icons) | Outlined cards with an icon, value, "New!" tag and record type | PB cards in workout summary. Gold is fine here as a celebration colour |
| **Wordmark** | Both: wide geometric caps (MF monogram) | Custom wide display face for titles | We keep Teko and our own mark. Their wide-caps titling is the reason the screens feel branded |
