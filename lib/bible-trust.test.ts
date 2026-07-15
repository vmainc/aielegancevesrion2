import { describe, expect, it } from 'vitest'
import {
  isBibleEntityTrustedForContext,
  isBibleFactPendingReview,
  isBibleFactTrustedForContext,
  isBibleRelationshipTrustedForContext,
  isExcludedBibleStatus
} from '../lib/bible-trust'

describe('bible-trust', () => {
  it('excludes retired and contradicted statuses', () => {
    expect(isExcludedBibleStatus('retired')).toBe(true)
    expect(isExcludedBibleStatus('contradicted')).toBe(true)
    expect(isExcludedBibleStatus('active')).toBe(false)
  })

  it('flags pending-review fact statuses', () => {
    expect(isBibleFactPendingReview('needs_review')).toBe(true)
    expect(isBibleFactPendingReview('draft')).toBe(true)
    expect(isBibleFactPendingReview('active')).toBe(false)
  })

  it('trusts active and tentative facts for context by default', () => {
    expect(isBibleFactTrustedForContext({ status: 'active' })).toBe(true)
    expect(isBibleFactTrustedForContext({ status: 'tentative' })).toBe(true)
    expect(isBibleFactTrustedForContext({ status: 'needs_review' })).toBe(false)
    expect(isBibleFactTrustedForContext({ status: 'retired' })).toBe(false)
  })

  it('never includes review facts even when includeReviewFacts is true', () => {
    expect(isBibleFactTrustedForContext({ status: 'needs_review' }, { includeReviewFacts: true })).toBe(false)
  })

  it('trusts entities except draft and excluded statuses', () => {
    expect(isBibleEntityTrustedForContext({ status: 'active' })).toBe(true)
    expect(isBibleEntityTrustedForContext({ status: 'draft' })).toBe(false)
    expect(isBibleEntityTrustedForContext({ status: 'retired' })).toBe(false)
  })

  it('trusts relationships when not excluded', () => {
    expect(isBibleRelationshipTrustedForContext({ status: 'active' })).toBe(true)
    expect(isBibleRelationshipTrustedForContext({ status: 'contradicted' })).toBe(false)
  })
})
