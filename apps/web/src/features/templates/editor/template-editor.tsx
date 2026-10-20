'use client';

import type { TemplateDetail } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import { useEffect, useState } from 'react';
import { StaleVersionNotice } from '@/features/common/stale-version-notice';
import { isApiError } from '@/lib/api/api-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { addStage, moveStage, removeStage } from '../definition-edits';
import { issuesFrom } from '../template-issues';
import { draftOf } from '../template-types';
import { usePublishDraft } from '../use-template-admin';
import { EditorDialogs } from './editor-dialogs';
import { EditorHeader } from './editor-header';
import { IssuesPanel } from './issues-panel';
import { OptionsEditor } from './options-editor';
import { StageOutline } from './stage-outline';
import { StagePanel } from './stage-panel';
import { TaskSheet } from './task-sheet';
import { useTemplateDraft } from './use-template-draft';

interface TemplateEditorProps {
  readonly detail: TemplateDetail;
  readonly onReload: () => Promise<TemplateDetail | undefined>;
}

/** The draft of a workflow template: stages on the left, the chosen stage on the right. */
export function TemplateEditor({ detail, onReload }: TemplateEditorProps) {
  const toast = useToast();
  const fail = useFailureToast();
  const draft = useTemplateDraft(detail);
  const publish = usePublishDraft(detail.id);
  const readOnly = detail.archivedAt !== null;
  const [stageIndex, setStageIndex] = useState(0);
  const [sheet, setSheet] = useState<{ visible: boolean; taskKey: string | null }>({
    visible: false,
    taskKey: null,
  });
  const [dialog, setDialog] = useState<'publish' | 'history' | 'archive' | 'removeStage' | null>(
    null,
  );
  const stages = draft.definition.stages;
  const selected = Math.min(stageIndex, Math.max(0, stages.length - 1));
  const openTask = (index: number, taskKey: string) => {
    setStageIndex(index);
    setSheet({ visible: true, taskKey });
  };

  // ⌘S / Ctrl+S saves the draft.
  const { dirty, saveDraft } = draft;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (dirty && !readOnly) void saveDraft(draftOf(detail)?.changeNotes ?? null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dirty, readOnly, saveDraft, detail]);

  const save = async () => {
    const saved = await draft.saveDraft(draftOf(detail)?.changeNotes ?? null);
    if (saved)
      toast({
        tone: 'success',
        title: 'Draft saved',
        description: 'Publish it when it is ready for new projects.',
      });
  };
  const publishDraft = async (notes: string | null) => {
    const current = draftOf(detail);
    const ready =
      draft.dirty || !current || notes !== (current.changeNotes ?? null)
        ? await draft.saveDraft(notes)
        : detail;
    const version = ready ? draftOf(ready)?.version : undefined;
    if (!version) {
      setDialog(null);
      return;
    }
    publish.mutate(version, {
      onSuccess: (published) => {
        draft.adopt(published);
        setDialog(null);
        toast({
          tone: 'success',
          title: 'Template published',
          description: `New projects now start from version ${published.publishedVersion?.versionNumber ?? ''}.`,
        });
      },
      onError: (error) => {
        setDialog(null);
        if (isApiError(error) && error.code === 'VALIDATION_FAILED') {
          draft.setIssues(issuesFrom(error, draft.definition));
          return;
        }
        fail(error, 'publish the template');
      },
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-5 py-6 md:px-10 md:py-9">
      <EditorHeader
        detail={detail}
        dirty={draft.dirty}
        saving={draft.saving}
        readOnly={readOnly}
        stale={draft.stale}
        onSave={() => void save()}
        onPublish={() => setDialog('publish')}
        onHistory={() => setDialog('history')}
        onArchive={() => setDialog('archive')}
      />
      <StaleVersionNotice
        show={draft.stale}
        message="Someone else saved this draft while you were editing. Load their version to continue; your unsaved changes here will be dropped."
        onRefresh={() => void onReload().then((latest) => latest && draft.adopt(latest))}
      />
      <IssuesPanel
        issues={draft.issues}
        definition={draft.definition}
        onGoToStage={setStageIndex}
        onGoToTask={(index, taskKey) => openTask(index, taskKey)}
      />
      <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside className="flex flex-col gap-8 lg:sticky lg:top-6">
          <StageOutline
            definition={draft.definition}
            selected={selected}
            issues={draft.issues}
            readOnly={readOnly}
            onSelect={setStageIndex}
            onMove={(index, direction) => {
              draft.edit((current) => moveStage(current, index, direction));
              setStageIndex(index + direction);
            }}
            onAdd={() => {
              draft.edit(addStage);
              setStageIndex(stages.length);
            }}
          />
          <OptionsEditor definition={draft.definition} readOnly={readOnly} edit={draft.edit} />
        </aside>
        <StagePanel
          definition={draft.definition}
          stageIndex={selected}
          issues={draft.issues}
          readOnly={readOnly}
          edit={draft.edit}
          onOpenTask={(taskKey) => openTask(selected, taskKey)}
          onRemove={() => setDialog('removeStage')}
        />
      </div>
      <TaskSheet
        taskKey={sheet.taskKey}
        visible={sheet.visible}
        onClose={() => setSheet((current) => ({ ...current, visible: false }))}
        definition={draft.definition}
        issues={draft.issues}
        readOnly={readOnly}
        edit={draft.edit}
      />
      <EditorDialogs
        dialog={dialog}
        onClose={() => setDialog(null)}
        detail={detail}
        publishing={publish.isPending || draft.saving}
        onPublish={(notes) => void publishDraft(notes)}
        stageName={stages[selected]?.name ?? ''}
        onRemoveStage={() => {
          draft.edit((current) => removeStage(current, selected));
          setStageIndex(Math.max(0, selected - 1));
          setDialog(null);
        }}
      />
    </div>
  );
}
