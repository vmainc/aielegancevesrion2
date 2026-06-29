#!/usr/bin/env node
/**
 * PASS 15 — Production Bible trust matrix smoke tests.
 * Mirrors lib/bible-trust.ts rules; keep in sync when trust logic changes.
 * Run: node scripts/verify-bible-trust-matrix.mjs
 */

const EXCLUDED = ['retired', 'contradicted']
const FACT_PENDING = ['draft', 'needs_review']
const TRUSTED = ['active', 'tentative']

const checks = []

function assert (name, ok) {
  checks.push({ name, ok })
}

function isExcluded (status) {
  return EXCLUDED.includes(status)
}

function factTrusted (status, includeReview = false) {
  if (isExcluded(status)) return false
  if (!includeReview && FACT_PENDING.includes(status)) return false
  return TRUSTED.includes(status)
}

function entityTrusted (status) {
  if (isExcluded(status)) return false
  if (status === 'draft') return false
  return TRUSTED.includes(status)
}

function relationshipTrusted (status) {
  if (isExcluded(status)) return false
  return TRUSTED.includes(status)
}

// Facts
assert('active fact is trusted', factTrusted('active'))
assert('tentative fact is trusted', factTrusted('tentative'))
assert('needs_review fact excluded by default', !factTrusted('needs_review'))
assert('draft fact excluded by default', !factTrusted('draft'))
assert('retired fact excluded', !factTrusted('retired'))
assert('contradicted fact excluded', !factTrusted('contradicted'))
assert('needs_review fact never in prompt context', !factTrusted('needs_review', true))
assert('seeded facts default needs_review excluded', !factTrusted('needs_review'))

// Entities
assert('active entity is trusted', entityTrusted('active'))
assert('tentative entity is trusted', entityTrusted('tentative'))
assert('draft entity excluded', !entityTrusted('draft'))
assert('retired entity excluded', !entityTrusted('retired'))
assert('contradicted entity excluded', !entityTrusted('contradicted'))

// Relationships
assert('active relationship is trusted', relationshipTrusted('active'))
assert('tentative relationship is trusted', relationshipTrusted('tentative'))
assert('retired relationship excluded', !relationshipTrusted('retired'))
assert('contradicted relationship excluded', !relationshipTrusted('contradicted'))

let failed = 0
for (const c of checks) {
  const mark = c.ok ? '✓' : '✗'
  if (!c.ok) failed++
  console.log(`${mark} ${c.name}`)
}

console.log(`\n${checks.length} trust checks, ${failed} failed`)
process.exit(failed ? 1 : 0)
