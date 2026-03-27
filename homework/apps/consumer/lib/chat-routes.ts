/**
 * Chat Route Configuration
 * Maps routes to chat modes and API endpoints
 */

import type { ChatMode } from "@/types/flow"

export interface ChatRouteConfig {
  mode: ChatMode
  api?: string // API endpoint for interactive mode
}

export const CHAT_ROUTES: Record<string, ChatRouteConfig> = {
  "/": { mode: "interactive", api: "/api/intro/chat" },
  "/dashboard": { mode: "interactive", api: "/api/agent/chat" },
  "/flow/address": { mode: "guidance" },
  "/flow/loading": { mode: "hidden" },
  "/flow/preview": { mode: "guidance" },
  "/flow/agent": { mode: "interactive", api: "/api/agent/chat" },
  "/flow/pricing": { mode: "guidance" },
  "/flow/pros": { mode: "guidance" },
  "/flow/addons": { mode: "guidance" },
  "/flow/schedule": { mode: "guidance" },
  "/flow/checkout": { mode: "guidance" },
}

/**
 * Get chat configuration for a given route
 */
export function getChatConfig(pathname: string): ChatRouteConfig {
  // Exact match first
  if (CHAT_ROUTES[pathname]) {
    return CHAT_ROUTES[pathname]
  }

  // Default to hidden for unknown routes
  return { mode: "hidden" }
}

/**
 * Check if a route is interactive (allows chat input)
 */
export function isInteractiveRoute(pathname: string): boolean {
  return getChatConfig(pathname).mode === "interactive"
}

/**
 * Get the API endpoint for a route (if interactive)
 */
export function getChatApiEndpoint(pathname: string): string | undefined {
  return getChatConfig(pathname).api
}
