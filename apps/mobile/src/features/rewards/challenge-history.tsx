import type { ChallengeEntry } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { StatusPill } from '@/components/status-pill';
import { formatInstant } from '@/formatting/dates';
import { useCurrentUser } from '@/session/session-provider';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import { challengeStatusPresentation } from '@/theme/status-vocabulary';
import { challengeOutcome } from './challenge-outcome';

function ChallengeItem({
  challenge,
  currency,
}: {
  readonly challenge: ChallengeEntry;
  readonly currency: string;
}) {
  const { colors } = useAppTheme();
  const user = useCurrentUser();
  const raisedBy =
    challenge.raisedBy === null || challenge.raisedBy.id === user.id
      ? 'Your challenge'
      : `Raised by ${challenge.raisedBy.fullName}`;
  const outcome = challengeOutcome(challenge, currency);
  return (
    <View style={[styles.item, { borderLeftColor: colors.borderStrong }]}>
      <AppText variant="label" tone="secondary">
        {raisedBy} · {formatInstant(challenge.createdAt)}
      </AppText>
      <StatusPill status={challengeStatusPresentation(challenge.status)} />
      <AppText variant="bodySm">“{challenge.reason}”</AppText>
      {challenge.resolvedAt ? (
        <View style={styles.answer}>
          <AppText variant="label" tone="secondary">
            {challenge.resolvedBy ? `${challenge.resolvedBy.fullName} answered` : 'Answered'} ·{' '}
            {formatInstant(challenge.resolvedAt)}
          </AppText>
          {challenge.resolutionNote ? (
            <AppText variant="bodySm">“{challenge.resolutionNote}”</AppText>
          ) : null}
          {outcome ? (
            <AppText variant="bodySm" tone="secondary">
              {outcome}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Every challenge of a record, oldest first, each with the reviewer's answer. */
export function ChallengeHistory({
  challenges,
  currency,
}: {
  readonly challenges: readonly ChallengeEntry[];
  readonly currency: string;
}) {
  if (challenges.length === 0) return null;
  return (
    <View style={styles.list}>
      <AppText variant="overline" tone="secondary">
        {challenges.length === 1 ? 'Challenge' : `Challenges · ${challenges.length}`}
      </AppText>
      {challenges.map((challenge) => (
        <ChallengeItem key={challenge.id} challenge={challenge} currency={currency} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.md },
  /** A drafting rule down the left edge ties the challenge to its answer. */
  item: { gap: SPACE.sm, borderLeftWidth: 2, paddingLeft: SPACE.md },
  answer: { gap: SPACE.xs, paddingTop: SPACE.xs },
});
