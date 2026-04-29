import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlatformIcon } from '@/components/PlatformIcon';
import type { AppIconName } from '@/constants/iconMap';

const { width: SW } = Dimensions.get('window');

interface Props {
  icon: AppIconName;
  iconAccent: string;
  title: string;
  body: string;
}

/**
 * One full-screen page in the walkthrough pager.
 *
 * Visual layout: large iconographic art block at top (60% of screen height),
 * headline + body text in the middle, dot indicator + CTA owned by the
 * parent pager screen.
 */
export default function WalkthroughPage({ icon, iconAccent, title, body }: Props) {
  return (
    <View style={[styles.page, { width: SW }]}>
      <View style={styles.artBlock}>
        <LinearGradient
          colors={[`${iconAccent}24`, `${iconAccent}06`, 'transparent']}
          style={styles.glow}
        />
        <View style={[styles.iconWrap, { borderColor: `${iconAccent}40` }]}>
          <PlatformIcon name={icon} size={68} color={iconAccent} strokeWidth={1.6} />
        </View>
      </View>

      <View style={styles.copyBlock}>
        <Text style={styles.title} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7}>{title}</Text>
        <Text style={styles.body} numberOfLines={5} adjustsFontSizeToFit minimumFontScale={0.85}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  artBlock: {
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
    transform: [{ scale: 1.4 }],
  },
  iconWrap: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBlock: {
    flex: 1,
    paddingTop: 12,
    gap: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontFamily: 'Outfit_700Bold',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
});
