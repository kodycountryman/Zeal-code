import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useZealTheme } from '@/context/AppContext';
import { useNutrition } from '@/context/NutritionContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import { generateId } from '@/services/nutritionUtils';

// ─── Open Food Facts lookup ──────────────────────────────

async function lookupBarcode(barcode: string) {
  const resp = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
  );
  if (!resp.ok) return null;

  const data = await resp.json();
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const nutrients = p.nutriments ?? {};

  return {
    name: p.product_name || p.generic_name || 'Unknown Product',
    brand: p.brands || undefined,
    barcode,
    servingGrams: parseFloat(p.serving_quantity) || 100,
    servingLabel: p.serving_size || '100g',
    nutrientsPer100g: {
      calories: nutrients['energy-kcal_100g'] ?? 0,
      protein: nutrients.proteins_100g ?? 0,
      fat: nutrients.fat_100g ?? 0,
      carbs: nutrients.carbohydrates_100g ?? 0,
      fiber: nutrients.fiber_100g ?? 0,
      sugar: nutrients.sugars_100g ?? 0,
    },
  };
}

// ─── Component ───────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function BarcodeScanner({ visible, onClose }: Props) {
  const { colors, accent } = useZealTheme();
  const { selectedMealType, addMealEntry, setManualFoodEntryVisible } = useNutrition();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleBarCodeScanned = useCallback(
    async ({ data: barcode }: { data: string }) => {
      if (!scanning || loading) return;
      setScanning(false);
      setLoading(true);

      try {
        const product = await lookupBarcode(barcode);

        if (!product) {
          Alert.alert('Not Found', 'This product was not found in the database.', [
            { text: 'Scan Again', onPress: () => { setScanning(true); setLoading(false); } },
            {
              text: 'Enter Manually',
              onPress: () => {
                onClose();
                setTimeout(() => setManualFoodEntryVisible(true), 300);
              },
            },
          ]);
          return;
        }

        if (!selectedMealType) {
          setLoading(false);
          onClose();
          return;
        }

        const foodItem = {
          id: generateId(),
          name: product.name,
          brand: product.brand,
          barcode: product.barcode,
          servingSizes: [{ label: product.servingLabel, grams: product.servingGrams }],
          nutrientsPer100g: product.nutrientsPer100g,
          source: 'openfoodfacts' as const,
        };

        addMealEntry(foodItem, selectedMealType, {
          servingSize: { label: product.servingLabel, grams: product.servingGrams },
          quantity: 1,
        });

        Alert.alert(
          'Added!',
          `${product.name} logged to ${selectedMealType}.`,
          [{ text: 'OK', onPress: onClose }],
        );
      } catch (e) {
        __DEV__ && console.error('[BarcodeScanner] Error:', e);
        Alert.alert('Error', 'Failed to look up barcode. Please try again.', [
          { text: 'OK', onPress: () => { setScanning(true); setLoading(false); } },
        ]);
      }
    },
    [scanning, loading, selectedMealType, addMealEntry, onClose],
  );

  const handleClose = useCallback(() => {
    setScanning(true);
    setLoading(false);
    onClose();
  }, [onClose]);

  if (!visible) return null;

  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <View style={[styles.permissionWrap, { backgroundColor: colors.background }]}>
          <Text style={[styles.permissionTitle, { color: colors.text }]}>Camera Access Needed</Text>
          <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
            Allow camera access to scan product barcodes.
          </Text>
          <TouchableOpacity
            style={[styles.permissionBtn, { backgroundColor: accent }]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionBtnText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose}>
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
          }}
          onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
        />

        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <PlatformIcon name="x" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Scan Barcode</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Center reticle */}
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>

          {/* Bottom text */}
          <View style={styles.bottomBar}>
            {loading ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <Text style={styles.hint}>Point at a barcode</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const CORNER_SIZE = 24;
const CORNER_WIDTH = 3;
const CORNER_COLOR = '#f87116';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: '#fff',
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
  },
  reticle: {
    width: 260,
    height: 160,
    alignSelf: 'center',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: CORNER_COLOR,
    borderTopLeftRadius: 8,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: CORNER_COLOR,
    borderTopRightRadius: 8,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: CORNER_COLOR,
    borderBottomLeftRadius: 8,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: CORNER_COLOR,
    borderBottomRightRadius: 8,
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 80,
  },
  hint: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Outfit_500Medium',
    fontSize: 16,
  },
  permissionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  permissionTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
  },
  permissionText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    textAlign: 'center',
  },
  permissionBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 20,
    marginTop: 8,
  },
  permissionBtnText: {
    color: '#fff',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  cancelText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    marginTop: 12,
  },
});
