import { Platform } from 'react-native';

export const LOG_LEVEL = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  VERBOSE: 'VERBOSE',
} as const;

export interface CustomerInfo {
  entitlements: {
    active: Record<string, unknown>;
    all: Record<string, unknown>;
  };
}

export interface PurchasesPackage {
  identifier: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface PurchasesOfferings {
  current: {
    identifier: string;
    monthly: PurchasesPackage | null;
    availablePackages: PurchasesPackage[];
  } | null;
}

const webStub = {
  setLogLevel: (_level: unknown) => {
    console.log('[purchases-web] setLogLevel (no-op on web)');
  },
  configure: ({ apiKey }: { apiKey: string }) => {
    console.log('[purchases-web] configure (no-op on web), key provided:', !!apiKey);
  },
  getCustomerInfo: async (): Promise<CustomerInfo> => {
    console.log('[purchases-web] getCustomerInfo — returning empty entitlements');
    return { entitlements: { active: {}, all: {} } };
  },
  getOfferings: async (): Promise<PurchasesOfferings> => {
    console.log('[purchases-web] getOfferings — returning null');
    return { current: null };
  },
  purchasePackage: async (_pkg: PurchasesPackage): Promise<{ customerInfo: CustomerInfo }> => {
    console.warn('[purchases-web] purchasePackage — not available on web');
    throw new Error('In-app purchases are not available in the web preview.');
  },
  restorePurchases: async (): Promise<CustomerInfo> => {
    console.warn('[purchases-web] restorePurchases — not available on web');
    return { entitlements: { active: {}, all: {} } };
  },
};

let RCPurchases: typeof webStub = webStub;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RC = require('react-native-purchases').default;

    RCPurchases = {
      setLogLevel: (level: unknown) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { LOG_LEVEL: RCLogLevel } = require('react-native-purchases');
          const map: Record<string, unknown> = {
            DEBUG: RCLogLevel.DEBUG,
            INFO: RCLogLevel.INFO,
            WARN: RCLogLevel.WARN,
            ERROR: RCLogLevel.ERROR,
            VERBOSE: RCLogLevel.VERBOSE,
          };
          RC.setLogLevel(map[String(level)] ?? RCLogLevel.ERROR);
          console.log('[purchases-rc] setLogLevel:', level);
        } catch (e) {
          console.warn('[purchases-rc] setLogLevel failed:', e);
        }
      },

      configure: ({ apiKey }: { apiKey: string }) => {
        console.log('[purchases-rc] configure, key provided:', !!apiKey);
        RC.configure({ apiKey });
      },

      getCustomerInfo: async (): Promise<CustomerInfo> => {
        console.log('[purchases-rc] getCustomerInfo');
        const info = await RC.getCustomerInfo();
        console.log('[purchases-rc] active entitlements:', Object.keys(info.entitlements.active));
        return info as CustomerInfo;
      },

      getOfferings: async (): Promise<PurchasesOfferings> => {
        console.log('[purchases-rc] getOfferings');
        const offerings = await RC.getOfferings();
        console.log('[purchases-rc] current offering:', offerings?.current?.identifier ?? 'none');
        return offerings as PurchasesOfferings;
      },

      purchasePackage: async (pkg: PurchasesPackage): Promise<{ customerInfo: CustomerInfo }> => {
        console.log('[purchases-rc] purchasePackage:', pkg.identifier);
        const result = await RC.purchasePackage(pkg);
        console.log('[purchases-rc] purchase success, active entitlements:', Object.keys(result.customerInfo.entitlements.active));
        return result as { customerInfo: CustomerInfo };
      },

      restorePurchases: async (): Promise<CustomerInfo> => {
        console.log('[purchases-rc] restorePurchases');
        const info = await RC.restorePurchases();
        console.log('[purchases-rc] restore done, active entitlements:', Object.keys(info.entitlements.active));
        return info as CustomerInfo;
      },
    };

    console.log('[purchases-rc] react-native-purchases loaded successfully');
  } catch (e) {
    console.error('[purchases-rc] Failed to load react-native-purchases, falling back to stub:', e);
  }
}

export default RCPurchases;
