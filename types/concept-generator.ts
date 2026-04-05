/** One model’s structured concept (success). */
export interface GeneratedConceptItem {
  model: string
  title: string
  logline: string
  summary: string
  tone: string
  genre: string
}

/** Per-model outcome: either fields or an error message. */
export type ConceptGeneratorResultItem =
  | (GeneratedConceptItem & { error?: undefined })
  | { model: string; error: string; title?: never; logline?: never; summary?: never; tone?: never; genre?: never }
