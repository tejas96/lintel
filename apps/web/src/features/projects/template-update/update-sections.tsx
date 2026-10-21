'use client';

import type { TemplateUpdateItem } from '@lintel/api-contracts';
import { Card } from '@lintel/design-system/web';
import { CHANGE_HEADINGS, type ChangeKind, ChangeMark } from './change-mark';
import { UpdateItem } from './update-item';

/** Blocked items, whatever their change, are grouped under "will not change". */
export function bucketOf(item: TemplateUpdateItem): ChangeKind {
  return item.blocked ? 'unchanged' : item.change;
}

const ORDER: readonly ChangeKind[] = ['added', 'changed', 'removed', 'unchanged'];

/** The update, section by section: added, changed, removed, and what stays as it is. */
export function UpdateSections({
  items,
  today,
  ticked,
  onTick,
}: {
  readonly items: readonly TemplateUpdateItem[];
  readonly today: string;
  readonly ticked: ReadonlySet<string>;
  readonly onTick: (key: string, ticked: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {ORDER.map((kind) => {
        const inSection = items.filter((item) => bucketOf(item) === kind);
        if (inSection.length === 0) return null;
        const heading = CHANGE_HEADINGS[kind];
        const headingId = `update-section-${kind}`;
        return (
          <Card key={kind} aria-labelledby={headingId} className="overflow-hidden">
            <header className="flex flex-col gap-1 border-b border-hairline px-4 py-3.5 sm:flex-row sm:items-baseline sm:gap-3">
              <h2 id={headingId} className="flex items-center gap-2 type-title-md text-ink">
                <ChangeMark kind={kind} compact />
                {heading.title}
                <span className="type-body-sm font-normal text-ink-faint tabular-nums">
                  {inSection.length}
                </span>
              </h2>
              <p className="type-body-sm text-ink-faint">{heading.description}</p>
            </header>
            <ul className="divide-y divide-hairline">
              {inSection.map((item) => (
                <UpdateItem
                  key={item.key}
                  item={item}
                  today={today}
                  ticked={ticked.has(item.key)}
                  onTick={onTick}
                />
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
