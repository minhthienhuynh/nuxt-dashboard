// Defaults for the plan-comparison filter bar.
//
// Kept in its own module so PlanComparisonFilterBar (a purely presentational
// component) can share the exact same values as the composable's refs without
// importing the composable — and therefore the whole static dataset — itself.
// Change a default here and both the initial state and the "field cleared"
// fallback follow automatically.

/** "Hide old models" cutoff: a model is hidden when `release_date < this date`. */
export const DEFAULT_OLD_BEFORE = '2026-08-14'

/** "Hide low AA" threshold: a model is hidden when `aa < this value`. */
export const DEFAULT_AA_THRESHOLD = 30
