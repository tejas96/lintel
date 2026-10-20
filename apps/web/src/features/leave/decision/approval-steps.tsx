import type { LeaveRequestDetail } from '@lintel/api-contracts';
import { Avatar, cn, StatusGlyph, type StatusGlyphName } from '@lintel/design-system/web';
import { formatRelativeInstant } from '@/lib/format/dates';

type StepStatus = LeaveRequestDetail['steps'][number]['status'];

const STEP_PRESENTATION: Readonly<
  Record<StepStatus, { word: string; glyph: StatusGlyphName; tone: string }>
> = {
  waiting: { word: 'Waiting its turn', glyph: 'notStarted', tone: 'text-ink-faint' },
  pending: { word: 'Deciding now', glyph: 'progress', tone: 'text-accent' },
  approved: { word: 'Approved', glyph: 'done', tone: 'text-on-track' },
  rejected: { word: 'Rejected', glyph: 'offTrack', tone: 'text-overdue' },
  skipped: { word: 'Not needed', glyph: 'draft', tone: 'text-ink-faint' },
};

interface TimelineNode {
  readonly key: string;
  readonly glyph: StatusGlyphName;
  readonly tone: string;
  readonly title: string;
  readonly person: LeaveRequestDetail['user'] | null;
  readonly word: string;
  readonly when: string | null;
  readonly note: string | null;
  readonly current: boolean;
}

function nodesOf(request: LeaveRequestDetail): TimelineNode[] {
  const asked: TimelineNode = {
    key: 'asked',
    glyph: 'ready',
    tone: 'text-ink-muted',
    title: request.isUrgentAbsence ? 'Absence recorded' : 'Leave requested',
    person: request.user,
    word: request.isUrgentAbsence ? 'Recorded by a manager' : 'Asked',
    when: request.createdAt,
    note: null,
    current: false,
  };
  const steps = request.steps.map<TimelineNode>((step) => {
    const presentation = STEP_PRESENTATION[step.status];
    return {
      key: `step-${step.level}`,
      glyph: presentation.glyph,
      tone: presentation.tone,
      title: request.steps.length > 1 ? `Approval, step ${step.level}` : 'Approval',
      person: step.approver,
      word:
        step.status === 'pending' && request.status === 'info_requested'
          ? 'Waiting for an answer'
          : presentation.word,
      when: step.decidedAt,
      note: step.note,
      current: step.status === 'pending',
    };
  });
  if (request.status !== 'cancelled') return [asked, ...steps];
  const cancelled: TimelineNode = {
    key: 'cancelled',
    glyph: 'cancelled',
    tone: 'text-ink-faint',
    title: 'Cancelled',
    person: null,
    word: 'No longer needed',
    when: null,
    note: request.decisionNote,
    current: false,
  };
  return [asked, ...steps, cancelled];
}

/** The path a request takes: asked, then each approval step in order. */
export function ApprovalSteps({ request }: { readonly request: LeaveRequestDetail }) {
  const nodes = nodesOf(request);
  return (
    <ol className="flex flex-col">
      {nodes.map((node, index) => {
        const last = index === nodes.length - 1;
        return (
          <li key={node.key} className="relative flex gap-3.5 pb-5 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className="absolute top-6 bottom-0 left-[0.6875rem] w-px bg-hairline"
              />
            )}
            <span
              className={cn(
                'relative z-[1] mt-0.5 flex size-[1.375rem] shrink-0 items-center justify-center rounded-full bg-raised',
                node.current && 'ring-2 ring-accent/25',
              )}
            >
              <StatusGlyph name={node.glyph} className={cn('size-4', node.tone)} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="type-label text-ink-faint">{node.title}</p>
              {node.person && (
                <p className="flex items-center gap-2 type-body-sm text-ink">
                  <Avatar
                    name={node.person.fullName}
                    hue={node.person.avatarHue}
                    size="xs"
                    decorative
                  />
                  <span className="truncate">{node.person.fullName}</span>
                </p>
              )}
              <p className={cn('type-body-sm', node.current ? 'text-accent' : 'text-ink-muted')}>
                {node.word}
                {node.when && (
                  <span className="text-ink-faint">, {formatRelativeInstant(node.when)}</span>
                )}
              </p>
              {node.note && (
                <p className="rounded-md bg-sunken/70 px-3 py-2 type-body-sm text-ink">
                  {node.note}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
