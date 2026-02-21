'use client';

import { useState } from 'react';
import { Settings, Users, Database, Plus, GripVertical } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { ComfortAdvisor } from '@/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableAdvisorProps {
  advisor: ComfortAdvisor;
  queueType: 'tgl' | 'marketed';
}

function SortableAdvisor({ advisor, queueType }: SortableAdvisorProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: advisor.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const position = queueType === 'tgl' ? advisor.tglQueuePosition : advisor.marketedQueuePosition;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-transparent ${
        isDragging ? 'border-primary shadow-lg' : 'hover:bg-muted/50'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-white ${
          queueType === 'tgl' ? 'bg-tan' : 'bg-forest'
        }`}
      >
        {position}
      </div>
      <div className="flex-1">
        <p className="font-medium text-foreground">{advisor.name}</p>
        <p className="text-xs text-muted-foreground">{advisor.email}</p>
      </div>
    </div>
  );
}

export function AdminView() {
  const { advisors, addAdvisor, updateAdvisor, loadSampleData, leads, fetchAdvisors } = useDashboardStore();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const maxTGL = Math.max(0, ...advisors.map(a => a.tglQueuePosition));
    const maxMarketed = Math.max(0, ...advisors.map(a => a.marketedQueuePosition));

    const newAdvisor: ComfortAdvisor = {
      id: `advisor-${Date.now()}`,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      active: true,
      inQueue: true,
      tglQueuePosition: maxTGL + 1,
      marketedQueuePosition: maxMarketed + 1,
      salesMTD: 0,
      averageSale: 0,
      closingRate: 0,
      salesOpps: 0,
      totalLeads: 0,
      soldLeads: 0,
    };
    addAdvisor(newAdvisor);
    setFormData({ name: '', email: '', phone: '' });
    setShowForm(false);
  };

  const toggleAdvisorActive = async (advisorId: string, currentActive: boolean) => {
    updateAdvisor(advisorId, { active: !currentActive });
    try {
      await fetch('/api/advisors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: advisorId, active: !currentActive }),
      });
    } catch (error) {
      console.error('Failed to update advisor:', error);
    }
  };

  const toggleInQueue = async (advisorId: string, currentInQueue: boolean) => {
    updateAdvisor(advisorId, { inQueue: !currentInQueue });
    try {
      await fetch('/api/advisors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: advisorId, inQueue: !currentInQueue }),
      });
      // Refresh to get updated queue positions
      fetchAdvisors();
    } catch (error) {
      console.error('Failed to update advisor:', error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent, queueType: 'tgl' | 'marketed') => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const queueField = queueType === 'tgl' ? 'tglQueuePosition' : 'marketedQueuePosition';
    const inQueueAdvisors = advisors
      .filter(a => a.active && a.inQueue)
      .sort((a, b) => a[queueField] - b[queueField]);

    const oldIndex = inQueueAdvisors.findIndex(a => a.id === active.id);
    const newIndex = inQueueAdvisors.findIndex(a => a.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(inQueueAdvisors, oldIndex, newIndex);

    // Update positions locally
    const updates: { id: string; position: number }[] = [];
    reordered.forEach((advisor, index) => {
      const newPosition = index + 1;
      if (queueType === 'tgl') {
        updateAdvisor(advisor.id, { tglQueuePosition: newPosition });
      } else {
        updateAdvisor(advisor.id, { marketedQueuePosition: newPosition });
      }
      updates.push({ id: advisor.id, position: newPosition });
    });

    // Persist to database
    try {
      await Promise.all(
        updates.map(({ id, position }) =>
          fetch('/api/advisors', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              [queueType === 'tgl' ? 'tglQueuePosition' : 'marketedQueuePosition']: position,
            }),
          })
        )
      );
    } catch (error) {
      console.error('Failed to update queue positions:', error);
      // Refresh to get correct state
      fetchAdvisors();
    }
  };

  // Get advisors in queue sorted by position
  const inQueueAdvisors = advisors.filter(a => a.active && a.inQueue);
  const tglQueue = [...inQueueAdvisors].sort((a, b) => a.tglQueuePosition - b.tglQueuePosition);
  const marketedQueue = [...inQueueAdvisors].sort((a, b) => a.marketedQueuePosition - b.marketedQueuePosition);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Admin Panel</h2>
          <p className="text-muted-foreground">Manage advisors and queue order</p>
        </div>
        <button
          onClick={loadSampleData}
          className="px-4 py-2 rounded-lg bg-green-sales hover:bg-green-sales/90 text-white font-medium text-sm transition-colors flex items-center gap-2"
        >
          <Database className="w-4 h-4" />
          Load Sample Data
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-sage" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Advisors</p>
              <p className="text-xl font-bold text-foreground">{advisors.length}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-sales/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-sales" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-xl font-bold text-foreground">{advisors.filter(a => a.active).length}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-tan/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-tan" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In Queue</p>
              <p className="text-xl font-bold text-foreground">{inQueueAdvisors.length}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-forest/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-forest" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Leads</p>
              <p className="text-xl font-bold text-foreground">{leads.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Queue Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TGL Queue */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-tan/20 flex items-center justify-center">
              <span className="text-tan font-bold text-sm">TGL</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">TGL Queue Order</h3>
              <p className="text-sm text-muted-foreground">Drag to reorder</p>
            </div>
          </div>

          {tglQueue.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(e, 'tgl')}
            >
              <SortableContext items={tglQueue.map(a => a.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {tglQueue.map((advisor) => (
                    <SortableAdvisor key={advisor.id} advisor={advisor} queueType="tgl" />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No advisors in TGL queue
            </div>
          )}
        </div>

        {/* Marketed Queue */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-forest/20 flex items-center justify-center">
              <span className="text-forest font-bold text-sm">M</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Marketed Queue Order</h3>
              <p className="text-sm text-muted-foreground">Drag to reorder</p>
            </div>
          </div>

          {marketedQueue.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(e, 'marketed')}
            >
              <SortableContext items={marketedQueue.map(a => a.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {marketedQueue.map((advisor) => (
                    <SortableAdvisor key={advisor.id} advisor={advisor} queueType="marketed" />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No advisors in Marketed queue
            </div>
          )}
        </div>
      </div>

      {/* Advisors Management */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-sage" />
            <h3 className="text-lg font-semibold text-foreground">Manage Advisors</h3>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg bg-sage hover:bg-sage/90 text-white font-medium text-sm transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Cancel' : 'Add Advisor'}
          </button>
        </div>

        {/* Add Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-muted/30 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Phone</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 px-6 py-2 rounded-lg bg-green-sales hover:bg-green-sales/90 text-white font-medium text-sm transition-colors"
            >
              Add Advisor
            </button>
          </form>
        )}

        {/* Advisor Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Email</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">In Queue</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {advisors.map((advisor) => (
                <tr key={advisor.id} className={`border-b border-border hover:bg-muted/30 ${!advisor.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{advisor.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">{advisor.email}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleInQueue(advisor.id, advisor.inQueue)}
                      disabled={!advisor.active}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        advisor.inQueue && advisor.active ? 'bg-green-sales' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          advisor.inQueue && advisor.active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleAdvisorActive(advisor.id, advisor.active)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        advisor.active
                          ? 'bg-green-sales/20 text-green-sales hover:bg-green-sales/30'
                          : 'bg-destructive/20 text-destructive hover:bg-destructive/30'
                      }`}
                    >
                      {advisor.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {advisors.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No advisors added yet. Sync from Service Titan in Settings.
          </div>
        )}
      </div>
    </div>
  );
}
