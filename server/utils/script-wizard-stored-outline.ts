import { parsePlainScriptText } from '~/server/utils/parse-script-txt'

/** Build scene outline + character names from stored `creative_scripts.script_text` (unified join format). */
export function sceneOutlineAndCharactersFromScriptText (scriptText: string): {
  sceneOutline: string
  characterNames: string[]
} {
  const parsed = parsePlainScriptText(scriptText)
  const scenes = parsed.scenes.length
    ? parsed.scenes
    : [{ heading: 'Draft', body: scriptText.trim().slice(0, 100_000) }]
  const sceneOutline = scenes
    .map((s, i) => `## Scene ${i}\nHeading: ${s.heading}\n---\n${s.body.slice(0, 2000)}`)
    .join('\n\n')
  return { sceneOutline, characterNames: parsed.characterNames }
}
