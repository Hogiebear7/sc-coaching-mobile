# App v2 design system (sc-coaching-mobile)

October 2026. This covers how the app looks and behaves after the App v2 overhaul (branch
`redesign/app-dashboard-prototype`). The research behind it is in
`design-inspiration-macrofactor-2026-10.md`. The website (gym-app) has its own
DESIGN.md; the app now deliberately differs from it in geometry (rounded app, square web).

## Rules

1. **Chrome is monochrome; colour is data.** Actions are solid pills in the primary ink:
   white on dark, navy on light. Gold is the brand mark only (the active-tab dot, badges,
   personal-best celebrations). Each metric has one hue, used wherever it appears.
2. **Soft geometry.** Cards are 16dp and borderless; elevation comes from a surface step,
   never from shadows or outlines. Controls are pills; icon buttons are 48dp circles.
   The gutter is 16dp, the gap 10dp and the section spacing 28dp.
3. **Type.** Each screen gets one Teko title (`appTitle`). Section titles are 17–21pt
   sentence case. Values use the platform sans with a separately styled unit, in tabular
   numbers. Nothing is smaller than 12pt; body text is 15–16pt.
4. **Every number explains itself.** A tile opens a chart detail with an explainer, and
   goal and readiness numbers come with a sentence saying what they mean.

## Tokens (`src/constants/theme.ts`)

| Layer | Use |
|---|---|
| `DarkPalette` / `LightPalette` (`AppPalette`) | App v2 chrome: bg, surface, surfaceHi, control, hairline, text ×3, primary/onPrimary, brand, danger/success/warning, scrim |
| `DataColor` / `DataColorLight` (`DataPalette`) | One hue per metric (readiness bands, load, sleep, sessions, weight, hydration, macros); the light set is darkened for contrast on white |
| `Color` / `ColorLight` (`LegacyPalette`) | The original token names used by older screens. The gold* slots now hold primary-ink values; real gold is `brand` |
| `LiveColor` | The legacy palette for the current theme, for module-level helpers only |

## Theme (`src/lib/theme.tsx`)

- `ThemeProvider` resolves System, Light or Dark (stored as `sc.themePreference`). The
  default is **dark**; members opt in to light in Settings → Preferences → Appearance.
- New code: `const useStyles = makeStyles((c, dc, legacy) => StyleSheet.create({...}))`
  plus `const { colors, data } = useAppTheme()`.
- Older screens were converted by a codemod to `makeLegacyStyles((Color) => ...)` and
  `const Color = useLegacyColors()`, so their stylesheet bodies are unchanged but follow
  the theme.

## Components

- `components/app/primitives.tsx`: SectionTitle, RoundIconButton, PillButton,
  MetricTile, TileGrid, WeekStrip, RangePills.
- `components/app/ChartDetail.tsx`: the shared metric screen. It has stats, a bar or line
  chart with a right-hand axis, range pills, a legend, an explainer and entries. Line
  charts add a smoothed trend (`lib/chart-math.ts`).
- `components/app/QuickActionSheet.tsx`: the "+" sheet. It navigates only after the
  sheet has closed (the Android competing-transitions rule).
- `components/ui/*`: the restyled shared components (Card, Button, Segmented,
  SectionHeader, StatCard, TextField, EmptyState, ProgressBar, DateStrip, ThemePicker,
  GoalTimelineCard).

## Haptics (`src/lib/haptics.ts`)

| Call | Job |
|---|---|
| `tapFeedback` | buttons, rows, opening things |
| `selectionFeedback` | tabs, segmented controls and range pills, pickers |
| `impactFeedback` | the "+" button, starting a workout |
| `successFeedback` | a set, check-in, meal or water saved |
| `celebrateFeedback` | personal best |
| `warningFeedback` | destructive actions (remove or delete) |
| `errorFeedback` | a save failed |

There is a member switch in Settings → Preferences → Vibration (stored as `sc.hapticsEnabled`).

## Navigation

The tab bar depends on the member's tier (`lib/tab-config.ts`, tested):
- Gym members: Home · Schedule · + · Train · More.
- App-only and free members: Home · Train · + · Nutrition · More.

Routes outside the bar stay registered (`href: null`).

## Screens rebuilt in full

Home, More, Train, Schedule, Recovery, Nutrition, Readiness, Weight trend, Sleep, and the
goal timeline (Profile).

## Screens changed by global passes only

Every other screen: theme colours, monochrome accents, softer radii, minimum text sizes,
sentence-case section labels and standard headers. These are the candidates for Phase 3
screen-by-screen work, in this order: log-workout, log-food, session-detail and
exercise-detail, profile, settings, messages, community, membership, auth, staff.

## Shared workout pieces

- **ExercisePreviewList** (`components/ui`): the exercise rows inside any workout card
  (History, Workouts tab, Community activity and workout detail). Each row is a muscle icon
  in a round chip, the exercise name, and one summary line from `exerciseSetSummary`
  ("4 sets · 15 kg × 20", or "first → last" when sets progress). Never print every set in
  a list card.
- **Session detail set table**: identical consecutive sets collapse into one row
  ("Sets 1–4 · 15 kg × 20") via `groupSetLabels`.
- **LikeButton** (`components/app`): the only place the like red (`LIKE_RED`) is used. Liking
  pops the heart and bursts a ring and dots; unliking just settles. The animation is skipped
  when Reduce motion is on. Likes update optimistically.
- **Bottom sheets** for short tasks over a list (comments): top radius 24, grab handle,
  44dp round close and send buttons, safe-area bottom padding.
- **Trend entries** show the latest five, with Show all / Show fewer.
