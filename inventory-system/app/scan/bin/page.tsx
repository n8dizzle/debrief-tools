import BinScanForm from './BinScanForm';

export const dynamic = 'force-dynamic';

export default function BinScanPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-christmas-cream">Replenish bin</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Scan your tech bin barcode. All pending items in the bin will move from the warehouse onto your truck.
        </p>
      </header>
      <BinScanForm />
    </div>
  );
}
