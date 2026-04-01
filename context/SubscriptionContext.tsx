import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PurchasesWrapper from '@/services/purchases';

export type SubscriptionState = 'never_seen' | 'active' | 'lapsed';
export type PaywallVersion = 'trial' | 'no_trial';

const STORAGE_KEY = '@zeal_subscription_v2';

// Set to false before any TestFlight / App Store submission.
const DEV_FORCE_PRO: boolean | null = false;

interface PersistedState {
  hasEverStarted: boolean;
  appOpenCount: number;
  lastPaywallShownAtOpenCount: number;
}

const DEFAULT_PERSISTED: PersistedState = {
  hasEverStarted: false,
  appOpenCount: 0,
  lastPaywallShownAtOpenCount: -99,
};

function getRCApiKey(): string {
  const testKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ?? '';

  // Use the test key only when explicitly available; otherwise fall back to native keys.
  // This prevents the "no singleton instance" error when running dev builds without env vars set.
  if (Platform.OS === 'web') return testKey;
  if (__DEV__ && testKey) return testKey;

  return Platform.select({
    ios: 'appl_TfLZeJsUZikUiPDhmQZAHyUCvrm',
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '',
    default: testKey,
  }) ?? '';
}



try {
  const key = getRCApiKey();
  console.log('[subscription] RC configure attempt', {
    hasKey: Boolean(key),
    platform: Platform.OS,
    isDev: __DEV__,
  });
  if (key) {
    PurchasesWrapper.configure({ apiKey: key });
    console.log('[subscription] RevenueCat configured');
  } else {
    console.warn('[subscription] RevenueCat API key is empty; skipping RC.configure');
  }
} catch (e) {
  console.warn('[subscription] RC configure failed:', e);
}

