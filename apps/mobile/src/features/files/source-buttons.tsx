import { StyleSheet, View } from 'react-native';
import type { LocalFile } from '@/api/file-transfer';
import { Button } from '@/components/button';
import { useToast } from '@/feedback/toast';
import { SPACE } from '@/theme/layout';
import { type FileSource, pickFiles } from './pick-files';

export interface SourceButtonsProps {
  readonly onPicked: (files: readonly LocalFile[]) => void;
  readonly multiple?: boolean;
  readonly limit?: number;
  readonly allowDocuments?: boolean;
  readonly disabled?: boolean;
}

/** Camera, Photos and Files side by side — no hidden menu to discover. */
export function SourceButtons({
  onPicked,
  multiple = false,
  limit = 1,
  allowDocuments = true,
  disabled = false,
}: SourceButtonsProps) {
  const toast = useToast();
  const pick = async (source: FileSource) => {
    try {
      const result = await pickFiles(source, { multiple, limit });
      if (result.outcome === 'picked' && result.files.length > 0) onPicked(result.files);
      if (result.outcome === 'denied') toast.show(result.message, 'info');
    } catch {
      toast.show('That file couldn’t be opened. Try another one.', 'error');
    }
  };
  return (
    <View style={styles.row}>
      <Button
        label="Camera"
        icon="camera"
        variant="secondary"
        onPress={() => void pick('camera')}
        disabled={disabled}
        fill
      />
      <Button
        label="Photos"
        icon="photo"
        variant="secondary"
        onPress={() => void pick('library')}
        disabled={disabled}
        fill
      />
      {allowDocuments ? (
        <Button
          label="Files"
          icon="document"
          variant="secondary"
          onPress={() => void pick('document')}
          disabled={disabled}
          fill
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: SPACE.sm } });
