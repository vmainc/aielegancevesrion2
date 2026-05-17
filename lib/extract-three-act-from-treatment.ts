/** Text after the "Three-act thematic breakdown" heading (Script Wizard + project import). */
export function extractThreeActBreakdownFromTreatment (treatment: string): string {
  if (!treatment) return ''
  const m = treatment.match(/Three-act thematic breakdown\s*\n([\s\S]*)$/i)
  if (!m) return ''

  // Hide placeholder-only sections so UI shows a clear "run again" hint instead.
  const cleaned = m[1]!
    .replace(/\(No details returned\.\)/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const substantive = cleaned
    .replace(/\bAct\s*(I|II|III)\b:?/gi, '')
    .replace(/\bTheme arc\b:?/gi, '')
    .replace(/[^\w]+/g, '')
    .trim()

  return substantive ? cleaned : ''
}
