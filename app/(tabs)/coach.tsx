import React from 'react';
import { Brain, Mic, Eye, TrendingUp } from 'lucide-react-native';
import ComingSoon from '@/components/ComingSoon';

export default function CoachScreen() {
  return (
    <ComingSoon
      MainIcon={Brain}
      title="AI Coach"
      tagline="Your pocket personal trainer"
      description="Real-time guidance, intelligent plan adjustments, and a voice that pushes you when it matters most."
      features={[
        {
          Icon: Mic,
          title: 'Voice Guidance',
          description: 'Hands-free cues, set counts, and rest timers called out as you lift.',
        },
        {
          Icon: Eye,
          title: 'Form Check',
          description: 'Point your camera at yourself — get instant feedback on your technique.',
        },
        {
          Icon: TrendingUp,
          title: 'Adaptive Plans',
          description: 'Your plan learns from every session and adjusts weights, reps, and rest in real time.',
        },
      ]}
    />
  );
}
