import type { LeaveConflict, UserSummary } from '@lintel/api-contracts';
import { View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { PersonPicker } from '@/features/people/person-picker';
import { SPACE } from '@/theme/layout';

export interface HandoverDraft {
  readonly to: UserSummary | null;
  readonly note: string;
}

export interface HandoverProposalsProps {
  readonly conflicts: readonly LeaveConflict[];
  readonly drafts: Readonly<Record<string, HandoverDraft>>;
  readonly onChange: (taskId: string, draft: HandoverDraft) => void;
  readonly selfUserId: string;
}

/**
 * For each task the leave touches, suggest who could cover it. These are
 * proposals: the colleague accepts and a manager applies them.
 */
export function HandoverProposals({
  conflicts,
  drafts,
  onChange,
  selfUserId,
}: HandoverProposalsProps) {
  const tasks = conflicts.filter(
    (conflict, index) => conflicts.findIndex((other) => other.taskId === conflict.taskId) === index,
  );
  if (tasks.length === 0) return null;
  return (
    <Section title="Suggest handovers" meta="optional">
      <AppText variant="bodySm" tone="secondary">
        Proposing someone now makes approval faster. Nothing is reassigned until it’s accepted.
      </AppText>
      {tasks.map((conflict) => {
        const draft = drafts[conflict.taskId] ?? { to: null, note: '' };
        return (
          <Card key={conflict.taskId} style={{ gap: SPACE.md }}>
            <View>
              <AppText variant="titleMd">{conflict.title}</AppText>
              <AppText variant="bodySm" tone="secondary">
                {conflict.projectName}
              </AppText>
            </View>
            <PersonPicker
              label="Who could cover it?"
              selected={draft.to}
              onSelect={(to) => onChange(conflict.taskId, { ...draft, to })}
              excludeUserIds={[selfUserId]}
            />
            {draft.to ? (
              <TextField
                label="Note for them (optional)"
                value={draft.note}
                onChangeText={(note) => onChange(conflict.taskId, { ...draft, note })}
                multiline
                maxLength={1000}
              />
            ) : null}
          </Card>
        );
      })}
    </Section>
  );
}
