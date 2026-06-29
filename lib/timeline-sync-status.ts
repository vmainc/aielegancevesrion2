/** Cloud/local sync state for the timeline editor (PASS 32–33). */
export type TimelineSyncStatus =
  | 'synced'
  | 'local_pending'
  | 'conflict'
  | 'local_only'
  | 'queued'

export const TIMELINE_SYNC_STATUS_LABELS: Record<TimelineSyncStatus, string> = {
  synced: 'Synced',
  local_pending: 'Local changes pending',
  conflict: 'Conflict',
  local_only: 'Local only',
  queued: 'Queued for cloud sync'
}

export function timelineSyncStatusClass (status: TimelineSyncStatus): string {
  switch (status) {
    case 'synced':
      return 'text-emerald-700'
    case 'local_pending':
      return 'text-amber-700'
    case 'conflict':
      return 'text-red-700'
    case 'local_only':
      return 'text-amber-700'
    case 'queued':
      return 'text-sky-700'
    default:
      return 'text-gray-600'
  }
}

export function timelineSyncStatusDotClass (status: TimelineSyncStatus): string {
  switch (status) {
    case 'synced':
      return 'bg-emerald-500'
    case 'local_pending':
      return 'bg-amber-500'
    case 'conflict':
      return 'bg-red-500'
    case 'local_only':
      return 'bg-amber-500'
    case 'queued':
      return 'bg-sky-500'
    default:
      return 'bg-gray-400'
  }
}
