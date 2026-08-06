/** Route gating for the floating Guide companion (mode C). */

const PB_ID = /^[a-z0-9]{15}$/

export type GuideCompanionMode =
  | { kind: 'hidden' }
  | { kind: 'studio' }
  | { kind: 'project'; projectId: string }

const AUTH_OR_MARKETING =
  /^\/(login|signup|forgot-password|reset-password)?\/?$/

/**
 * Resolve companion mode from a path (no query/hash).
 * Project open = URL includes a PocketBase project id (not a remembered last project).
 */
export function resolveGuideCompanionMode (path: string): GuideCompanionMode {
  const raw = (path || '/').split('?')[0].split('#')[0] || '/'
  const normalized = raw.length > 1 && raw.endsWith('/') ? raw.slice(0, -1) : raw

  if (normalized === '/' || AUTH_OR_MARKETING.test(normalized)) {
    return { kind: 'hidden' }
  }

  if (normalized === '/guide') {
    return { kind: 'hidden' }
  }

  const projectGuide = normalized.match(/^\/projects\/([a-z0-9]{15})\/guide$/)
  if (projectGuide) {
    return { kind: 'hidden' }
  }

  const projectMatch = normalized.match(/^\/projects\/([a-z0-9]{15})(?:\/|$)/)
  if (projectMatch && PB_ID.test(projectMatch[1])) {
    return { kind: 'project', projectId: projectMatch[1] }
  }

  return { kind: 'studio' }
}

export function isGuideCompanionVisible (mode: GuideCompanionMode): boolean {
  return mode.kind !== 'hidden'
}
