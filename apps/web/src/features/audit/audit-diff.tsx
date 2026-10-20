import { cn } from '@lintel/design-system/web';
import { fieldChanges, fieldLabel, formatValue } from './audit-presentation';

interface AuditDiffProps {
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
}

/**
 * Before and after side by side, field by field. Changed fields lead; a
 * value that was only recorded on one side shows a dash on the other.
 */
export function AuditDiff({ before, after }: AuditDiffProps) {
  const changes = fieldChanges(before, after);
  if (changes.length === 0) {
    return (
      <p className="type-body-sm text-ink-faint">No details were recorded with this change.</p>
    );
  }
  const onlyAfter = before === null;
  return (
    <div className="relative overflow-x-auto rounded-md border border-hairline">
      <table className="w-full border-separate border-spacing-0 type-body-sm">
        <caption className="sr-only">What changed</caption>
        <thead>
          <tr className="bg-surface">
            <th
              scope="col"
              className="w-1/4 border-b border-hairline px-3 py-2 text-left type-label font-medium text-ink-faint"
            >
              Field
            </th>
            {!onlyAfter && (
              <th
                scope="col"
                className="border-b border-hairline px-3 py-2 text-left type-label font-medium text-ink-faint"
              >
                Before
              </th>
            )}
            <th
              scope="col"
              className="border-b border-hairline px-3 py-2 text-left type-label font-medium text-ink-faint"
            >
              {onlyAfter ? 'Recorded' : 'After'}
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.field} className={cn(!change.changed && 'text-ink-faint')}>
              <th
                scope="row"
                className="border-b border-hairline px-3 py-2 text-left align-top font-medium text-ink-muted"
              >
                {fieldLabel(change.field)}
                {!change.changed && <span className="sr-only"> (unchanged)</span>}
              </th>
              {!onlyAfter && (
                <td
                  className={cn(
                    'border-b border-hairline px-3 py-2 align-top font-mono text-[0.75rem] break-all',
                    change.changed &&
                      'bg-sunken/70 text-ink-muted line-through decoration-ink-faint',
                  )}
                >
                  {formatValue(change.before)}
                </td>
              )}
              <td
                className={cn(
                  'border-b border-hairline px-3 py-2 align-top font-mono text-[0.75rem] break-all',
                  change.changed && 'font-medium text-ink',
                )}
              >
                {formatValue(change.after)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
