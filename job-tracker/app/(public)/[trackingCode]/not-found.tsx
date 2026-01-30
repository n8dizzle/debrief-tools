import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center py-8 px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-200 mb-6">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Tracker Not Found</h1>
        <p className="text-gray-600 mb-6">
          We couldn&apos;t find a job tracker with that link. The link may have expired or been entered incorrectly.
        </p>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left">
          <h2 className="font-semibold text-gray-900 mb-3">Need help?</h2>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Check that you copied the entire link from your text or email
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Contact us at (512) 439-1616 for assistance
            </li>
          </ul>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          <Link href="https://christmasair.com" className="text-green-600 hover:underline">
            christmasair.com
          </Link>
        </p>
      </div>
    </div>
  );
}
