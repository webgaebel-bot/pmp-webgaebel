export const TIMER_STORAGE_KEY = 'pmp.timeTracking.activeTimer';
export const TIMER_STORAGE_EVENT = 'pmp:timeTrackingTimerChanged';

export type TrackingMode = 'project' | 'sales';

export type TimeTrackingFormData = {
  project_id: string;
  task_id: string;
  lead_id: string;
  work_type: string;
  source: string;
  manual_leads_count: string;
  date: string;
  description: string;
  manual_hours: string;
  manual_minutes: string;
};

export type TimerSnapshot = {
  isTracking: boolean;
  isPaused: boolean;
  currentTime: number;
  sessionStartedAt: string | null;
  timerStartedAtMs: number | null;
  elapsedBeforePause: number;
  trackingMode: TrackingMode;
  formData: TimeTrackingFormData;
};

export const getRunningElapsed = (startedAtMs: number | null, elapsedBeforePause: number) => {
  if (!startedAtMs) return elapsedBeforePause;
  return elapsedBeforePause + Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
};

export const readTimerSnapshot = (): Partial<TimerSnapshot> | null => {
  try {
    const stored = localStorage.getItem(TIMER_STORAGE_KEY);
    return stored ? JSON.parse(stored) as Partial<TimerSnapshot> : null;
  } catch {
    localStorage.removeItem(TIMER_STORAGE_KEY);
    return null;
  }
};

export const writeTimerSnapshot = (snapshot: TimerSnapshot) => {
  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent(TIMER_STORAGE_EVENT));
};

export const clearTimerSnapshot = () => {
  localStorage.removeItem(TIMER_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(TIMER_STORAGE_EVENT));
};

export const getSnapshotElapsed = (snapshot: Partial<TimerSnapshot> | null) => {
  if (!snapshot?.isTracking) return 0;
  if (snapshot.isPaused) return Number(snapshot.currentTime || snapshot.elapsedBeforePause || 0);
  return getRunningElapsed(snapshot.timerStartedAtMs || null, Number(snapshot.elapsedBeforePause || 0));
};

export const formatDurationHms = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safeSeconds / 3600);
  const mins = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatHoursAsHms = (hours: number | string | null | undefined) => {
  return formatDurationHms(Math.round(Number(hours || 0) * 3600));
};
