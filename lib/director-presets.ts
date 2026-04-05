import type { ProjectDirector } from '~/types/creative-project'

export interface DirectorPreset extends ProjectDirector {
  id: string
  label: string
}

export const DIRECTOR_PRESETS: DirectorPreset[] = [
  {
    id: 'custom',
    label: 'Custom (manual)',
    name: '',
    style: '',
    tone: '',
    camera_preferences: '',
    lighting_style: '',
    pacing: ''
  },
  {
    id: 'classic-scope',
    label: 'Classic scope drama',
    name: 'Classic drama',
    style: 'Theatrical blocking, motivated coverage, restrained cutting',
    tone: 'Grounded, emotional, humanist',
    camera_preferences: '35–50mm for intimacy, slow dolly and gentle handheld for tension',
    lighting_style: 'Soft key, practical motivation, naturalistic contrast',
    pacing: 'Measured; linger on performance'
  },
  {
    id: 'noir',
    label: 'Neo-noir',
    name: 'Noir',
    style: 'High contrast, shadows, urban isolation',
    tone: 'Cynical, tense, moody',
    camera_preferences: 'Low angles, wide for alleys, longer lenses for paranoia',
    lighting_style: 'Hard sidelight, venetian blinds, pools of darkness',
    pacing: 'Deliberate; silence as beat'
  },
  {
    id: 'documentary',
    label: 'Docu vérité',
    name: 'Documentary',
    style: 'Observational, imperfect framing OK',
    tone: 'Authentic, intimate, unpolished truth',
    camera_preferences: 'Handheld, zoom snaps, medium-wide following action',
    lighting_style: 'Available light, high ISO grit acceptable',
    pacing: 'Reactive, breath of real time'
  },
  {
    id: 'commercial-polish',
    label: 'Commercial polish',
    name: 'Commercial',
    style: 'Clean hero frames, product-readable, premium finish',
    tone: 'Confident, upbeat, aspirational',
    camera_preferences: 'Stable gimbal, macro inserts, crisp focus pulls',
    lighting_style: 'High-key beauty, soft fill, controlled reflections',
    pacing: 'Snappy; clear beat every 2–3s'
  },
  {
    id: 'social-viral',
    label: 'Social / viral',
    name: 'Social',
    style: 'Hook-first, face-forward, graphic composition for vertical',
    tone: 'Energetic, playful, direct-to-camera OK',
    camera_preferences: 'Close and medium close, fast push-ins, whip energy',
    lighting_style: 'Ring or soft front key; bold color accents',
    pacing: 'Fast; pattern interrupts every few seconds'
  }
]

export function defaultDirector (): ProjectDirector {
  return {
    name: '',
    style: '',
    tone: '',
    camera_preferences: '',
    lighting_style: '',
    pacing: ''
  }
}

export function presetToDirector (presetId: string): ProjectDirector {
  const p = DIRECTOR_PRESETS.find(x => x.id === presetId)
  if (!p || presetId === 'custom') return defaultDirector()
  return {
    name: p.name,
    style: p.style,
    tone: p.tone,
    camera_preferences: p.camera_preferences,
    lighting_style: p.lighting_style,
    pacing: p.pacing
  }
}
