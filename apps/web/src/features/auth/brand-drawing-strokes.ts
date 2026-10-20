/**
 * An interior elevation for the sign-in panel: a doorway under its lintel, a
 * window, a pendant lamp over a lounge chair, with grid bubbles and dimension
 * lines as on a real drawing sheet. viewBox 0 0 520 420.
 */
export interface ElevationStroke {
  readonly d: string;
  /** Seconds after the panel appears. */
  readonly at: number;
  readonly weight?: 'heavy' | 'light' | 'hairline';
  readonly dashed?: boolean;
}

export interface ElevationLabel {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly at: number;
  readonly vertical?: boolean;
}

const tick = (x: number, y: number) => `M${x - 4} ${y + 4} L${x + 4} ${y - 4}`;

export const ELEVATION_STROKES: readonly ElevationStroke[] = [
  { d: 'M20 360 H500', at: 0, weight: 'heavy' },
  { d: 'M20 44 H500', at: 0.1, weight: 'hairline' },
  { d: 'M200 360 V150 M300 360 V150', at: 0.35, weight: 'heavy' },
  { d: 'M186 136 H314 V150 H186 Z', at: 0.6, weight: 'heavy' },
  { d: 'M200 150 L234 160 V352 L200 360', at: 0.85 },
  { d: 'M228 258 v8', at: 1.05 },
  { d: 'M60 120 H150 V250 H60 Z', at: 0.7 },
  { d: 'M105 120 V250 M60 185 H150', at: 0.95, weight: 'light' },
  { d: 'M52 250 H158 V257 H52 Z', at: 1.05 },
  { d: 'M150 360 L155 334 H177 L182 360', at: 1.1 },
  {
    d: 'M166 334 C160 316 150 310 146 298 M166 334 C172 314 182 308 188 296 M166 334 V306',
    at: 1.25,
    weight: 'light',
  },
  { d: 'M400 44 V110', at: 1.2, weight: 'light' },
  { d: 'M372 140 C372 122 386 110 400 110 C414 110 428 122 428 140 Z M366 140 H434', at: 1.35 },
  { d: 'M340 300 C340 318 352 324 374 324 H436 C446 324 452 318 452 310', at: 1.55 },
  { d: 'M340 300 C338 284 340 266 350 254 C360 268 362 288 364 306 H446', at: 1.7 },
  { d: 'M364 324 L354 360 M436 324 L446 360', at: 1.85 },
  { d: 'M470 330 H496 M474 330 V360 M492 330 V360', at: 1.9, weight: 'light' },
  { d: `M200 112 H300 ${tick(200, 112)} ${tick(300, 112)}`, at: 2.05, weight: 'hairline' },
  { d: `M326 150 V360 ${tick(326, 150)} ${tick(326, 360)}`, at: 2.15, weight: 'hairline' },
  { d: `M32 44 V360 ${tick(32, 44)} ${tick(32, 360)}`, at: 2.25, weight: 'hairline' },
  { d: 'M200 30 V44 M300 30 V44', at: 2.3, weight: 'hairline', dashed: true },
  { d: 'M200 10 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0', at: 2.35, weight: 'hairline' },
  { d: 'M300 10 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0', at: 2.4, weight: 'hairline' },
  { d: 'M378 146 L346 262 M422 146 L454 262', at: 2.55, weight: 'hairline', dashed: true },
];

export const ELEVATION_LABELS: readonly ElevationLabel[] = [
  { x: 250, y: 106, text: '1000', at: 2.3 },
  { x: 315, y: 255, text: '2100', at: 2.4, vertical: true },
  { x: 44, y: 202, text: '3000', at: 2.5, vertical: true },
  { x: 200, y: 11, text: 'A', at: 2.5 },
  { x: 300, y: 11, text: 'B', at: 2.55 },
];
