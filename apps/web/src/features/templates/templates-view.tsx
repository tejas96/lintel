'use client';

import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  pageEnter,
  Skeleton,
  SkeletonGroup,
  Switch,
} from '@lintel/design-system/web';
import { Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { NewTemplateDialog } from './new-template-dialog';
import { TemplateCard } from './template-card';
import { useTemplateList } from './use-template-admin';

const FRAME = 'mx-auto flex w-full max-w-6xl flex-col gap-7 px-5 py-6 md:px-10 md:py-9';

/** The studio's workflow templates: what each new project starts from. */
export function TemplatesView() {
  const { can } = useSession();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const templates = useTemplateList(showArchived);
  if (!can('templates.manage')) {
    return (
      <div className={FRAME}>
        <ErrorState
          kind="forbidden"
          title="Templates are for the people who plan the studio’s work"
          message="Project managers and administrators can change workflow templates."
        />
      </div>
    );
  }
  const items = templates.data ?? [];
  return (
    <div className={FRAME}>
      <motion.div {...pageEnter}>
        <PageHeader
          title="Workflow templates"
          description="The stages, tasks and checks each new project starts with. Published versions never change, so running projects keep the workflow they began with."
          actions={
            <Button
              variant="primary"
              leadingIcon={<Plus aria-hidden />}
              onClick={() => setCreating(true)}
            >
              New template
            </Button>
          }
        />
      </motion.div>
      <Switch
        label="Show archived templates"
        checked={showArchived}
        onCheckedChange={setShowArchived}
        className="max-w-xs"
      />
      {templates.isPending && (
        <SkeletonGroup label="Loading templates" className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((card) => (
            <Skeleton key={card} className="h-48 rounded-lg" />
          ))}
        </SkeletonGroup>
      )}
      {templates.isError && (
        <ErrorState
          {...describeError(templates.error, { resource: 'collection' })}
          onRetry={() => templates.refetch()}
        />
      )}
      {templates.data && items.length === 0 && (
        <EmptyState
          drawing="drafting"
          title="No templates yet"
          description="Create one from Lintel’s starting point for a kind of project, then shape it to how your studio works."
          actions={
            <Button variant="primary" onClick={() => setCreating(true)}>
              New template
            </Button>
          }
        />
      )}
      {items.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((template, index) => (
            <TemplateCard key={template.id} template={template} index={index} />
          ))}
        </ul>
      )}
      <NewTemplateDialog open={creating} onOpenChange={setCreating} templates={items} />
    </div>
  );
}
