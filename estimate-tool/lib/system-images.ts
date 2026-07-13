// Maps system brand/tier/SEER to condenser product photos
// Drop images into /public/images/systems/ with these filenames

const BRAND_IMAGES: Record<string, string> = {
  'comfort maker': '/images/systems/builder.png',
  'comfortmaker': '/images/systems/builder.png',
  'ameristar': '/images/systems/builder.png',
  'icp': '/images/systems/builder.png',
};

const TIER_IMAGES: Record<string, string> = {
  'Builder': '/images/systems/builder.png',
  'Silver': '/images/systems/silver-16.png',
  'Gold': '/images/systems/gold-17.png',
  'Platinum': '/images/systems/platinum-18.png',
  'Platinum+': '/images/systems/platinum-20.png',
};

const SEER_IMAGES: Record<string, string> = {
  '14': '/images/systems/silver-14.png',
  '15': '/images/systems/silver-14.png',
  '16': '/images/systems/silver-16.png',
  '17': '/images/systems/gold-17.png',
  '18': '/images/systems/platinum-18.png',
  '20': '/images/systems/platinum-20.png',
};

export function getSystemImage(seer?: number, tierName?: string, brand?: string): string {
  // Brand first — different manufacturers have different looking units
  if (brand) {
    const img = BRAND_IMAGES[brand.toLowerCase()];
    if (img) return img;
  }
  // Tier name second
  if (tierName && TIER_IMAGES[tierName]) return TIER_IMAGES[tierName];
  // SEER fallback
  if (seer && SEER_IMAGES[String(seer)]) return SEER_IMAGES[String(seer)];
  return '/images/systems/condenser-default.png';
}
