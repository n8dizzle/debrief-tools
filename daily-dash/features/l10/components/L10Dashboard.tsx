'use client';

import { useState } from 'react';
import StoriesTab from './StoriesTab';
import RocksTab from './RocksTab';
import TodosTab from './TodosTab';
import IdsTab from './IdsTab';
import RatingsTab from './RatingsTab';

const tabs = [
  { key: 'stories', label: 'Story' },
  { key: 'rocks', label: 'Rocks' },
  { key: 'todos', label: 'To-Dos' },
  { key: 'ids', label: 'IDS' },
  { key: 'ratings', label: 'Ratings' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

export default function L10Dashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>('stories');

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            L10 Meeting
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Weekly meeting tools &mdash; story, rocks, to-dos, IDS, and ratings
          </p>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 p-1 rounded-lg mb-6" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: activeTab === tab.key ? 'var(--christmas-green)' : 'transparent',
              color: activeTab === tab.key ? 'white' : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'stories' && <StoriesTab />}
      {activeTab === 'rocks' && <RocksTab />}
      {activeTab === 'todos' && <TodosTab />}
      {activeTab === 'ids' && <IdsTab />}
      {activeTab === 'ratings' && <RatingsTab />}
    </div>
  );
}
