/**
 * ScannerLayout — full-screen mobile shell for the scanner app.
 * No sidebar. Used by all /scanner/* routes.
 */

import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LogOut, ChevronLeft, Package } from 'lucide-react';

export default function ScannerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/scanner';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col max-w-lg mx-auto">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 safe-top sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {!isHome ? (
            <button
              onClick={() => navigate('/scanner')}
              className="text-slate-400 hover:text-white p-1 -ml-1"
            >
              <ChevronLeft size={24} />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Package size={14} className="text-white" />
              </div>
              <span className="text-white font-semibold text-sm">Field Scanner</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <span className="text-slate-400 text-xs hidden sm:block">
              {user.name ?? user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-red-400 transition-colors p-1"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <Outlet />
      </main>

      {/* Footer: link back to full dashboard */}
      <footer className="px-4 py-3 bg-slate-800 border-t border-slate-700 text-center safe-bottom"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <a
          href="/"
          className="text-slate-500 text-xs hover:text-indigo-400 transition-colors"
        >
          Switch to full dashboard →
        </a>
      </footer>
    </div>
  );
}
