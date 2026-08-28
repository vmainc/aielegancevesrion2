import type { RepairMode } from './types'

export type LumaModifyMode =
  | 'adhere_1'
  | 'adhere_2'
  | 'adhere_3'
  | 'flex_1'
  | 'flex_2'
  | 'flex_3'
  | 'reimagine_1'
  | 'reimagine_2'
  | 'reimagine_3'

/** User-facing strength → Luma Modify (mid-band of each family). */
export function lumaModeForRepairMode (mode: RepairMode): LumaModifyMode {
  if (mode === 'preserve') return 'adhere_2'
  if (mode === 'reimagine') return 'reimagine_2'
  return 'flex_2'
}
