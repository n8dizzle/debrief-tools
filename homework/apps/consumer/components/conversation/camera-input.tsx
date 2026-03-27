'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, X, Check, Loader2, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Chip } from '@/lib/flows'

interface CameraInputProps {
  onSubmit: (imageData: string) => void
  onChipSelect?: (chip: Chip) => void
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  chips?: Chip[]
  className?: string
}

export function CameraInput({
  onSubmit,
  onChipSelect,
  placeholder = 'Take a photo or upload an image',
  disabled = false,
  isLoading = false,
  chips,
  className,
}: CameraInputProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be less than 10MB')
      return
    }

    // Read and preview
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }, [])

  // Start camera capture
  const startCamera = useCallback(async () => {
    try {
      setIsCapturing(true)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Prefer back camera
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (err) {
      console.error('Camera access denied:', err)
      setIsCapturing(false)
      // Fallback to file upload
      fileInputRef.current?.click()
    }
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsCapturing(false)
  }, [])

  // Capture photo from video
  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      setPreview(dataUrl)
      stopCamera()
    }
  }, [stopCamera])

  // Clear preview
  const clearPreview = useCallback(() => {
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Submit image
  const handleSubmit = useCallback(() => {
    if (!preview || disabled || isLoading) return
    onSubmit(preview)
  }, [preview, disabled, isLoading, onSubmit])

  const handleChipClick = useCallback((chip: Chip) => {
    onChipSelect?.(chip)
  }, [onChipSelect])

  return (
    <div className={cn('relative w-full pb-[env(safe-area-inset-bottom,0px)]', className)}>
      {/* Chips */}
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => handleChipClick(chip)}
              disabled={disabled || isLoading}
              className={cn(
                'inline-flex items-center gap-1.5',
                'px-4 py-2.5 rounded-full',
                'text-sm font-medium',
                'bg-card border border-border',
                'text-foreground',
                'hover:bg-muted hover:border-primary/30',
                'active:scale-[0.98]',
                'transition-all duration-150',
                'disabled:opacity-50 disabled:pointer-events-none',
                'min-h-[44px]'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Camera capture view */}
      {isCapturing && (
        <div className="relative rounded-2xl overflow-hidden bg-black mb-3">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-[4/3] object-cover"
          />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
            <button
              type="button"
              onClick={stopCamera}
              className={cn(
                'flex items-center justify-center',
                'h-12 w-12 rounded-full',
                'bg-white/20 backdrop-blur-sm text-white',
                'hover:bg-white/30',
                'transition-colors'
              )}
            >
              <X className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              className={cn(
                'flex items-center justify-center',
                'h-16 w-16 rounded-full',
                'bg-white text-foreground',
                'ring-4 ring-white/50',
                'hover:bg-white/90',
                'active:scale-95',
                'transition-all'
              )}
            >
              <Camera className="h-8 w-8" />
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && !isCapturing && (
        <div className="relative rounded-2xl overflow-hidden mb-3">
          <img
            src={preview}
            alt="Captured"
            className="w-full aspect-[4/3] object-cover"
          />
          <button
            type="button"
            onClick={clearPreview}
            className={cn(
              'absolute top-2 right-2',
              'flex items-center justify-center',
              'h-8 w-8 rounded-full',
              'bg-black/50 backdrop-blur-sm text-white',
              'hover:bg-black/70',
              'transition-colors'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main card */}
      <div
        className={cn(
          'rounded-2xl border bg-card',
          'shadow-[0_2px_12px_rgba(0,0,0,0.08)]',
          'p-4',
          'transition-shadow duration-200',
          preview && 'border-primary/30'
        )}
      >
        {!preview && !isCapturing ? (
          // Initial state - show capture options
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground text-center">
              {placeholder}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={startCamera}
                disabled={disabled}
                className={cn(
                  'flex items-center gap-2',
                  'px-6 py-3 rounded-xl',
                  'bg-primary text-primary-foreground',
                  'font-medium text-sm',
                  'hover:bg-primary/90',
                  'active:scale-[0.98]',
                  'transition-all duration-150',
                  'disabled:opacity-50 disabled:pointer-events-none',
                  'min-h-[44px]'
                )}
              >
                <Camera className="h-5 w-5" />
                Take Photo
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className={cn(
                  'flex items-center gap-2',
                  'px-6 py-3 rounded-xl',
                  'bg-muted text-foreground',
                  'font-medium text-sm',
                  'hover:bg-muted/80',
                  'active:scale-[0.98]',
                  'transition-all duration-150',
                  'disabled:opacity-50 disabled:pointer-events-none',
                  'min-h-[44px]'
                )}
              >
                <Upload className="h-5 w-5" />
                Upload
              </button>
            </div>
          </div>
        ) : preview ? (
          // Preview state - show submit button
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || isLoading}
            className={cn(
              'w-full flex items-center justify-center gap-2',
              'py-3 rounded-xl',
              'bg-primary text-primary-foreground',
              'font-medium text-sm',
              'hover:bg-primary/90',
              'active:scale-[0.98]',
              'transition-all duration-150',
              'disabled:opacity-50',
              'min-h-[44px]'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                Use This Photo
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  )
}
