/**
 * Line drawings for empty and quiet states, in the language of architectural
 * elevations and plans. Each stroke is drawn in order; `accent` strokes are
 * dimension lines or the one detail that carries the cyanotype accent.
 * viewBox is 0 0 160 120 for every drawing.
 */
export interface DrawingStroke {
  readonly d: string;
  readonly accent?: boolean;
  readonly dashed?: boolean;
}

export type DrawingName = 'doorway' | 'drafting' | 'plan' | 'chair' | 'lamp' | 'lintelRaising';

const dimension = (x1: number, x2: number, y: number): DrawingStroke[] => [
  { d: `M${x1} ${y} H${x2}`, accent: true },
  { d: `M${x1} ${y - 4} V${y + 4} M${x2} ${y - 4} V${y + 4}`, accent: true },
];

export const DRAWINGS: Readonly<Record<DrawingName, readonly DrawingStroke[]>> = {
  /** A doorway and its lintel. */
  doorway: [
    { d: 'M8 104 H152' },
    { d: 'M52 104 V40 M108 104 V40' },
    { d: 'M44 32 H116 V40 H44 Z' },
    { d: 'M52 40 L74 46 V100 L52 104' },
    { d: 'M70 72 v4' },
    { d: 'M124 104 L127 92 H137 L140 104' },
    { d: 'M132 92 C128 82 122 80 120 74 M132 92 C136 80 142 78 146 72 M132 92 V76' },
    ...dimension(44, 116, 22),
  ],
  /** A drawing board with a sheet, a set square and a pencil. */
  drafting: [
    { d: 'M20 24 H140 V104 H20 Z' },
    { d: 'M32 34 H118 V96 H32 Z' },
    { d: 'M92 84 H118 M92 84 V96 M104 84 V96' },
    { d: 'M44 78 V56 H76 V78 M44 56 L60 46 L76 56' },
    { d: 'M96 42 L132 42 L96 74 Z M102 48 L118 48 L102 63 Z' },
    { d: 'M126 100 L146 80 L151 78 L149 83 L129 103 Z' },
    ...dimension(44, 76, 88),
  ],
  /** A two-room floor plan with door swings, a window and a bed. */
  plan: [
    { d: 'M24 24 H136 V96 H56 M40 96 H24 V24' },
    { d: 'M88 24 V52 M88 66 V96' },
    { d: 'M40 96 V80 M40 80 A16 16 0 0 1 56 96', dashed: true },
    { d: 'M88 52 H102 M102 52 A14 14 0 0 1 88 66', dashed: true },
    { d: 'M44 20 H72 M44 28 H72 M44 20 V28 M72 20 V28' },
    { d: 'M104 32 H128 V64 H104 Z M106 34 H116 V40 H106 Z M117 34 H126 V40 H117 Z' },
    { d: 'M68 60 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0' },
    ...dimension(24, 136, 12),
  ],
  /** A lounge chair in side elevation. */
  chair: [
    { d: 'M16 104 H152' },
    { d: 'M40 70 C40 84 52 88 72 88 H104 C112 88 116 84 116 78' },
    { d: 'M40 70 C38 56 40 40 48 30 C56 42 58 60 60 76 H112' },
    { d: 'M60 88 L52 104 M104 88 L112 104' },
    { d: 'M128 92 H148 M132 92 V104 M144 92 V104' },
    { d: 'M24 88 V104', accent: true },
    { d: 'M20 88 H28 M20 104 H28', accent: true },
  ],
  /** A pendant lamp lighting a table. */
  lamp: [
    { d: 'M80 8 V36' },
    { d: 'M64 52 C64 42 72 36 80 36 C88 36 96 42 96 52 Z M60 52 H100' },
    { d: 'M80 56 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0' },
    { d: 'M64 58 L40 104 M96 58 L120 104', accent: true, dashed: true },
    { d: 'M32 104 H128 M44 104 V118 M116 104 V118' },
    { d: 'M94 104 V96 H108 V104' },
  ],
  /** A half-built wall with its lintel being lowered into place. */
  lintelRaising: [
    { d: 'M16 104 H144' },
    {
      d: 'M28 104 V72 M100 104 V72 M28 96 H100 M28 88 H100 M28 80 H44 M84 80 H100 M28 72 H44 M84 72 H100',
    },
    { d: 'M44 88 V72 M84 88 V72' },
    { d: 'M46 104 V96 M64 104 V96 M82 104 V96 M37 96 V88 M55 96 V88 M73 96 V88 M91 96 V88' },
    { d: 'M37 88 V80 M91 88 V80 M37 80 V72 M91 80 V72' },
    {
      d: 'M116 104 V40 M132 104 V40 M116 92 H132 M116 80 H132 M116 68 H132 M116 56 H132 M116 44 H132',
    },
    { d: 'M64 8 V30 M64 30 C60 30 60 34 64 34' },
    { d: 'M40 40 H88 V48 H40 Z', accent: true },
    { d: 'M44 52 V68 M84 52 V68', accent: true, dashed: true },
  ],
};
