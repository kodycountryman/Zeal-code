import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Modal } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useZealTheme } from '@/context/AppContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import { formatDateLabel, addDays, getTodayStr } from '@/services/nutritionUtils';

interface Props {
  date: string;
  onDateChange: (date: string) => void;
}

function dateStrToDate(str: string): Date {
  return new Date(str + 'T12:00:00');
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DayNavigator({ date, onDateChange }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const [pickerVisible, setPickerVisible] = useState(false);

  const isToday = date === getTodayStr();
  const label = formatDateLabel(date);

  const goBack = useCallback(() => {
    onDateChange(addDays(date, -1));
  }, [date, onDateChange]);

  const goForward = useCallback(() => {
    if (!isToday) {
      onDateChange(addDays(date, 1));
    }
  }, [date, isToday, onDateChange]);

  const handleDatePress = useCallback(() => {
    setPickerVisible(true);
  }, []);

  const handleDateChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') setPickerVisible(false);
      if (selectedDate) {
        onDateChange(dateToStr(selectedDate));
      }
    },
    [onDateChange],
  );

  const handlePickerClose = useCallback(() => {
    setPickerVisible(false);
  }, []);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={goBack}
        style={({ pressed }) => [styles.chevron, pressed && { opacity: 0.5 }]}
        hitSlop={12}
      >
        <PlatformIcon name="chevron-left" size={20} color={colors.text} />
      </Pressable>

      <Pressable onPress={handleDatePress} hitSlop={8}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      </Pressable>

      <Pressable
        onPress={goForward}
        style={({ pressed }) => [
          styles.chevron,
          pressed && { opacity: 0.5 },
          isToday && { opacity: 0.25 },
        ]}
        hitSlop={12}
        disabled={isToday}
      >
        <PlatformIcon name="chevron-right" size={20} color={colors.text} />
      </Pressable>

      {/* iOS: modal with inline picker */}
      {Platform.OS === 'ios' && pickerVisible && (
        <Modal transparent animationType="fade" visible>
          <Pressable style={styles.modalBackdrop} onPress={handlePickerClose}>
            <View style={[styles.pickerCard, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Date</Text>
                <Pressable onPress={handlePickerClose} hitSlop={8}>
                  <Text style={[styles.doneBtn, { color: accent }]}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={dateStrToDate(date)}
                mode="date"
                display="inline"
                onChange={handleDateChange}
                maximumDate={new Date()}
                themeVariant={isDark ? 'dark' : 'light'}
              />
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Android: native dialog */}
      {Platform.OS === 'android' && pickerVisible && (
        <DateTimePicker
          value={dateStrToDate(date)}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 8,
  },
  chevron: {
    padding: 4,
  },
  label: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 17,
    lineHeight: 22,
    minWidth: 120,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    borderRadius: 20,
    paddingBottom: 8,
    width: '90%',
    maxWidth: 380,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  pickerTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 17,
  },
  doneBtn: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 17,
  },
});
