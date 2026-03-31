import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Linking,
} from 'react-native';
import { X, ChevronDown, Star, MessageCircle } from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import BaseDrawer from '@/components/drawers/BaseDrawer';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type TabKey = 'faq' | 'reviews' | 'science';

interface FaqItem {
  question: string;
  answer: string;
}

interface ReviewItem {
  stars: number;
  text: string;
  name: string;
}

interface ScienceCard {
  style: string;
  color: string;
  researcher: string;
  description: string;
  benefits: string[];
}

const FAQ_DATA: FaqItem[] = [
  {
    question: 'How does zeal generate my workouts?',
    answer: 'Zeal uses a local workout science engine that builds your session based on your selected style, training split, and target duration. A time-budget model allocates minutes to warm-up, main work, and cool-down. The rest slider adjusts recovery between sets, and equipment filtering ensures only exercises matching your available gear are included. Style-specific rules (e.g., CrossFit metcon structure, Bodybuilding volume targets) shape the final workout.',
  },
  {
    question: 'Can I use zeal without a gym membership?',
    answer: 'Absolutely. Zeal supports bodyweight-only training and home equipment setups. Use the Equipment Selector in Settings to mark what you have available (dumbbells, kettlebells, bands, pull-up bar, etc.) and the engine will only generate exercises you can actually do. Select "Bodyweight" as your equipment profile for zero-equipment workouts.',
  },
  {
    question: 'How does the streak system work?',
    answer: 'Your streak starts at 1 on your first app open. Complete at least one workout per day to keep it growing. You have a 3-day grace period before your streak resets, so missing a day or two won\'t break it. The streak counter updates after each completed and saved workout.',
  },
  {
    question: 'Can I switch workout styles?',
    answer: 'Yes, you can switch styles anytime through the Modify Workout button on the Workout tab or through Settings. When you change styles, zeal automatically regenerates your workout to match the new style\'s programming rules, rep ranges, and exercise selection.',
  },
  {
    question: 'What fitness level should I choose?',
    answer: 'Beginner: Less than 1 year of consistent training. Simpler exercises, lower volume, more guidance. Intermediate: 1-3 years of experience. Moderate complexity and loading. Advanced: 3+ years. Higher volume, complex movements, heavier relative loading. Your level affects exercise selection, set/rep schemes, and progressive overload suggestions.',
  },
  {
    question: 'Is my data private and secure?',
    answer: 'All your workout data, preferences, and progress are stored locally on your device. No account is required to use zeal. Nothing is sent to external servers. Your training history, personal records, and settings never leave your phone.',
  },
  {
    question: 'How does the feedback system improve my workouts?',
    answer: 'After each workout, your star rating affects your training score multiplier (1 star = 0.8x, 5 stars = 1.4x). Liked exercises are prioritized in future generation, while disliked exercises are deprioritized. Your RPE (Rate of Perceived Exertion) is tracked over time to help gauge intensity trends across sessions.',
  },
  {
    question: 'Can I swap exercises I don\'t like or don\'t have equipment for?',
    answer: 'Yes. Every exercise has a swap icon that lets you replace it with an alternative targeting the same muscle group. You can also dislike exercises in the Exercise Catalog to permanently exclude them from future workouts. The equipment filter automatically removes exercises requiring gear you don\'t have.',
  },
  {
    question: 'How do I track previous workouts?',
    answer: 'Use "Log Previous Workout" from the + menu on the floating dock. Select a past date, choose the workout style, set the duration, and pick the muscle groups trained. This logs the session to your calendar and contributes to your training score and streak history.',
  },
];

