import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

/**
 * Root application shell.
 * Renders the persistent sidebar + a scrollable main content area.
 * Each page is rendered via <Outlet /> and provides its own <Header>.
 */
export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-slate-50">
        {/* Each page controls its own header via the `collapsed` context or direct props.
            We pass a toggle function via Outlet context so pages can render the header. */}
        <Outlet context={{ collapsed, onToggleSidebar: () => setCollapsed((c) => !c) }} />
      </div>
    </div>
  );
}
