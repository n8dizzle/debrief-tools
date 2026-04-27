/**
 * Temporary placeholder page for sections not yet built.
 * Shows the page name and a "coming soon" message.
 * Replace with the real implementation when building out each section.
 */

import { useOutletContext } from 'react-router-dom';
import { Construction } from 'lucide-react';
import Header from '../components/Header.jsx';

export default function Placeholder({ title, description }) {
  const { collapsed, onToggleSidebar } = useOutletContext();

  return (
    <>
      <Header
        title={title}
        subtitle={description}
        collapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
      />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Construction className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700 mb-2">{title}</h2>
          <p className="text-sm text-slate-400">
            This section is ready to build. The API endpoints and data models are fully wired —
            implement the list/detail views when you're ready.
          </p>
        </div>
      </main>
    </>
  );
}