const REVIEWS_DATA: ReviewItem[] = [
  {
    stars: 5,
    text: 'Finally an app that generates workouts that actually feel like they were programmed by someone who knows what they\'re doing. The WODs are creative and the scaling is spot on.',
    name: 'Sarah M.',
  },
  {
    stars: 5,
    text: 'The RPE-based loading is dialed in. It\'s the first app I\'ve used that actually understands powerlifting \u2014 not just do 3 sets of squats. The competition lift structure is exactly what I needed.',
    name: 'James R.',
  },
  {
    stars: 5,
    text: 'I\'ve tried dozens of fitness apps. zeal is the only one that programs Pilates with real intention \u2014 spiral stabilization, breathing cues, progressive difficulty. It feels like a real instructor wrote it.',
    name: 'Priya L.',
  },
  {
    stars: 5,
    text: 'Training for my first Hyrox race and the race simulations are incredible. Sled pushes, farmer carries, ski erg intervals \u2014 all structured with real conditioning periodization. No other app does this.',
    name: 'Marcus D.',
  },
];

const SCIENCE_DATA: ScienceCard[] = [
  {
    style: 'Strength',
    color: WORKOUT_STYLE_COLORS['Strength'],
    researcher: 'Mark Rippetoe & NSCA-CSCS Framework',
    description: 'Built on Starting Strength principles and NSCA periodization science. Compound barbell movements with progressive overload form the foundation. Research consistently shows multi-joint strength training produces superior gains in force production and structural health.',
    benefits: ['Proven compound-lift focused programming', 'Builds functional strength in everyday life', 'Reduces injury risk across all sports'],
  },
  {
    style: 'Bodybuilding',
    color: WORKOUT_STYLE_COLORS['Bodybuilding'],
    researcher: 'Boris Sheiko, Westside Barbell & Juggernaut Method',
    description: 'Hypertrophy programming rooted in evidence-based volume landmarks, the conjugate method, and Chad Wesley Buffers\' auto-regulation refinements. Focused on creating the squat, bench press, and deadlift through periodized volume accumulation.',
    benefits: ['Maximizes force output development', 'Superior nervous system adaptation efficiency', 'Peak strength regression under pressure', 'World-class powerlifting science'],
  },
  {
    style: 'CrossFit',
    color: WORKOUT_STYLE_COLORS['CrossFit'],
    researcher: 'Greg Glassman & CrossFit Methodology',
    description: 'Constantly varied functional movements at high intensity. CrossFit\'s GPP (General Physical Preparedness) model ensures you develop capacity across all 10 general physical skills \u2014 from stamina and strength to agility and accuracy.',
    benefits: ['Broad athletic capacity', 'Community and competition drive', 'Metabolic conditioning', 'Movement skill development'],
  },
  {
    style: 'Hyrox',
    color: WORKOUT_STYLE_COLORS['Hyrox'],
    researcher: 'Official Hyrox Race Format & Functional Fitness Research',
    description: 'Structured around the official Hyrox race format: 8 \u00D7 8km runs + functional stations. Training follows the top Hyrox athletes\' approaches \u2014 building both aerobic capacity and functional strength endurance simultaneously.',
    benefits: ['Race-specific preparation', 'Combines running and functional fitness', 'Rapidly growing global sport', 'Tests true all-around fitness'],
  },
  {
    style: 'Cardio',
    color: WORKOUT_STYLE_COLORS['Cardio'],
    researcher: 'Stephen Seiler (Polarized Training) & Phil Maffetone (MAF Method)',
    description: 'Seiler\'s research on elite endurance athletes consistently shows 80% low intensity / 20% high intensity as the optimal training distribution. Maffetone\'s MAF method ensures Zone 2 base work is truly aerobic \u2014 not lactate-accumulating moderate intensity.',
    benefits: ['Mitochondrial density increase', 'Cardiovascular efficiency', 'Fat adaptation', 'Longevity and metabolic health'],
  },
  {
    style: 'HIIT',
    color: WORKOUT_STYLE_COLORS['HIIT'],
    researcher: 'Izumi Tabata, Martin Gibala & Norwegian Protocol',
    description: 'Tabata\'s original research showed 8x20s all-out intervals produce both aerobic and anaerobic adaptations. Gibala\'s sprint interval protocols and the Norwegian 4x4 Method are the gold standard for time-efficient cardiovascular adaptation.',
    benefits: ['EPOC \u2014 calories burned for hours post-workout', 'VO2 max improvements', 'Insulin sensitivity', 'Time-efficient training'],
  },
  {
    style: 'Mobility',
    color: WORKOUT_STYLE_COLORS['Mobility'],
    researcher: 'Andreo Spina (FRC) & Kelly Starrett (MobilityWOD)',
    description: 'Functional Range Conditioning (FRC) by Spina uses CARs (controlled articular rotations), PAILs, and RAILs to increase active joint range of motion \u2014 not just passive flexibility. Starrett\'s approach integrates mobility into movement quality and pain reduction.',
    benefits: ['Injury prevention', 'Active joint health and longevity', 'Improved movement quality', 'Reduced pain and tension'],
  },
  {
    style: 'Pilates',
    color: WORKOUT_STYLE_COLORS['Pilates'],
    researcher: 'Joseph Pilates (Classical) & Brent Anderson (Contemporary Research)',
    description: 'Joseph Pilates\' classical method emphasized breath, core control, and movement precision. Contemporary research by Brent Anderson and the Polestar Institute has validated Pilates for spinal stability, postural correction, and deep core recruitment in clinical and athletic populations.',
    benefits: ['Deep core activation and control', 'Postural alignment', 'Injury rehabilitation', 'Mind-muscle connection'],
  },
];

