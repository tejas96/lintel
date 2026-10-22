import { fieldLabel } from './audit-presentation';
import { inlineText, isRow, type Names } from './audit-value-text';

/** A recorded value as readable text; lists of records as a list, never raw JSON. */
export function AuditValue({
  field,
  value,
  names,
}: {
  readonly field: string;
  readonly value: unknown;
  readonly names: Names;
}) {
  if (Array.isArray(value) && value.some(isRow)) {
    return (
      <ul className="flex flex-col gap-1">
        {value.map((item, index) => (
          // Recorded lists never reorder; the position is the identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: static snapshot
          <li key={index}>{inlineText(field, item, names)}</li>
        ))}
      </ul>
    );
  }
  if (isRow(value)) {
    return (
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
        {Object.entries(value).map(([key, item]) => (
          <div key={key} className="contents">
            <dt className="text-ink-faint">{fieldLabel(key)}</dt>
            <dd>{inlineText(key, item, names)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return <>{inlineText(field, value, names)}</>;
}
