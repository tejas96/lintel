import { cn } from '../lib/cn';

/** Shapes that pair with a status word so status never depends on colour. */
export type StatusGlyphName =
  | 'draft'
  | 'ready'
  | 'progress'
  | 'blocked'
  | 'review'
  | 'changes'
  | 'done'
  | 'cancelled'
  | 'onTrack'
  | 'atRisk'
  | 'offTrack'
  | 'overdue'
  | 'notStarted';

const RING = 'M7 1.75a5.25 5.25 0 1 0 0 10.5a5.25 5.25 0 1 0 0-10.5';

function GlyphShape({ name }: { readonly name: StatusGlyphName }) {
  switch (name) {
    case 'draft':
      return (
        <path
          d={RING}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="2 2.1"
        />
      );
    case 'ready':
    case 'notStarted':
      return <path d={RING} fill="none" stroke="currentColor" strokeWidth={1.5} />;
    case 'progress':
      return (
        <>
          <path d={RING} fill="none" stroke="currentColor" strokeWidth={1.5} />
          <path d="M7 3.5a3.5 3.5 0 0 1 0 7Z" fill="currentColor" />
        </>
      );
    case 'blocked':
      return (
        <>
          <path d={RING} fill="none" stroke="currentColor" strokeWidth={1.5} />
          <path d="M4.5 7h5" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
        </>
      );
    case 'review':
      return (
        <>
          <path d={RING} fill="none" stroke="currentColor" strokeWidth={1.5} />
          <circle cx={7} cy={7} r={1.9} fill="currentColor" />
        </>
      );
    case 'changes':
      return (
        <path
          d="M11.6 5.2A5 5 0 1 0 12 7.5M11.9 2.6v2.8H9.1"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'done':
    case 'onTrack':
      return (
        <>
          <circle cx={7} cy={7} r={6} fill="currentColor" />
          <path
            d="M4.4 7.2 6.2 9 9.7 5.2"
            fill="none"
            stroke="var(--color-raised)"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'cancelled':
      return (
        <>
          <path d={RING} fill="none" stroke="currentColor" strokeWidth={1.5} />
          <path d="M3.4 10.6 10.6 3.4" stroke="currentColor" strokeWidth={1.5} />
        </>
      );
    case 'atRisk':
      return (
        <>
          <path
            d="M7 1.6 12.6 11.6H1.4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <path d="M7 5.6v2.6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
          <circle cx={7} cy={9.9} r={0.85} fill="currentColor" />
        </>
      );
    case 'offTrack':
      return (
        <>
          <path d="M4.6 1.5h4.8l3.1 3.1v4.8l-3.1 3.1H4.6L1.5 9.4V4.6Z" fill="currentColor" />
          <path
            d="M7 4.2v3.2"
            stroke="var(--color-raised)"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <circle cx={7} cy={9.6} r={0.9} fill="var(--color-raised)" />
        </>
      );
    case 'overdue':
      return (
        <>
          <path d={RING} fill="none" stroke="currentColor" strokeWidth={1.5} />
          <path
            d="M7 4.2V7l2 1.4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </>
      );
  }
}

export function StatusGlyph({
  name,
  className,
}: {
  readonly name: StatusGlyphName;
  readonly className?: string | undefined;
}) {
  return (
    <svg
      viewBox="0 0 14 14"
      aria-hidden
      focusable="false"
      className={cn('size-3.5 shrink-0', className)}
    >
      <GlyphShape name={name} />
    </svg>
  );
}
