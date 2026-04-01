import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type MetricSlotKey,
  DEFAULT_METRIC_SLOTS,
  METRIC_SLOT_STORAGE_KEY,
} from '@/constants/metricSlots';

/**
 * Persists the user's 4 metric slot configuration to AsyncStorage.
 * Slots can hold any MetricSlotKey or null (empty / showing "+").
 *
 * Default: ['streak', null, null, null]
 */
export function useMetricSlots() {
  const [slots, setSlots] = useState<(MetricSlotKey | null)[]>(DEFAULT_METRIC_SLOTS);
  const [loaded, setLoaded] = useState(false);

  // Load persisted config on mount
  useEffect(() => {
    AsyncStorage.getItem(METRIC_SLOT_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as (MetricSlotKey | null)[];
            // Validate: must be array of exactly 4 items
            if (Array.isArray(parsed) && parsed.length === 4) {
              setSlots(parsed);
            }
          } catch {
            // Corrupt data — fall back to defaults
          }
        }
      })
      .catch(console.warn)
      .finally(() => setLoaded(true));
  }, []);

  /** Update a single slot by index (0–3). Pass null to clear it. */
  const updateSlot = useCallback((index: number, key: MetricSlotKey | null) => {
    if (index < 0 || index > 3) return;
    setSlots((prev) => {
      const next = [...prev] as (MetricSlotKey | null)[];
      next[index] = key;
      AsyncStorage.setItem(METRIC_SLOT_STORAGE_KEY, JSON.stringify(next)).catch(
        console.warn,
      );
      return next;
    });
  }, []);

  /** Clear all 4 slots back to defaults */
  const resetSlots = useCallback(() => {
    setSlots(DEFAULT_METRIC_SLOTS);
    AsyncStorage.setItem(
      METRIC_SLOT_STORAGE_KEY,
      JSON.stringify(DEFAULT_METRIC_SLOTS),
    ).catch(console.warn);
  }, []);

  return { slots, updateSlot, resetSlots, loaded };
}