export default function HelpFaqDrawer({ visible, onClose }: Props) {
  const { colors, accent, isDark } = useZealTheme();

  const [activeTab, setActiveTab] = useState<TabKey>('faq');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const faqAnims = useRef<Animated.Value[]>(FAQ_DATA.map(() => new Animated.Value(0))).current;

  const handleFaqToggle = useCallback((index: number) => {
    setExpandedFaq(prev => {
      const next = prev === index ? null : index;
      Animated.timing(faqAnims[index], {
        toValue: next === index ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
      if (prev !== null && prev !== index) {
        Animated.timing(faqAnims[prev], {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
      return next;
    });
  }, [faqAnims]);

  const handleTabPress = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const renderStars = useCallback((count: number, size: number = 12) => {
    return (
      <View style={styles.starsRow}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            size={size}
            color="#f59e0b"
            fill={i < count ? '#f59e0b' : 'transparent'}
            strokeWidth={i < count ? 0 : 1.5}
          />
        ))}
      </View>
    );
  }, []);

  const header = (
    <>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Help & Info</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn} testID="help-faq-close">
          <X size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {(['faq', 'reviews', 'science'] as TabKey[]).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'faq' ? 'FAQ' : tab === 'reviews' ? 'Reviews' : 'Our Science';
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabBtn,
                isActive && { borderBottomWidth: 2, borderBottomColor: accent },
              ]}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.7}
              testID={`help-tab-${tab}`}
            >
              <Text style={[
                styles.tabBtnText,
                { color: isActive ? accent : colors.textMuted },
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={header}>
      <View style={styles.scrollContent}>
        {activeTab === 'faq' && (
          <View style={styles.faqContainer}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>FREQUENTLY ASKED QUESTIONS</Text>

            {FAQ_DATA.map((item, index) => {
              const isOpen = expandedFaq === index;
              return (
                <View key={index} style={[styles.faqItem, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.faqQuestion}
                    onPress={() => handleFaqToggle(index)}
                    activeOpacity={0.7}
                    testID={`faq-item-${index}`}
                  >
                    <Text style={[styles.faqQuestionText, { color: colors.text }]} numberOfLines={2}>
                      {item.question}
                    </Text>
                    <ChevronDown
                      size={18}
                      color={colors.textMuted}
                      style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={styles.faqAnswer}>
                      <Text style={[styles.faqAnswerText, { color: colors.textSecondary }]}>
                        {item.answer}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            <TouchableOpacity
              style={[styles.feedbackLink, { backgroundColor: colors.card, borderColor: cardBorder }]}
              onPress={() => Linking.openURL('mailto:feedback@zealapp.com')}
              activeOpacity={0.7}
              testID="feedback-link"
            >
              <MessageCircle size={18} color={accent} />
              <Text style={[styles.feedbackText, { color: colors.textSecondary }]}>
                Have feedback? We'd love to hear it.
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'reviews' && (
          <View style={styles.reviewsContainer}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WHAT ATHLETES ARE SAYING</Text>

            <View style={[styles.ratingHeader, { backgroundColor: colors.card, borderColor: cardBorder }]}>
              <Text style={[styles.ratingBigNumber, { color: colors.text }]}>4.8</Text>
              <Text style={[styles.ratingSubtitle, { color: colors.textSecondary }]}>Athlete Approved</Text>
              {renderStars(5, 18)}
              <Text style={[styles.ratingNote, { color: colors.textMuted }]}>Based on active athlete feedback</Text>
            </View>

            {REVIEWS_DATA.map((review, index) => (
              <View key={index} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: cardBorder }]}>
                {renderStars(review.stars, 14)}
                <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
                  "{review.text}"
                </Text>
                <View style={styles.reviewerRow}>
                  <View style={[styles.reviewerAvatar, { backgroundColor: `${accent}22` }]}>
                    <Text style={[styles.reviewerInitial, { color: accent }]}>
                      {review.name.charAt(0)}
                    </Text>
                  </View>
                  <Text style={[styles.reviewerName, { color: colors.text }]}>{review.name}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'science' && (
          <View style={styles.scienceContainer}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WHERE WE GET OUR WORKOUTS</Text>
            <Text style={[styles.scienceIntro, { color: colors.textSecondary }]}>
              Every workout style in zeal is built on the methods of world-leading coaches, researchers, and competitive athletes. We don't make up generic routines — we program like the best do.
            </Text>

            {SCIENCE_DATA.map((card, index) => (
              <View key={index} style={[styles.scienceCard, { backgroundColor: colors.card, borderColor: cardBorder }]}>
                <View style={[styles.scienceBadge, { backgroundColor: `${card.color}22` }]}>
                  <Text style={[styles.scienceBadgeText, { color: card.color }]}>{card.style.toUpperCase()}</Text>
                </View>
                <Text style={[styles.scienceResearcher, { color: colors.text }]}>{card.researcher}</Text>
                <Text style={[styles.scienceDesc, { color: colors.textSecondary }]}>{card.description}</Text>
                <View style={styles.benefitsRow}>
                  {card.benefits.map((benefit, bi) => (
                    <View key={bi} style={[styles.benefitChip, { backgroundColor: colors.cardSecondary }]}>
                      <Text style={[styles.benefitChipText, { color: colors.textSecondary }]}>{benefit}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 60 }} />
      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  closeBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 10,
  },
  tabBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    fontWeight: '600' as const,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  faqContainer: {
    gap: 0,
  },
  faqItem: {
    borderBottomWidth: 1,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    gap: 12,
  },
  faqQuestionText: {
    fontSize: 15,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '500' as const,
    flex: 1,
    lineHeight: 21,
  },
  faqAnswer: {
    paddingBottom: 16,
    paddingRight: 12,
  },
  faqAnswerText: {
    fontSize: 13,
    lineHeight: 20,
  },
  feedbackLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  feedbackText: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '500' as const,
  },
  reviewsContainer: {
    gap: 12,
  },
  ratingHeader: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  ratingBigNumber: {
    fontSize: 48,
    fontFamily: 'Outfit_800ExtraBold',
    fontWeight: '800' as const,
    letterSpacing: -1,
    lineHeight: 52,
  },
  ratingSubtitle: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  ratingNote: {
    fontSize: 11,
    marginTop: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  reviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  reviewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerInitial: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '700' as const,
  },
  reviewerName: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    fontWeight: '600' as const,
  },
  scienceContainer: {
    gap: 12,
  },
  scienceIntro: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  scienceCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  scienceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scienceBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  scienceResearcher: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '700' as const,
    lineHeight: 22,
  },
  scienceDesc: {
    fontSize: 13,
    lineHeight: 20,
  },
  benefitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  benefitChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  benefitChipText: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
});
