/**
 * Format concept fields for `conceptNotes` when user picks a generated concept.
 */
export function formatStoredConceptNotes (input: {
  title: string
  logline: string
  modelId: string
  modelLabel: string
}): string {
  const { title, logline, modelId, modelLabel } = input
  return `**Title:** ${title}

**Logline:** ${logline}

**Source model:** ${modelLabel} (\`${modelId}\`)

---

`
}
