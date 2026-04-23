import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import GlassCard from '@/components/GlassCard';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';

export interface DayEvent {
  type: 'workout' | 'run';
  id: string;
  name: string;
  subtitle: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  dateStr: string;
  events: DayEvent[];
  onSelectEvent: (event: DayEvent) => void;
}

function formatDateTitle(dateStr: string): string {
  if (!dateStr) return '';
  // dateStr is YYYY-MM-DD. Parse as local date by appending T00:00:00.
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function DayLogsSheet({ visible, onClose, dateStr, events, onSelectEvent }: Props) {
  const { colors, accent } = useZealTheme();

  const header = <DrawerHeader title={formatDateTitle(dateStr)} onClose={onClose} />;

  return (
    <BaseDrawer
      visible={visible}
      onClose={onClose}
      snapPoints={['45%']}
      header={header}
    >
      <View style={styles.content}>
        {events.map((event, index) => (
          <GlassCard
            key={event.id}
            style={[styles.row, index < events.length - 1 && styles.rowGap]}
            onPress={() => onSelectEvent(event)}
            activeOpacity={0.75}
          >
            <View style={styles.rowInner}>
              {/* Icon */}
              <View style={[styles.iconWrap, { backgroundColor: `${accent}18` }]}>
                <PlatformIcon
                  name={event.type === 'workout' ? 'dumbbell' : 'figure-run'}
                  size={20}
                  color={accent}
                />
              </View>

              {/* Text */}
              <View style={styles.textBlock}>
                <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={1}>
                  {event.name}
                </Text>
                <Text style={[styles.eventSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {event.subtitle}
                </Text>
              </View>

              {/* Chevron */}
              <PlatformIcon name="chevron-right" size={18} color={colors.textMuted} strokeWidth={2} />
            </View>
          </GlassCard>
        ))}
      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },
  row: {
    borderRadius: 18,
  },
  rowGap: {
    marginBottom: 10,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  eventName: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: -0.1,
  },
  eventSubtitle: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
  },
});
