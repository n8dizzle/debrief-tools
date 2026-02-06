'use client';

import { useState, useEffect } from 'react';
import TaskList from '@/components/TaskList';
import { useARPermissions } from '@/hooks/useARPermissions';

export default function TasksPage() {
  const { canUpdateWorkflow } = useARPermissions();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Tasks
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Manage collection tasks and follow-ups
        </p>
      </div>

      {/* Task List */}
      <div className="card">
        <TaskList
          showFilters={true}
          showCreateButton={canUpdateWorkflow}
          defaultFilter="all"
        />
      </div>
    </div>
  );
}
