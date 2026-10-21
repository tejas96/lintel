import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Divider } from '@/components/section';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import type { CriterionFinding } from './reward-records';

function FindingRow({ finding }: { readonly finding: CriterionFinding }) {
  const { colors, status } = useAppTheme();
  const tone = finding.passed ? status.onTrack.fg : colors.textSecondary;
  const verdict = finding.passed ? 'Met' : 'Not met';
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${finding.label}: ${verdict}. ${finding.actual}, needs ${finding.required}. ${finding.explanation}`}
    >
      <Icon
        name={finding.passed ? 'done' : 'notMet'}
        size={18}
        color={tone}
        weight="medium"
        style={styles.glyph}
      />
      <View style={styles.text}>
        <AppText variant="bodySm">
          {finding.label}
          <AppText variant="label" color={tone}>
            {`  ${verdict}`}
          </AppText>
        </AppText>
        <AppText variant="bodySm" tone="secondary">
          {finding.explanation}
        </AppText>
      </View>
      <View style={styles.figures}>
        <AppText variant="displayMd" style={styles.actual}>
          {finding.actual}
        </AppText>
        <AppText variant="label" tone="tertiary" align="right">
          needs {finding.required}
        </AppText>
      </View>
    </View>
  );
}

/**
 * What the rules found, criterion by criterion: met or not met in words and a
 * glyph (never colour alone), the measured figure and what was needed.
 */
export function CriteriaFindings({ findings }: { readonly findings: readonly CriterionFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <View>
      {findings.map((finding, index) => (
        <View key={finding.type}>
          {index > 0 ? <Divider inset={30} /> : null}
          <FindingRow finding={finding} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, paddingVertical: SPACE.md },
  glyph: { marginTop: 1 },
  text: { flex: 1, gap: 2 },
  figures: { alignItems: 'flex-end', maxWidth: '38%', gap: 2 },
  /** The measured figure in the display serif, a step below the card's amount. */
  actual: { fontSize: 20, lineHeight: 24, textAlign: 'right' },
});