export const [SubscriptionProvider, useSubscription] = createContextHook(() => {
  const queryClient = useQueryClient();
  const hasTriggeredThisSession = useRef(false);
  const paywallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [persisted, setPersisted] = useState<PersistedState>(DEFAULT_PERSISTED);
  const [persistedLoaded, setPersistedLoaded] = useState(false);

  const persistedRef = useRef(persisted);
  persistedRef.current = persisted;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PersistedState>;
          setPersisted({ ...DEFAULT_PERSISTED, ...parsed });
        }
      } catch (e) {
        console.warn('[subscription] Failed to load persisted state:', e);
      }
      setPersistedLoaded(true);
    })();
  }, []);

  const savePersisted = useCallback(async (state: PersistedState) => {
    setPersisted(state);
    persistedRef.current = state;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[subscription] Failed to save state:', e);
    }
  }, []);

  const customerInfoQuery = useQuery({
    queryKey: ['rc_customer_info'],
    queryFn: () => PurchasesWrapper.getCustomerInfo(),
    retry: 1,
    staleTime: 30_000,
    enabled: persistedLoaded,
  });

  const proStatusReady = persistedLoaded && (customerInfoQuery.isSuccess || customerInfoQuery.isError);

  const hasPro = __DEV__ && DEV_FORCE_PRO !== null
    ? DEV_FORCE_PRO
    : customerInfoQuery.isSuccess && Boolean(customerInfoQuery.data?.entitlements.active['pro']);

  const hasPro_ref = useRef(hasPro);
  hasPro_ref.current = hasPro;

  useEffect(() => {
    return () => {
      if (paywallTimerRef.current) clearTimeout(paywallTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (customerInfoQuery.isSuccess && hasPro && persistedLoaded) {
      const p = persistedRef.current;
      if (!p.hasEverStarted) {
        console.log('[subscription] Syncing hasEverStarted from RC');
        savePersisted({ ...p, hasEverStarted: true });
      }
    }
  }, [hasPro, persistedLoaded, customerInfoQuery.isSuccess, savePersisted]);

  const deriveState = useCallback((p: PersistedState, hp: boolean): SubscriptionState => {
    if (hp) return 'active';
    if (p.hasEverStarted) return 'lapsed';
    return 'never_seen';
  }, []);

  const subscriptionState = deriveState(persisted, hasPro);
  const paywallVersion: PaywallVersion = subscriptionState === 'never_seen' ? 'trial' : 'no_trial';

  const offeringsQuery = useQuery({
    queryKey: ['rc_offerings'],
    queryFn: () => PurchasesWrapper.getOfferings(),
    retry: 1,
    staleTime: 300_000,
    enabled: persistedLoaded,
  });

  const triggerAppOpen = useCallback(async () => {
    if (hasTriggeredThisSession.current) return;
    if (!persistedLoaded) return;
    hasTriggeredThisSession.current = true;

    const p = persistedRef.current;
    const hp = hasPro_ref.current;
    const newCount = p.appOpenCount + 1;
    const next: PersistedState = { ...p, appOpenCount: newCount };

    const state = deriveState(next, hp);
    console.log('[subscription] App open #', newCount, '| state:', state);

    if (state === 'active') {
      await savePersisted(next);
      return;
    }

    let shouldShow = false;
    if (state === 'never_seen') {
      shouldShow = newCount >= 3; // soft sell — let user explore first
    } else {
      const opensSinceLast = newCount - p.lastPaywallShownAtOpenCount;
      shouldShow = opensSinceLast >= 7;
    }

    if (shouldShow) {
      await savePersisted({ ...next, lastPaywallShownAtOpenCount: newCount });
      if (paywallTimerRef.current) clearTimeout(paywallTimerRef.current);
      paywallTimerRef.current = setTimeout(() => setPaywallOpen(true), 7000);
    } else {
      await savePersisted(next);
    }
  }, [persistedLoaded, savePersisted, deriveState]);

  const openPaywall = useCallback(() => {
    console.log('[subscription] Manual paywall open');
    setPaywallOpen(true);
  }, []);

  const closePaywall = useCallback(() => {
    console.log('[subscription] Paywall closed');
    setPaywallOpen(false);
  }, []);

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      console.log('[subscription] Fetching offerings live before purchase...');
      let offerings = offeringsQuery.data;
      if (!offerings?.current) {
        offerings = await PurchasesWrapper.getOfferings();
        console.log('[subscription] Live offerings fetch — current:', offerings?.current?.identifier ?? 'none');
        queryClient.setQueryData(['rc_offerings'], offerings);
      }
      const pkg =
        offerings?.current?.monthly ??
        offerings?.current?.availablePackages?.[0] ??
        null;
      if (!pkg) {
        console.warn('[subscription] No package found. availablePackages:', offerings?.current?.availablePackages?.length ?? 0);
        throw new Error('No packages found in this offering. Please check your RevenueCat dashboard configuration.');
      }
      console.log('[subscription] Purchasing package:', pkg.identifier);
      return PurchasesWrapper.purchasePackage(pkg);
    },
    onSuccess: async (result) => {
      const isActive = Boolean(result.customerInfo.entitlements.active['pro']);
      console.log('[subscription] Purchase result — hasPro:', isActive);
      const p = persistedRef.current;
      await savePersisted({ ...p, hasEverStarted: true });
      await queryClient.invalidateQueries({ queryKey: ['rc_customer_info'] });
      if (isActive) {
        setPaywallOpen(false);
      }
    },
    onError: (e) => {
      console.warn('[subscription] Purchase error:', e);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => PurchasesWrapper.restorePurchases(),
    onSuccess: async (customerInfo) => {
      const isActive = Boolean(customerInfo.entitlements.active['pro']);
      console.log('[subscription] Restore result — hasPro:', isActive);
      if (isActive) {
        const p = persistedRef.current;
        await savePersisted({ ...p, hasEverStarted: true });
        await queryClient.invalidateQueries({ queryKey: ['rc_customer_info'] });
        setPaywallOpen(false);
      }
    },
    onError: (e) => {
      console.warn('[subscription] Restore error:', e);
    },
  });

  return {
    subscriptionState,
    hasPro,
    proStatusReady,
    paywallVersion,
    paywallOpen,
    openPaywall,
    closePaywall,
    triggerAppOpen,
    startPurchase: () => purchaseMutation.mutate(),
    isPurchasing: purchaseMutation.isPending,
    purchaseError: purchaseMutation.error ? String(purchaseMutation.error) : null,
    restorePurchases: () => restoreMutation.mutate(),
    isRestoring: restoreMutation.isPending,
    restoreError: restoreMutation.error ? String(restoreMutation.error) : null,
    loaded: persistedLoaded,
    offerings: offeringsQuery.data ?? null,
  };
});
