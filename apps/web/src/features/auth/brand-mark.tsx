import { cn } from '@lintel/design-system/web';

/** The Lintel mark: a beam resting on two posts — the lintel over an opening. */
export function LintelMark({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" className={cn('size-6', className)}>
      <rect x={2.5} y={4.5} width={19} height={3.4} rx={0.7} fill="currentColor" />
      <rect x={5.6} y={9} width={2.7} height={11} rx={0.5} fill="currentColor" opacity={0.86} />
      <rect x={15.7} y={9} width={2.7} height={11} rx={0.5} fill="currentColor" opacity={0.86} />
    </svg>
  );
}

export function Wordmark({ className }: { readonly className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LintelMark />
      <span className="font-display text-[1.375rem] leading-none tracking-[-0.01em]">Lintel</span>
    </span>
  );
}
