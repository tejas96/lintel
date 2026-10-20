import type { TemplateSummary } from '@lintel/api-contracts';
import { Badge, listItemEnter } from '@lintel/design-system/web';
import { PROJECT_TYPE_LABELS } from '@lintel/domain';
import { ChevronRight, PencilLine } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

/** One template: its published version at a glance and whether a draft is waiting. */
export function TemplateCard({
  template,
  index,
}: {
  readonly template: TemplateSummary;
  readonly index: number;
}) {
  const published = template.publishedVersion;
  return (
    <motion.li
      {...listItemEnter(index)}
      className="group relative flex flex-col gap-4 rounded-lg border border-hairline bg-raised p-5 transition-[border-color,box-shadow] hover:border-rule hover:shadow-e1"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="type-body-sm text-ink-muted">{PROJECT_TYPE_LABELS[template.projectType]}</p>
          <Link
            href={`/templates/${template.id}`}
            className="lt-stretched-link rounded-sm type-title-lg text-ink"
          >
            {template.name}
          </Link>
        </div>
        <ChevronRight
          aria-hidden
          className="mt-1 size-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
        />
      </div>
      {template.description && (
        <p className="line-clamp-2 type-body-sm text-ink-muted">{template.description}</p>
      )}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-hairline pt-4">
        {published ? (
          <dl className="flex gap-5">
            <Stat label="Version" value={`v${published.versionNumber}`} />
            <Stat label="Stages" value={String(published.stageCount)} />
            <Stat label="Tasks" value={String(published.taskCount)} />
          </dl>
        ) : (
          <p className="type-body-sm text-ink-muted">Not published yet</p>
        )}
        <span className="flex gap-1.5">
          {template.hasDraft && (
            <Badge variant="accent">
              <PencilLine aria-hidden className="size-3" />
              Draft in progress
            </Badge>
          )}
          {template.archivedAt && <Badge variant="soft">Archived</Badge>}
        </span>
      </div>
    </motion.li>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[0.75rem] text-ink-faint">{label}</dt>
      <dd className="font-display text-[1.375rem] leading-7 text-ink tabular-nums">{value}</dd>
    </div>
  );
}
