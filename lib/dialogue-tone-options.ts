/** Spoken-delivery choices for the video tool. Values are sent to the model as the tone. */

export type DialogueToneOption = {
  value: string
  label: string
}

export type DialogueToneGroup = {
  label: string
  tones: DialogueToneOption[]
}

export const dialogueToneGroups: DialogueToneGroup[] = [
  {
    label: 'How they talk',
    tones: [
      { value: 'neutral', label: 'Neutral' },
      { value: 'calm', label: 'Calm' },
      { value: 'measured', label: 'Measured' },
      { value: 'matter-of-fact', label: 'Matter-of-fact' },
      { value: 'direct', label: 'Direct' },
      { value: 'controlled', label: 'Controlled' },
      { value: 'quiet', label: 'Quiet' },
      { value: 'low', label: 'Low' },
      { value: 'understated', label: 'Understated' },
      { value: 'flat', label: 'Flat' },
      { value: 'deadpan', label: 'Deadpan' },
      { value: 'dry', label: 'Dry' }
    ]
  },
  {
    label: 'With an edge',
    tones: [
      { value: 'sharp', label: 'Sharp' },
      { value: 'clipped', label: 'Clipped' },
      { value: 'impatient', label: 'Impatient' },
      { value: 'irritated', label: 'Irritated' },
      { value: 'dismissive', label: 'Dismissive' },
      { value: 'sarcastic', label: 'Sarcastic' },
      { value: 'wry', label: 'Wry' },
      { value: 'bitter', label: 'Bitter' },
      { value: 'cold', label: 'Cold' },
      { value: 'firm', label: 'Firm' },
      { value: 'commanding', label: 'Commanding' }
    ]
  },
  {
    label: 'Under pressure',
    tones: [
      { value: 'tense', label: 'Tense' },
      { value: 'uneasy', label: 'Uneasy' },
      { value: 'strained', label: 'Strained' },
      { value: 'hesitant', label: 'Hesitant' },
      { value: 'nervous', label: 'Nervous' },
      { value: 'guarded', label: 'Guarded' },
      { value: 'reluctant', label: 'Reluctant' },
      { value: 'weary', label: 'Weary' },
      { value: 'exhausted', label: 'Exhausted' },
      { value: 'grim', label: 'Grim' },
      { value: 'breathless', label: 'Breathless' },
      { value: 'stunned', label: 'Stunned' },
      { value: 'disbelieving', label: 'Disbelieving' }
    ]
  },
  {
    label: 'Feeling',
    tones: [
      { value: 'warm', label: 'Warm' },
      { value: 'gentle', label: 'Gentle' },
      { value: 'soft', label: 'Soft' },
      { value: 'whispered', label: 'Whispered' },
      { value: 'sad', label: 'Sad' },
      { value: 'fearful', label: 'Fearful' },
      { value: 'angry', label: 'Angry' },
      { value: 'excited', label: 'Excited' },
      { value: 'confident', label: 'Confident' },
      { value: 'hopeful', label: 'Hopeful' },
      { value: 'pleading', label: 'Pleading' },
      { value: 'amused', label: 'Amused' },
      { value: 'apologetic', label: 'Apologetic' },
      { value: 'defiant', label: 'Defiant' },
      { value: 'skeptical', label: 'Skeptical' },
      { value: 'thoughtful', label: 'Thoughtful' },
      { value: 'curious', label: 'Curious' },
      { value: 'reassuring', label: 'Reassuring' },
      { value: 'solemn', label: 'Solemn' },
      { value: 'urgent', label: 'Urgent' }
    ]
  }
]

export const dialogueToneOptions: DialogueToneOption[] = dialogueToneGroups.flatMap((g) => g.tones)
