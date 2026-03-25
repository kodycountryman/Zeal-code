import { Platform } from 'react-native';

export interface HealthPermissionResult {
  granted: boolean;
  error?: string;
}

export interface WorkoutWriteData {
  startDate: Date;
  endDate: Date;
  activityType: string;
  calories?: number;
  duration: number;
}

export interface HealthData {
  steps: number;
  activeCalories: number;
  restingHeartRate: number | null;
}

export interface HealthWorkoutSession {
  id: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  activityType: string;
  calories?: number;
  sourceName?: string;
}

function loadAppleHealthKit(): any {
  try {
    return require('react-native-health').default;
  } catch {
    console.log('[HealthService] react-native-health not available (Expo Go / web)');
    return null;
  }
}

function loadHealthConnect(): any {
  try {
    return require('react-native-health-connect');
  } catch {
    console.log('[HealthService] react-native-health-connect not available (Expo Go / web)');
    return null;
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

class HealthService {
  private _initialized = false;
  private _permissionsGranted = false;
  private _appleHealthKit: any = null;
  private _healthConnect: any = null;
  private _loadAttempted = false;

  private _ensureLoaded() {
    if (this._loadAttempted) return;
    this._loadAttempted = true;
    if (Platform.OS === 'ios') {
      this._appleHealthKit = loadAppleHealthKit();
    } else if (Platform.OS === 'android') {
      this._healthConnect = loadHealthConnect();
    }
  }

  isAvailable(): boolean {
    if (Platform.OS === 'web') return false;
    this._ensureLoaded();
    if (Platform.OS === 'ios') return this._appleHealthKit !== null;
    if (Platform.OS === 'android') return this._healthConnect !== null;
    return false;
  }

  isConnected(): boolean {
    return this._initialized && this._permissionsGranted;
  }

  setConnectedFromStorage(value: boolean) {
    if (value && this.isAvailable()) {
      this._initialized = true;
      this._permissionsGranted = true;
      console.log('[HealthService] Restored connected state from storage');
    }
  }

  async requestPermissions(): Promise<HealthPermissionResult> {
    console.log('[HealthService] Requesting permissions on', Platform.OS);
    this._ensureLoaded();
    try {
      if (Platform.OS === 'ios') return await this._requestHealthKit();
      if (Platform.OS === 'android') return await this._requestHealthConnect();
      return { granted: false, error: 'Health sync not supported on web' };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[HealthService] Permission error:', msg);
      return { granted: false, error: msg };
    }
  }

  private async _requestHealthKit(): Promise<HealthPermissionResult> {
    if (!this._appleHealthKit) {
      return { granted: false, error: 'Apple Health not available on this device or build' };
    }
    return new Promise((resolve) => {
      const AHK = this._appleHealthKit;
      const permissions = {
        permissions: {
          read: [
            AHK.Constants.Permissions.StepCount,
            AHK.Constants.Permissions.ActiveEnergyBurned,
            AHK.Constants.Permissions.RestingHeartRate,
            AHK.Constants.Permissions.HeartRate,
          ],
          write: [
            AHK.Constants.Permissions.Workout,
            AHK.Constants.Permissions.ActiveEnergyBurned,
          ],
        },
      };
      AHK.initHealthKit(permissions, (err: any) => {
        if (err) {
          console.log('[HealthService] HealthKit init error:', err);
          resolve({ granted: false, error: String(err) });
        } else {
          console.log('[HealthService] HealthKit initialized successfully');
          this._appleHealthKit = AHK;
          this._initialized = true;
          this._permissionsGranted = true;
          resolve({ granted: true });
        }
      });
    });
  }

  private async _requestHealthConnect(): Promise<HealthPermissionResult> {
    if (!this._healthConnect) {
      return { granted: false, error: 'Health Connect not available on this device or build' };
    }
    try {
      const { initialize, requestPermission } = this._healthConnect;
      console.log('[HealthService] Initializing Health Connect');
      await initialize();
      const results = await requestPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'read', recordType: 'RestingHeartRate' },
        { accessType: 'write', recordType: 'ExerciseSession' },
        { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
      ]);
      const allGranted = Array.isArray(results) && results.every((r: any) => r.granted);
      console.log('[HealthService] Health Connect permissions:', results);
      if (allGranted) {
        this._initialized = true;
        this._permissionsGranted = true;
      }
      return { granted: allGranted };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[HealthService] Health Connect error:', msg);
      return { granted: false, error: msg };
    }
  }

  async getSteps(date: Date = new Date()): Promise<number> {
    if (!this._initialized || !this._permissionsGranted) return 0;
    this._ensureLoaded();
    if (Platform.OS === 'ios' && this._appleHealthKit) {
      return new Promise((resolve) => {
        const options = { date: date.toISOString() };
        this._appleHealthKit.getStepCount(options, (err: any, result: any) => {
          if (err) { resolve(0); return; }
          resolve(result?.value ?? 0);
        });
      });
    }
    if (Platform.OS === 'android' && this._healthConnect) {
      try {
        const { readRecords } = this._healthConnect;
        const start = startOfToday();
        const { records } = await readRecords('Steps', {
          timeRangeFilter: {
            operator: 'between',
            startTime: start.toISOString(),
            endTime: date.toISOString(),
          },
        });
        return records.reduce((sum: number, r: any) => sum + (r.count ?? 0), 0);
      } catch (e) {
        console.log('[HealthService] getSteps Android error:', e);
        return 0;
      }
    }
    return 0;
  }

  async getActiveEnergy(date: Date = new Date()): Promise<number> {
    if (!this._initialized || !this._permissionsGranted) return 0;
    this._ensureLoaded();
    if (Platform.OS === 'ios' && this._appleHealthKit) {
      return new Promise((resolve) => {
        const start = startOfToday();
        const options = {
          startDate: start.toISOString(),
          endDate: date.toISOString(),
          ascending: false,
          limit: 0,
        };
        this._appleHealthKit.getActiveEnergyBurned(options, (err: any, results: any[]) => {
          if (err || !results?.length) { resolve(0); return; }
          const total = results.reduce((sum: number, r: any) => sum + (r.value ?? 0), 0);
          resolve(Math.round(total));
        });
      });
    }
    if (Platform.OS === 'android' && this._healthConnect) {
      try {
        const { readRecords } = this._healthConnect;
        const start = startOfToday();
        const { records } = await readRecords('ActiveCaloriesBurned', {
          timeRangeFilter: {
            operator: 'between',
            startTime: start.toISOString(),
            endTime: date.toISOString(),
          },
        });
        const total = records.reduce((sum: number, r: any) => sum + (r.energy?.inKilocalories ?? 0), 0);
        return Math.round(total);
      } catch (e) {
        console.log('[HealthService] getActiveEnergy Android error:', e);
        return 0;
      }
    }
    return 0;
  }

  async getHeartRate(date: Date = new Date()): Promise<number | null> {
    if (!this._initialized || !this._permissionsGranted) return null;
    this._ensureLoaded();
    if (Platform.OS === 'ios' && this._appleHealthKit) {
      return new Promise((resolve) => {
        const sevenDaysAgo = new Date(date);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const options = {
          startDate: sevenDaysAgo.toISOString(),
          endDate: date.toISOString(),
          ascending: false,
          limit: 5,
        };
        this._appleHealthKit.getHeartRateSamples(options, (err: any, results: any[]) => {
          if (err || !results?.length) { resolve(null); return; }
          const avg = results.reduce((sum: number, r: any) => sum + (r.value ?? 0), 0) / results.length;
          resolve(Math.round(avg) || null);
        });
      });
    }
    if (Platform.OS === 'android' && this._healthConnect) {
      try {
        const { readRecords } = this._healthConnect;
        const sevenDaysAgo = new Date(date);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { records } = await readRecords('RestingHeartRate', {
          timeRangeFilter: {
            operator: 'between',
            startTime: sevenDaysAgo.toISOString(),
            endTime: date.toISOString(),
          },
        });
        if (!records.length) return null;
        const latest = records[records.length - 1];
        return Math.round(latest.beatsPerMinute ?? 0) || null;
      } catch (e) {
        console.log('[HealthService] getHeartRate Android error:', e);
        return null;
      }
    }
    return null;
  }

  async getAllHealthData(): Promise<HealthData> {
    const now = new Date();
    const [steps, activeCalories, restingHeartRate] = await Promise.all([
      this.getSteps(now),
      this.getActiveEnergy(now),
      this.getHeartRate(now),
    ]);
    return { steps, activeCalories, restingHeartRate };
  }

  async getRecentWorkouts(days: number = 7): Promise<HealthWorkoutSession[]> {
    if (!this._initialized || !this._permissionsGranted) {
      console.log('[HealthService] getRecentWorkouts skipped — not connected');
      return [];
    }
    this._ensureLoaded();
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    console.log('[HealthService] Reading workouts since', since.toISOString());

    if (Platform.OS === 'ios' && this._appleHealthKit) {
      return new Promise((resolve) => {
        const options = {
          startDate: since.toISOString(),
          endDate: now.toISOString(),
          ascending: false,
          limit: 50,
        };
        this._appleHealthKit.getWorkoutSamples(options, (err: any, results: any[]) => {
          if (err || !Array.isArray(results)) {
            console.log('[HealthService] getWorkoutSamples error:', err);
            resolve([]);
            return;
          }
          const sessions: HealthWorkoutSession[] = results.map((r: any, idx: number) => {
            const start = new Date(r.start ?? r.startDate ?? since);
            const end = new Date(r.end ?? r.endDate ?? now);
            const durationMin = Math.round((end.getTime() - start.getTime()) / 60000) || Math.round((r.duration ?? 0) / 60);
            return {
              id: r.id ?? `ahk_${idx}_${start.getTime()}`,
              startDate: start,
              endDate: end,
              duration: durationMin,
              activityType: r.activityName ?? r.activityType ?? 'Workout',
              calories: r.calories ?? r.totalEnergyBurned ?? undefined,
              sourceName: r.sourceName ?? r.device ?? undefined,
            };
          }).filter(s => s.duration > 0);
          console.log('[HealthService] iOS workouts found:', sessions.length);
          resolve(sessions);
        });
      });
    }

    if (Platform.OS === 'android' && this._healthConnect) {
      try {
        const { readRecords } = this._healthConnect;
        const { records } = await readRecords('ExerciseSession', {
          timeRangeFilter: {
            operator: 'between',
            startTime: since.toISOString(),
            endTime: now.toISOString(),
          },
        });
        const sessions: HealthWorkoutSession[] = (records as any[]).map((r: any, idx: number) => {
          const start = new Date(r.startTime);
          const end = new Date(r.endTime);
          const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
          return {
            id: r.metadata?.id ?? `hc_${idx}_${start.getTime()}`,
            startDate: start,
            endDate: end,
            duration: durationMin,
            activityType: r.title ?? String(r.exerciseType ?? 'Workout'),
            calories: undefined,
            sourceName: r.metadata?.dataOrigin ?? undefined,
          };
        }).filter((s: HealthWorkoutSession) => s.duration > 0);
        console.log('[HealthService] Android workouts found:', sessions.length);
        return sessions;
      } catch (e) {
        console.log('[HealthService] getRecentWorkouts Android error:', e);
        return [];
      }
    }
    return [];
  }

  async writeWorkout(data: WorkoutWriteData): Promise<boolean> {
    if (!this._initialized || !this._permissionsGranted) {
      console.log('[HealthService] writeWorkout skipped — not connected');
      return false;
    }
    this._ensureLoaded();
    console.log('[HealthService] Writing workout:', data.activityType, data.duration, 'min');
    if (Platform.OS === 'ios' && this._appleHealthKit) {
      return new Promise((resolve) => {
        const options = {
          type: this._mapActivityTypeIOS(data.activityType),
          startDate: data.startDate.toISOString(),
          endDate: data.endDate.toISOString(),
          duration: data.duration,
          energyBurned: data.calories ?? 0,
          energyBurnedUnit: 'calorie',
        };
        this._appleHealthKit.saveWorkout(options, (err: any, result: any) => {
          if (err) {
            console.log('[HealthService] writeWorkout iOS error:', err);
            resolve(false);
          } else {
            console.log('[HealthService] writeWorkout iOS success:', result);
            resolve(true);
          }
        });
      });
    }
    if (Platform.OS === 'android' && this._healthConnect) {
      try {
        const { insertRecords } = this._healthConnect;
        await insertRecords([
          {
            recordType: 'ExerciseSession',
            startTime: data.startDate.toISOString(),
            endTime: data.endDate.toISOString(),
            exerciseType: this._mapActivityTypeAndroid(data.activityType),
            title: data.activityType,
          },
        ]);
        console.log('[HealthService] writeWorkout Android success');
        return true;
      } catch (e: unknown) {
        console.log('[HealthService] writeWorkout Android error:', e);
        return false;
      }
    }
    return false;
  }

  private _mapActivityTypeIOS(style: string): string {
    const map: Record<string, string> = {
      Strength: 'TraditionalStrengthTraining',
      Bodybuilding: 'TraditionalStrengthTraining',
      CrossFit: 'CrossTraining',
      HIIT: 'HighIntensityIntervalTraining',
      Cardio: 'Running',
      Hyrox: 'CrossTraining',
      Mobility: 'Flexibility',
      Pilates: 'Pilates',
    };
    return map[style] ?? 'Fitness';
  }

  private _mapActivityTypeAndroid(style: string): number {
    const map: Record<string, number> = {
      Strength: 80,
      Bodybuilding: 80,
      CrossFit: 3,
      HIIT: 60,
      Cardio: 66,
      Hyrox: 60,
      Mobility: 44,
      Pilates: 52,
    };
    return map[style] ?? 4;
  }
}

export const healthService = new HealthService();
