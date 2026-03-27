'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { CheckCircle2, Lightbulb } from 'lucide-react'
import type { OrderStageWithContent, EducationalContent, StageStatus } from '@/types/tracker'

interface StageDetailSheetProps {
  stage: OrderStageWithContent | null
  isOpen: boolean
  onClose: () => void
}

function parseEducationalContent(content: unknown): EducationalContent | null {
  if (!content) return null
  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, unknown>
    if ('title' in obj && 'description' in obj) {
      return {
        title: String(obj.title || ''),
        description: String(obj.description || ''),
        tips: Array.isArray(obj.tips) ? obj.tips.map(String) : [],
      }
    }
  }
  return null
}

export function StageDetailSheet({
  stage,
  isOpen,
  onClose,
}: StageDetailSheetProps) {
  if (!stage) return null

  const educational = parseEducationalContent(stage.educational_content)
  const status = stage.status as StageStatus

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-2xl">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                status === 'completed' && 'bg-teal-100',
                status === 'current' && 'bg-teal-100',
                status === 'pending' && 'bg-slate-100'
              )}
            >
              <CheckCircle2
                className={cn(
                  'w-5 h-5',
                  status === 'completed' && 'text-teal-600',
                  status === 'current' && 'text-teal-600',
                  status === 'pending' && 'text-slate-400'
                )}
              />
            </div>
            <div>
              <SheetTitle className="text-left">{stage.name}</SheetTitle>
              <SheetDescription className="text-left">
                {status === 'completed' && 'Completed'}
                {status === 'current' && 'In progress'}
                {status === 'pending' && 'Coming up'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="py-4 space-y-6 overflow-y-auto">
          {/* Stage description */}
          {stage.description && (
            <div>
              <p className="text-sm text-slate-600">{stage.description}</p>
            </div>
          )}

          {/* Educational content */}
          {educational && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">
                {educational.title}
              </h3>
              <p className="text-sm text-slate-600">
                {educational.description}
              </p>

              {/* Tips */}
              {educational.tips && educational.tips.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Lightbulb className="w-4 h-4" />
                    <span className="text-sm font-medium">Tips</span>
                  </div>
                  <ul className="space-y-2">
                    {educational.tips.map((tip, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm text-amber-900"
                      >
                        <span className="text-amber-500 mt-0.5">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Contractor note */}
          {stage.contractor_note && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm font-medium text-slate-700 mb-1">
                Note from your installer
              </p>
              <p className="text-sm text-slate-600">{stage.contractor_note}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-xs text-slate-400 space-y-1">
            {stage.started_at && (
              <p>
                Started:{' '}
                {new Date(stage.started_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            )}
            {stage.completed_at && (
              <p>
                Completed:{' '}
                {new Date(stage.completed_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
