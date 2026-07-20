'use client';
import WarehousePartsBoard from '@/components/WarehousePartsBoard';

// Standalone tab for the Warehouse lane (WIP), sitting next to the Parts Board so
// the two roles' boards can be compared. Nothing here touches the table tabs.
export default function WarehouseBoardPage() {
  return <WarehousePartsBoard />;
}
