'use client';

import { Button, ErrorState, PageHeader, swapEnter, useToast } from '@lintel/design-system/web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';
import { todayIn } from '@/lib/format/dates';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { StepBasics } from './step-basics';
import { StepReview } from './step-review';
import { StepTeam } from './step-team';
import { StepWorkflow } from './step-workflow';
import {
  FIELD_STEP,
  INITIAL_WIZARD_STATE,
  toCreateBody,
  WIZARD_STEPS,
  type WizardState,
} from './wizard-state';
import { WizardStepper } from './wizard-stepper';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stepErrors(step: number, state: WizardState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 0) {
    if (!state.name.trim()) errors.name = 'Give the project a name.';
    if (!state.clientName.trim()) errors.clientName = 'Who is the client?';
    if (state.clientEmail.trim() && !EMAIL.test(state.clientEmail.trim()))
      errors.clientEmail = 'This email address looks incomplete.';
  }
  if (step === 2) {
    if (!state.plannedStartDate) errors.plannedStartDate = 'Choose when the project starts.';
    if (!state.managerUserId) errors.managerUserId = 'Choose who manages the project.';
  }
  return errors;
}

export function NewProjectWizard() {
  const { user, can } = useSession();
  const router = useRouter();
  const toast = useToast();
  const fail = useFailureToast();
  const queryClient = useQueryClient();
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const update = useCallback(
    (patch: Partial<WizardState>) => setState((current) => ({ ...current, ...patch })),
    [],
  );
  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const create = useMutation({
    mutationFn: (body: Parameters<typeof api.projects.createProject>[0]['body']) =>
      expectStatus(api.projects.createProject({ body }), 201),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allProjectLists });
      toast({
        tone: 'success',
        title: 'Project created',
        description: `${project.reference} ${project.name}`,
      });
      router.push(`/projects/${project.id}`);
    },
    onError: (error) => {
      if (isApiError(error) && error.details.length > 0) {
        const fields = error.fieldErrors();
        setErrors(fields);
        const first = Object.keys(fields)[0];
        if (first && FIELD_STEP[first] !== undefined) goTo(FIELD_STEP[first] ?? 0);
      }
      fail(error, 'create the project');
    },
  });

  if (!can('projects.create')) {
    return (
      <ErrorState
        kind="forbidden"
        title="You can’t create projects"
        message="Ask a studio administrator or project manager to set it up, or to give you access."
      />
    );
  }

  const next = () => {
    const found = stepErrors(step, state);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (step < WIZARD_STEPS.length - 1) {
      goTo(step + 1);
      return;
    }
    const result = toCreateBody(state);
    if (!result.ok) {
      setErrors(result.errors);
      const first = Object.keys(result.errors)[0];
      goTo(first ? (FIELD_STEP[first] ?? 0) : 0);
      return;
    }
    create.mutate(result.body);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-6 md:px-10 md:py-9">
      <Link
        href="/projects"
        className="inline-flex min-h-11 items-center gap-1 self-start rounded-sm type-body-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Projects
      </Link>
      <PageHeader
        title="New project"
        description="Four short steps. A template lays out the stages, tasks and dates for you."
      />
      <WizardStepper current={step} onSelect={goTo} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.section key={step} aria-label={WIZARD_STEPS[step]} {...swapEnter(direction)}>
          {step === 0 && <StepBasics state={state} update={update} errors={errors} />}
          {step === 1 && <StepWorkflow state={state} update={update} />}
          {step === 2 && (
            <StepTeam
              state={state}
              update={update}
              errors={errors}
              today={todayIn(user.timeZone)}
            />
          )}
          {step === 3 && <StepReview state={state} goTo={goTo} />}
        </motion.section>
      </AnimatePresence>
      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-6">
        <Button variant="quiet" onClick={() => goTo(step - 1)} disabled={step === 0}>
          Back
        </Button>
        <Button variant="primary" onClick={next} pending={create.isPending}>
          {step === WIZARD_STEPS.length - 1 ? 'Create project' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
