'use client';

import { ErrorState, Skeleton, SkeletonGroup } from '@lintel/design-system/web';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { useTemplateDetail } from '../use-template-admin';
import { TemplateEditor } from './template-editor';

const FRAME = 'mx-auto flex w-full max-w-7xl flex-col gap-7 px-5 py-6 md:px-10 md:py-9';

/** Loads a template for editing; only people who manage templates get the editor. */
export function TemplateEditorPage({ templateId }: { readonly templateId: string }) {
  const { can } = useSession();
  const detail = useTemplateDetail(templateId);
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
  if (detail.isPending) {
    return (
      <div className={FRAME}>
        <SkeletonGroup label="Loading the template" className="flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-1/2" />
          </div>
          <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
            <Skeleton className="h-96 rounded-lg" />
            <Skeleton className="h-[32rem] rounded-lg" />
          </div>
        </SkeletonGroup>
      </div>
    );
  }
  if (detail.isError) {
    return (
      <div className={FRAME}>
        <ErrorState
          {...describeError(detail.error, { resource: 'item', noun: 'template' })}
          onRetry={() => detail.refetch()}
        />
      </div>
    );
  }
  return (
    <TemplateEditor
      key={detail.data.id}
      detail={detail.data}
      onReload={() => detail.refetch().then((result) => result.data)}
    />
  );
}
