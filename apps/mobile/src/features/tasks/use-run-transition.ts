import type { TaskDetail, TransitionOption } from '@lintel/api-contracts';
import { useRouter } from 'expo-router';
import { errorMessage } from '@/api/api-error';
import { useToast } from '@/feedback/toast';
import { useTransitionTask } from '@/queries/task-queries';

/**
 * Runs a status change the server offered. Changes that need a note open the
 * note sheet; the rest go straight through with the version on screen.
 */
export function useRunTransition(task: TaskDetail) {
  const router = useRouter();
  const toast = useToast();
  const transition = useTransitionTask(task.id);
  const run = (option: TransitionOption, onDone?: () => void) => {
    if (!option.allowed) return;
    if (option.requiresNote) {
      router.push({ pathname: '/tasks/[id]/transition', params: { id: task.id, to: option.to } });
      return;
    }
    transition.mutate(
      { to: option.to, note: null, version: task.version },
      {
        onSuccess: () => {
          toast.show(`${option.label} — done.`, 'success');
          onDone?.();
        },
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );
  };
  return { run, pendingTo: transition.isPending ? transition.variables?.to : undefined };
}
