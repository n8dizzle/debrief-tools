export const VIDEO_FPS = 30;
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;

export const BRAND_COLORS = {
  green: '#5D8A66',
  greenDark: '#4A7053',
  greenLight: '#6B9B75',
  cream: '#F5F0E1',
  brown: '#7B3F3F',
  gold: '#B8956B',
  dark: '#0F1210',
  darkSecondary: '#161B18',
  darkCard: '#1C231E',
};

export const TEMPLATES = {
  'team-update': {
    name: 'Team Update',
    defaultDuration: 15, // seconds
    maxDuration: 60,
  },
  'shoutout': {
    name: 'Shoutout',
    defaultDuration: 10,
    maxDuration: 30,
  },
  'announcement': {
    name: 'Announcement',
    defaultDuration: 15,
    maxDuration: 60,
  },
} as const;

export type TemplateId = keyof typeof TEMPLATES;
