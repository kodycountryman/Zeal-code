import React from 'react';
import { Apple, Camera, Flame, Droplets } from 'lucide-react-native';
import ComingSoon from '@/components/ComingSoon';

export default function NutritionScreen() {
  return (
    <ComingSoon
      MainIcon={Apple}
      title="Nutrition"
      tagline="Fuel that matches your training"
      description="Log meals in seconds, hit your macros, and see exactly how your nutrition drives your performance."
      features={[
        {
          Icon: Camera,
          title: 'Snap to Log',
          description: 'Photograph any meal and let the app identify it and log the macros instantly.',
        },
        {
          Icon: Flame,
          title: 'Macro Targets',
          description: 'Daily protein, carb, and fat goals that adapt to your training load and body goals.',
        },
        {
          Icon: Droplets,
          title: 'Hydration Tracking',
          description: 'Water reminders and intake logs synced with your workout intensity.',
        },
      ]}
    />
  );
}
