'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Plus,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  LogOut,
  MapPin,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { useState } from 'react'

interface HomeData {
  formattedAddress?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  sqft?: number | null
  beds?: number | null
  baths?: number | null
  yearBuilt?: number | null
}

interface ConversationItem {
  id: string
  title: string
  preview?: string
  timestamp: Date
  isActive?: boolean
}

interface AppSidebarProps {
  user: SupabaseUser | null
  isCollapsed: boolean
  onToggleCollapse: () => void
  homeData?: HomeData | null
  conversations?: ConversationItem[]
  currentConversationId?: string
  className?: string
}

export function AppSidebar({
  user,
  isCollapsed,
  onToggleCollapse,
  homeData,
  conversations = [],
  currentConversationId,
  className,
}: AppSidebarProps) {
  const pathname = usePathname()
  const [isHomeExpanded, setIsHomeExpanded] = useState(false)

  const shortAddress = homeData?.street || homeData?.formattedAddress?.split(',')[0] || null

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-slate-50 border-r border-slate-200 transition-all duration-200',
        isCollapsed ? 'w-16' : 'w-60',
        className
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center h-14 px-3 border-b border-slate-200',
        isCollapsed && 'justify-center'
      )}>
        {!isCollapsed ? (
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="homework"
              width={100}
              height={20}
              className="h-5 w-auto"
              priority
            />
          </Link>
        ) : (
          <Link href="/" className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-600">
            <span className="text-white font-bold text-sm">H</span>
          </Link>
        )}
      </div>

      {/* New Chat Button */}
      <div className="p-2">
        <Link
          href="/"
          className={cn(
            'flex items-center gap-2 px-3 py-2.5 rounded-lg',
            'bg-teal-600 text-white font-medium text-sm',
            'hover:bg-teal-700 transition-colors',
            'min-h-[44px]',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span>New Chat</span>}
        </Link>
      </div>

      {/* Home Summary (collapsible) */}
      {homeData && shortAddress && (
        <div className="px-2 mb-2">
          <button
            onClick={() => !isCollapsed && setIsHomeExpanded(!isHomeExpanded)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left',
              'hover:bg-slate-100 transition-colors',
              'text-sm text-slate-600',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <MapPin className="w-4 h-4 flex-shrink-0 text-slate-400" />
            {!isCollapsed && (
              <>
                <span className="flex-1 truncate">{shortAddress}</span>
                {isHomeExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </>
            )}
          </button>

          {/* Expanded home details */}
          {!isCollapsed && isHomeExpanded && (
            <div className="mt-1 ml-9 mr-3 p-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-500 space-y-1">
              {homeData.sqft && <div>{homeData.sqft.toLocaleString()} sqft</div>}
              {homeData.beds && homeData.baths && (
                <div>{homeData.beds} bed / {homeData.baths} bath</div>
              )}
              {homeData.yearBuilt && <div>Built {homeData.yearBuilt}</div>}
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="mx-3 border-t border-slate-200" />

      {/* Recent Chats */}
      <div className="flex-1 overflow-y-auto p-2">
        {!isCollapsed && (
          <p className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
            Recent
          </p>
        )}
        <div className="space-y-0.5">
          {conversations.length > 0 ? (
            conversations.map((convo) => (
              <Link
                key={convo.id}
                href={`/chat/${convo.id}`}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                  'text-sm',
                  isCollapsed && 'justify-center px-2',
                  convo.id === currentConversationId
                    ? 'bg-slate-200 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="truncate">{convo.title}</span>
                )}
              </Link>
            ))
          ) : (
            !isCollapsed && (
              <p className="px-3 py-4 text-sm text-slate-400 text-center">
                No conversations yet
              </p>
            )
          )}
        </div>
      </div>

      {/* Bottom - User + Actions */}
      <div className="border-t border-slate-200 p-2">
        {/* User */}
        {user && !isCollapsed && (
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            {user.user_metadata?.avatar_url ? (
              <Image
                src={user.user_metadata.avatar_url}
                alt=""
                width={28}
                height={28}
                className="w-7 h-7 rounded-full"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                <span className="text-xs font-medium text-slate-600">
                  {(user.email?.[0] || 'U').toUpperCase()}
                </span>
              </div>
            )}
            <span className="flex-1 text-sm text-slate-700 truncate">
              {user.user_metadata?.full_name || user.email?.split('@')[0]}
            </span>
          </div>
        )}

        {/* Sign out */}
        {user && (
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              localStorage.clear()
              window.location.href = '/'
            }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
              'text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100',
              'transition-colors',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Sign out</span>}
          </button>
        )}

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
            'text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-100',
            'transition-colors',
            isCollapsed && 'justify-center px-2'
          )}
        >
          {isCollapsed ? (
            <PanelLeft className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
