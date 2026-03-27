'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Circle,
  Loader2,
  MessageSquare,
  MapPin,
  Calendar,
  User,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import type { ContractorJobView, OrderStage, StageStatus } from '@/types/tracker'

export default function ContractorJobPage() {
  const params = useParams()
  const token = params.token as string

  const [job, setJob] = useState<ContractorJobView | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [note, setNote] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch job data
  const fetchJob = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const res = await fetch(`/api/contractor/job/${token}`)
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to load job')
      }

      setJob(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchJob()
    }
  }, [token, fetchJob])

  // Advance to next stage
  const handleAdvance = async () => {
    try {
      setIsAdvancing(true)
      setError(null)

      const res = await fetch(`/api/contractor/job/${token}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || undefined }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to advance stage')
      }

      // Show success message
      if (data.data.is_complete) {
        setSuccessMessage('Job marked as complete')
      } else {
        setSuccessMessage('Stage completed')
      }

      // Clear note and refresh
      setNote('')
      setShowNoteInput(false)
      await fetchJob()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance stage')
    } finally {
      setIsAdvancing(false)
    }
  }

  // Save note without advancing
  const handleSaveNote = async () => {
    if (!note.trim()) return

    try {
      setIsSavingNote(true)
      setError(null)

      const res = await fetch(`/api/contractor/job/${token}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to save note')
      }

      setSuccessMessage('Note saved')
      setNote('')
      setShowNoteInput(false)
      await fetchJob()

      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setIsSavingNote(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    )
  }

  // Error state
  if (error && !job) {
    return (
      <div className="min-h-dvh bg-slate-50 flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h1 className="text-xl font-semibold text-slate-900 mb-2">
          Unable to Load Job
        </h1>
        <p className="text-sm text-slate-500 text-center max-w-xs">
          {error}
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => fetchJob()}
        >
          Try Again
        </Button>
      </div>
    )
  }

  if (!job) return null

  const { order, stages, currentStage, contractor } = job
  const sortedStages = [...stages].sort((a, b) => a.position - b.position)
  const isComplete = order.status === 'completed'

  return (
    <div className="min-h-dvh bg-slate-50 pb-safe">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-sm font-medium text-teal-600">Homework</h1>
              <p className="text-xs text-slate-500">Job #{order.order_number}</p>
            </div>
            {contractor.logo_url ? (
              <Image
                src={contractor.logo_url}
                alt={contractor.company_name || contractor.name}
                width={80}
                height={32}
                className="h-8 w-auto"
              />
            ) : (
              <span className="text-xs text-slate-400">
                {contractor.company_name || contractor.name}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Success message */}
      {successMessage && (
        <div className="bg-teal-500 text-white px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {/* Error message */}
      {error && job && (
        <div className="bg-red-50 text-red-700 px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Customer info */}
      <div className="bg-white border-b border-slate-100 px-4 py-4">
        <div className="space-y-2">
          {order.customer_name && (
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-900">
                {order.customer_name}
              </span>
            </div>
          )}

          {order.customer_address && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
              <span className="text-sm text-slate-600">
                {order.customer_address}
              </span>
            </div>
          )}

          {order.scheduled_date && (
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600">
                {new Date(order.scheduled_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
                {order.scheduled_time_slot && ` • ${order.scheduled_time_slot}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Current stage action area */}
      <div className="p-4">
        {isComplete ? (
          <div className="bg-teal-50 rounded-2xl p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-teal-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Job Complete
            </h2>
            <p className="text-sm text-slate-600">
              This job has been marked as complete.
            </p>
          </div>
        ) : currentStage ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">
                Current Stage
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                {currentStage.name}
              </h2>
              {currentStage.description && (
                <p className="text-sm text-slate-500 mt-1">
                  {currentStage.description}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="p-4 space-y-3">
              {/* Mark complete button - large tap target */}
              <Button
                onClick={handleAdvance}
                disabled={isAdvancing}
                className="w-full h-14 text-base font-medium bg-teal-600 hover:bg-teal-700"
              >
                {isAdvancing ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                )}
                Mark as Complete
              </Button>

              {/* Add note button */}
              {!showNoteInput && (
                <Button
                  variant="outline"
                  onClick={() => setShowNoteInput(true)}
                  className="w-full h-12"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Add Note for Customer
                </Button>
              )}

              {/* Note input */}
              {showNoteInput && (
                <div className="space-y-3">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note for the customer..."
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border border-slate-200',
                      'text-base placeholder:text-slate-400',
                      'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent',
                      'resize-none min-h-[100px]'
                    )}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowNoteInput(false)
                        setNote('')
                      }}
                      className="flex-1 h-11"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveNote}
                      disabled={!note.trim() || isSavingNote}
                      className="flex-1 h-11"
                    >
                      {isSavingNote ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Save Note'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Stage list */}
      <div className="px-4 pb-8">
        <h3 className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">
          All Stages
        </h3>

        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {sortedStages.map((stage) => (
            <StageListItem
              key={stage.id}
              stage={stage}
              isCurrent={stage.position === order.current_stage_position}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Stage list item component
function StageListItem({
  stage,
  isCurrent,
}: {
  stage: OrderStage
  isCurrent: boolean
}) {
  const status = stage.status as StageStatus

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        isCurrent && 'bg-teal-50/50'
      )}
    >
      {/* Status icon */}
      <div className="flex-shrink-0">
        {status === 'completed' ? (
          <CheckCircle2 className="w-5 h-5 text-teal-500" />
        ) : status === 'current' ? (
          <div className="w-5 h-5 rounded-full border-2 border-teal-500 bg-white flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          </div>
        ) : (
          <Circle className="w-5 h-5 text-slate-300" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium',
            status === 'completed' && 'text-slate-500',
            status === 'current' && 'text-slate-900',
            status === 'pending' && 'text-slate-400'
          )}
        >
          {stage.name}
        </p>
        {stage.contractor_note && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            Note: {stage.contractor_note}
          </p>
        )}
      </div>

      {/* Arrow for current */}
      {isCurrent && (
        <ChevronRight className="w-4 h-4 text-teal-500 flex-shrink-0" />
      )}
    </div>
  )
}
