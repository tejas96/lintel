import type { RewardEvaluation } from '@lintel/api-contracts';
import { cn, StatusGlyph } from '@lintel/design-system/web';

/**
 * Each criterion with its result in words: what was measured, what was
 * needed, and whether it was met. Every criterion must pass.
 */
export function CriteriaResults({ criteria }: { readonly criteria: RewardEvaluation['criteria'] }) {
  return (
    <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
      {criteria.map((criterion) => (
        <li key={criterion.type} className="flex gap-3 px-4 py-3">
          <StatusGlyph
            name={criterion.passed ? 'done' : 'notStarted'}
            className={cn(
              'mt-0.5 size-4 shrink-0',
              criterion.passed ? 'text-on-track' : 'text-ink-faint',
            )}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="type-body-sm font-medium text-ink">
              {criterion.label}
              <span
                className={cn(
                  'ml-2 font-normal',
                  criterion.passed ? 'text-on-track' : 'text-ink-muted',
                )}
              >
                {criterion.passed ? 'Met' : 'Not met'}
              </span>
            </p>
            <p className="type-body-sm text-ink-muted">{criterion.explanation}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
            <span className="font-display text-[1.25rem] leading-6 text-ink tabular-nums">
              {criterion.actual}
            </span>
            <span className="text-[0.75rem] text-ink-faint">needs {criterion.required}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
