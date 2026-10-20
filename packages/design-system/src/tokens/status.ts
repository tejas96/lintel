/**
 * Semantic status colours. `fg` is text/icon colour on `tint` or plain
 * surfaces; `solid` is for dots, bars and ring segments (≥ 3:1 for graphics).
 * Every status is also shown with a glyph and a word — never colour alone.
 */
export const STATUS_TONES = ['onTrack', 'atRisk', 'blocked', 'overdue', 'review', 'done'] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

export interface StatusColor {
  readonly fg: string;
  readonly tint: string;
  readonly solid: string;
}

export const LIGHT_STATUS: Readonly<Record<StatusTone, StatusColor>> = {
  onTrack: { fg: '#2C6844', tint: '#E1EEE4', solid: '#3E8A5B' },
  atRisk: { fg: '#865100', tint: '#F8EAD0', solid: '#B97A10' },
  blocked: { fg: '#86306A', tint: '#F5E2EE', solid: '#A8458A' },
  overdue: { fg: '#A62E1C', tint: '#F9E2DC', solid: '#C4432C' },
  review: { fg: '#5639A0', tint: '#ECE6F8', solid: '#7255C2' },
  done: { fg: '#3D4850', tint: '#E4E8EA', solid: '#6A7780' },
};

export const DARK_STATUS: Readonly<Record<StatusTone, StatusColor>> = {
  onTrack: { fg: '#8FD3A6', tint: '#16281E', solid: '#5DB07E' },
  atRisk: { fg: '#EDC27C', tint: '#2D2411', solid: '#D9A040' },
  blocked: { fg: '#EBA6D3', tint: '#2E1727', solid: '#C76BA8' },
  overdue: { fg: '#F4A391', tint: '#34190F', solid: '#E2735C' },
  review: { fg: '#C4B4F6', tint: '#241D3B', solid: '#9D87E9' },
  done: { fg: '#BAC3C9', tint: '#1E2326', solid: '#8B969D' },
};

export const STATUS_LABELS: Readonly<Record<StatusTone, string>> = {
  onTrack: 'On track',
  atRisk: 'At risk',
  blocked: 'Blocked',
  overdue: 'Overdue',
  review: 'In review',
  done: 'Done',
};
