import React, { useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { useZealTheme } from '@/context/AppContext';
import { useRun } from '@/context/RunContext';
import RunSummary from '@/components/run/RunSummary';
import { RunLog } from '@/types/run';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The run to display. Caller should clear this when the drawer closes. */
  runId: string | null;
}

export default function RunLogDrawer({ visible, onClose, runId }: Props) {
  const { colors } = useZealTheme();
  const run = useRun();

  // Resolve the log from run history
  const log: RunLog | null = useMemo(() => {
    if (!runId) return null;
    return run.runHistory.find(r => r.id === runId) ?? null;
  }, [run.runHistory, runId]);

  const handleDelete = useCallback(async () => {
    if (!log) return;
    await run.deleteRun(log.id);
    onClose();
  }, [log, run, onClose]);

  const handleSaveEdits = useCallback(
    async (updates: { rating: number | null; notes: string }) => {
      if (!log) return;
      await run.updateRun(log.id, {
        rating: updates.rating,
        notes: updates.notes,
      });
    },
    [log, run],
  );

  const title = useMemo(() => {
    if (!log) return 'Run';
    const d = new Date(log.startTime);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
    if (diffDays === 0) return "Today's Run";
    if (diffDays === 1) return "Yesterday's Run";
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [log]);

  const header = <DrawerHeader title={title} onClose={onClose} />;

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={header}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
      >
        {log ? (
          <>
            {log.isTentative && (
              <View style={{ backgroundColor: '#f59e0b20', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#f59e0b40', marginBottom: 12 }}>
                <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 12, color: '#f59e0b' }}>
                  Unsaved draft — this run was auto-saved. Tap ··· to complete or delete it.
                </Text>
              </View>
            )}
            <RunSummary
              log={log}
              mode="log_view"
              editable
              onSaveEdits={handleSaveEdits}
              onDelete={handleDelete}
            />
          </>
        ) : (
          <View style={{ padding: 20 }} />
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
});
