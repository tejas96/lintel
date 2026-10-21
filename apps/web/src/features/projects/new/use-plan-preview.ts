'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { isDraftEmpty, toTailoring } from './plan-draft';
import { membersOf, type WizardState } from './wizard-state';

/** Waits until the value has stopped changing for `delay` ms (typing, stepping a duration). */
function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

function bodyOf(state: WizardState, tailored: boolean) {
  if (!state.templateVersionId || !state.plannedStartDate || !state.managerUserId) return null;
  return {
    managerUserId: state.managerUserId,
    plannedStartDate: state.plannedStartDate,
    templateVersionId: state.templateVersionId,
    templateOptions: [...state.templateOptions],
    members: membersOf(state),
    ...(tailored && !isDraftEmpty(state.plan) ? { tailoring: toTailoring(state.plan) } : {}),
  };
}

type PreviewBody = NonNullable<ReturnType<typeof bodyOf>>;

function usePreviewQuery(body: PreviewBody | null) {
  return useQuery({
    queryKey: ['projects', 'plan-preview', body],
    queryFn: () =>
      expectStatus(api.planning.previewProjectPlan({ body: body as PreviewBody }), 200),
    enabled: body !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * The live plan: the server's plan builder dates the tailored template on
 * every change (after a short pause), and the untailored template plan is
 * kept beside it so the end date can be compared.
 */
export function usePlanPreview(state: WizardState) {
  // Compared as text: a new object with the same content is the same request.
  const tailoredKey = JSON.stringify(bodyOf(state, true));
  const settledKey = useSettled(tailoredKey, 220);
  const settledBody = useMemo(() => JSON.parse(settledKey) as PreviewBody | null, [settledKey]);
  const templateKey = JSON.stringify(bodyOf(state, false));
  const templateBody = useMemo(() => JSON.parse(templateKey) as PreviewBody | null, [templateKey]);
  const preview = usePreviewQuery(settledBody);
  const template = usePreviewQuery(templateBody);
  return { preview, template, updating: tailoredKey !== settledKey || preview.isFetching };
}
