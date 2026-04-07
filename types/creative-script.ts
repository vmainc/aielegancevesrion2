export type CreativeScriptStatus = 'draft' | 'in_progress' | 'final'

export interface CreativeScript {
  id: string
  title: string
  status: CreativeScriptStatus
  sourceFilename: string
  scriptText: string
  synopsis: string
  treatment: string
  genre: string
  tone: string
  themes: string[]
  comparableTitles: Array<{ title: string; year?: string }>
  created: string
  updated: string
}

