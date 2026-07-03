// Maps system tier/SEER to condenser product photos
// Drop images into /public/images/systems/ with these filenames
// Replace placeholders with actual American Standard product photos

const SYSTEM_IMAGES: Record<string, string> = {
  // By SEER rating
  '14': '/images/systems/silver-14.png',
  '15': '/images/systems/silver-14.png',   // same unit family
  '16': '/images/systems/silver-16.png',
  '17': '/images/systems/gold-17.png',
  '18': '/images/systems/platinum-18.png',
  '20': '/images/systems/platinum-20.png',

  // By tier name (fallback)
  'Builder': '/images/systems/builder.png',
  'Silver': '/images/systems/silver-16.png',
  'Gold': '/images/systems/gold-17.png',
  'Platinum': '/images/systems/platinum-18.png',
  'Platinum+': '/images/systems/platinum-20.png',

  // Fallback
  'default': '/images/systems/condenser-default.png',
};

export function getSystemImage(seer?: number, tierName?: string): string {
  if (seer && SYSTEM_IMAGES[String(seer)]) return SYSTEM_IMAGES[String(seer)];
  if (tierName && SYSTEM_IMAGES[tierName]) return SYSTEM_IMAGES[tierName];
  return SYSTEM_IMAGES['default'];
}
