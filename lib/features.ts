/**
 * Frontend feature flags.
 *
 * These are inlined at build time (NEXT_PUBLIC_ prefix), so changing the value
 * requires a rebuild/redeploy — not just a runtime env change.
 */

/**
 * Hədəflər (Goals) — MVP-dən gizlədilib. Backend, DB (V46) və API olduğu kimi
 * qalır; yalnız frontend UI flag arxasındadır. Env-də dəyişən yoxdursa `false`
 * (default = gizli). V2-də açmaq üçün `NEXT_PUBLIC_FEATURE_GOALS=true`.
 */
export const FEATURE_GOALS = process.env.NEXT_PUBLIC_FEATURE_GOALS === "true";
