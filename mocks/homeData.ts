export const mockUser = {
  name: 'Kody',
  avatarInitials: 'K',
};

export const mockStreak = 3;

export const mockCalendarDays = [
  { abbr: 'THU', num: 12, completed: true },
  { abbr: 'FRI', num: 13, completed: true },
  { abbr: 'TODAY', num: 14, completed: false, isToday: true },
  { abbr: 'SUN', num: 15, completed: false },
  { abbr: 'MON', num: 16, completed: false },
];

export const mockWorkout = {
  title: 'Push, Pull, Legs & Core',
  muscleGroups: ['QUADRICEPS', 'CHEST', 'LATISSIMUS'],
  style: 'CrossFit',
  duration: '60 min',
};

export const mockTrainingScore = {
  score: 13,
  tier: 'Getting Started',
  readiness: 81,
  targetDone: 0,
  targetTotal: 12,
  hoursTrained: '1h 1m',
  hoursTrainedVs: '0h',
  trainingLoad: 92,
  trainingLoadDelta: 2,
};

const BIBLE_VERSES: Array<{ text: string; reference: string }> = [
  { text: '"Present your bodies as a living sacrifice, holy and acceptable to God"', reference: 'Rom. 12:1' },
  { text: '"I can do all things through him who strengthens me"', reference: 'Phil. 4:13' },
  { text: '"Do you not know that your body is a temple of the Holy Spirit within you?"', reference: '1 Cor. 6:19' },
  { text: '"Physical training is of some value, but godliness has value for all things"', reference: '1 Tim. 4:8' },
  { text: '"Whatever you do, work at it with all your heart, as working for the Lord"', reference: 'Col. 3:23' },
  { text: '"He gives power to the faint, and to him who has no might he increases strength"', reference: 'Isa. 40:29' },
  { text: '"Let us run with endurance the race that is set before us"', reference: 'Heb. 12:1' },
  { text: '"Be strong and courageous. Do not be afraid; do not be discouraged"', reference: 'Josh. 1:9' },
  { text: '"The Lord is my strength and my shield; in him my heart trusts"', reference: 'Ps. 28:7' },
  { text: '"So whether you eat or drink, or whatever you do, do all to the glory of God"', reference: '1 Cor. 10:31' },
  { text: '"With God all things are possible"', reference: 'Matt. 19:26' },
  { text: '"Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you"', reference: 'Isa. 41:10' },
  { text: '"Train yourself for godliness"', reference: '1 Tim. 4:7' },
  { text: '"The Lord will give strength to his people; the Lord will bless his people with peace"', reference: 'Ps. 29:11' },
  { text: '"Walk in a manner worthy of the calling to which you have been called"', reference: 'Eph. 4:1' },
  { text: '"For I know the plans I have for you, plans to prosper you and not to harm you"', reference: 'Jer. 29:11' },
  { text: '"But those who hope in the Lord will renew their strength"', reference: 'Isa. 40:31' },
  { text: '"Do not grow weary in doing good, for in due season you will reap"', reference: 'Gal. 6:9' },
  { text: '"Glorify God in your body"', reference: '1 Cor. 6:20' },
  { text: '"Be watchful, stand firm in the faith, act like men, be strong"', reference: '1 Cor. 16:13' },
  { text: '"The Lord your God is with you, the Mighty Warrior who saves"', reference: 'Zeph. 3:17' },
  { text: '"I have learned, in whatever situation I am, to be content"', reference: 'Phil. 4:11' },
  { text: '"Commit your work to the Lord, and your plans will be established"', reference: 'Prov. 16:3' },
  { text: '"No discipline seems pleasant at the time, but painful. Later on it produces righteousness"', reference: 'Heb. 12:11' },
  { text: '"The Lord is my light and my salvation; whom shall I fear?"', reference: 'Ps. 27:1' },
  { text: '"Trust in the Lord with all your heart and lean not on your own understanding"', reference: 'Prov. 3:5' },
  { text: '"Let your light shine before others, so that they may see your good works"', reference: 'Matt. 5:16' },
  { text: '"Be transformed by the renewing of your mind"', reference: 'Rom. 12:2' },
  { text: '"I press on toward the goal for the prize of the upward call of God"', reference: 'Phil. 3:14' },
  { text: '"God did not give us a spirit of fear, but of power and love and self-control"', reference: '2 Tim. 1:7' },
  { text: '"My strength is dried up like a potsherd — but you, O Lord, are my strength"', reference: 'Ps. 22:15,19' },
];

export function getDailyVerse(): { text: string; reference: string } {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return BIBLE_VERSES[dayOfYear % BIBLE_VERSES.length];
}

export const mockBibleVerse = getDailyVerse();
