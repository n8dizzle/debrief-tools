"use client";

import { useState, useEffect } from "react";

export interface RetellAgent {
  agent_id: string;
  agent_name: string;
  voice_id: string;
  is_published: boolean;
}

export function useAgents() {
  const [agents, setAgents] = useState<RetellAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setAgents(data))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  return { agents, loading };
}
