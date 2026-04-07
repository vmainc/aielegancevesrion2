/** Text after the "Three-act thematic breakdown" heading (Script Wizard + project import). */
export function extractThreeActBreakdownFromTreatment (treatment: string): string {
  if (!treatment) return ''
  const m = treatment.match(/Three-act thematic breakdown\s*\n([\s\S]*)$/i)
  return m ? m[1]!.trim() : ''
}
