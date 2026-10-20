'use client';

import type { TemplateDetail } from '@lintel/api-contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isApiError } from '@/lib/api/api-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { issuesFrom, type TemplateIssue } from '../template-issues';
import { draftOf, editableVersion, type WorkflowDefinition } from '../template-types';
import { useSaveDraft } from '../use-template-admin';

const EMPTY: WorkflowDefinition = { options: [], stages: [] };

/**
 * The definition being edited, whether it differs from what is saved, and
 * the server's problems with the last save. Saving keeps the editor where it
 * is and adopts the server's copy.
 */
export function useTemplateDraft(detail: TemplateDetail) {
  const fail = useFailureToast();
  const save = useSaveDraft(detail.id);
  const [definition, setDefinition] = useState<WorkflowDefinition>(
    () => editableVersion(detail)?.definition ?? EMPTY,
  );
  const [dirty, setDirty] = useState(false);
  const [issues, setIssues] = useState<TemplateIssue[]>([]);
  const [stale, setStale] = useState(false);
  // The latest definition, so a save that finishes after more edits keeps them marked unsaved.
  const latest = useRef(definition);
  useEffect(() => {
    latest.current = definition;
  }, [definition]);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const edit = useCallback((change: (current: WorkflowDefinition) => WorkflowDefinition) => {
    setDefinition(change);
    setDirty(true);
  }, []);

  /** Saves the draft (with optional notes); resolves to the saved detail, or null on refusal. */
  const saveDraft = (changeNotes: string | null): Promise<TemplateDetail | null> =>
    new Promise((resolve) => {
      const sent = definition;
      save.mutate(
        { definition: sent, changeNotes, version: draftOf(detail)?.version ?? null },
        {
          onSuccess: (saved) => {
            if (latest.current === sent) setDirty(false);
            setIssues([]);
            resolve(saved);
          },
          onError: (error) => {
            if (isApiError(error) && error.isStaleVersion) setStale(true);
            else if (isApiError(error) && error.code === 'VALIDATION_FAILED') {
              setIssues(issuesFrom(error, sent));
            } else fail(error, 'save the draft');
            resolve(null);
          },
        },
      );
    });

  /** Takes the server's copy (after publishing, or to drop local changes). */
  const adopt = useCallback((next: TemplateDetail) => {
    setDefinition(editableVersion(next)?.definition ?? EMPTY);
    setDirty(false);
    setIssues([]);
    setStale(false);
  }, []);

  return {
    definition,
    dirty,
    issues,
    setIssues,
    stale,
    edit,
    saveDraft,
    saving: save.isPending,
    adopt,
  };
}

export type TemplateDraftState = ReturnType<typeof useTemplateDraft>;
