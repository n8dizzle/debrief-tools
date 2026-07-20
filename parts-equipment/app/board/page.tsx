'use client';
import InstallPartsBoard from '@/components/InstallPartsBoard';

// Standalone tab for the new team-based workflow board (first slice: the Parts
// Coordinator lane). Kept separate from the Install/Service/Warranty table tabs
// while the concept is proven — nothing here touches those views.
export default function BoardPage() {
  return <InstallPartsBoard />;
}
