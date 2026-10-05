// Stub for the `server-only` package in the Vitest environment.
//
// `server-only` relies on Next.js's bundler picking a different export
// condition for Server vs Client components; outside that bundler (i.e. in
// plain Vitest/Node) it always resolves to the variant that throws. Since
// tests here run modules that are genuinely server-only (e.g. lib/questions.ts)
// in a plain Node test environment, we alias the real package to this no-op
// (see vitest.config.ts `resolve.alias`).
export {};
