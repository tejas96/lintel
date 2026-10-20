import type { ChecklistItem, TaskDetail } from '@lintel/api-contracts';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ProgressBar } from '@/components/progress-bar';
import { Divider, Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { haptics } from '@/feedback/haptics';
import { useToast } from '@/feedback/toast';
import { useAddChecklistItem, useToggleChecklistItem } from '@/queries/task-queries';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE, TOUCH_TARGET } from '@/theme/layout';

function ChecklistRow({
  item,
  onToggle,
  editable,
}: {
  readonly item: ChecklistItem;
  readonly onToggle: (item: ChecklistItem) => void;
  readonly editable: boolean;
}) {
  const { colors, status } = useAppTheme();
  const done = item.completedAt !== null;
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled: !editable }}
      accessibilityLabel={`${item.label}${item.isRequired ? ', required' : ''}`}
      disabled={!editable}
      onPress={() => onToggle(item)}
      pressedScale={0.98}
      style={styles.row}
    >
      <Icon
        name={done ? 'checkboxOn' : 'checkboxOff'}
        size={22}
        color={done ? status.onTrack.solid : colors.borderStrong}
      />
      <View style={styles.rowText}>
        <AppText
          variant="body"
          tone={done ? 'secondary' : 'primary'}
          style={done ? styles.doneText : null}
        >
          {item.label}
        </AppText>
        {item.isRequired && !done ? (
          <AppText variant="label" color={status.atRisk.fg}>
            Required before completion
          </AppText>
        ) : null}
        {done && item.completedBy ? (
          <AppText variant="label" tone="tertiary">
            Ticked by {item.completedBy.fullName}
          </AppText>
        ) : null}
      </View>
    </PressableScale>
  );
}

/** Ticks apply instantly and roll back with the server's reason if refused. */
export function ChecklistSection({ task }: { readonly task: TaskDetail }) {
  const toast = useToast();
  const toggle = useToggleChecklistItem(task.id);
  const add = useAddChecklistItem(task.id);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const items = [...task.checklistItems].sort((left, right) => left.position - right.position);
  const done = items.filter((item) => item.completedAt !== null).length;
  if (items.length === 0 && !task.viewerCanEdit) return null;

  const onToggle = (item: ChecklistItem) => {
    haptics.selection();
    toggle.mutate(
      { itemId: item.id, completed: item.completedAt === null },
      { onError: (error) => toast.show(errorMessage(error), 'error') },
    );
  };
  const submit = () => {
    const label = draft.trim();
    if (!label) return;
    add.mutate(label, {
      onSuccess: () => {
        setDraft('');
        setAdding(false);
      },
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });
  };

  return (
    <Section title="Checklist" meta={items.length > 0 ? `${done}/${items.length}` : undefined}>
      <Card style={styles.card}>
        {items.length > 0 ? (
          <ProgressBar
            value={items.length > 0 ? done / items.length : 0}
            accessibilityLabel={`${done} of ${items.length} checklist items done`}
            height={4}
          />
        ) : null}
        {items.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <Divider inset={34} /> : null}
            <ChecklistRow item={item} onToggle={onToggle} editable={task.viewerCanEdit} />
          </View>
        ))}
        {task.viewerCanEdit ? (
          adding ? (
            <View style={styles.addForm}>
              <TextField
                label="New item"
                value={draft}
                onChangeText={setDraft}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={submit}
                maxLength={200}
              />
              <View style={styles.addActions}>
                <Button
                  label="Add"
                  onPress={submit}
                  loading={add.isPending}
                  disabled={!draft.trim()}
                  fill
                />
                <Button label="Cancel" variant="secondary" onPress={() => setAdding(false)} fill />
              </View>
            </View>
          ) : (
            <Button
              label="Add an item"
              icon="add"
              variant="quiet"
              onPress={() => setAdding(true)}
            />
          )
        ) : null}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.xs },
  row: {
    flexDirection: 'row',
    gap: SPACE.md,
    alignItems: 'flex-start',
    minHeight: TOUCH_TARGET,
    paddingVertical: SPACE.sm,
  },
  rowText: { flex: 1, gap: 2 },
  doneText: { textDecorationLine: 'line-through' },
  addForm: { gap: SPACE.sm, paddingTop: SPACE.sm },
  addActions: { flexDirection: 'row', gap: SPACE.sm },
});
