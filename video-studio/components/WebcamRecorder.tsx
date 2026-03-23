'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface WebcamRecorderProps {
  onRecorded: (blobUrl: string, blob: Blob) => void;
  maxDuration?: number; // seconds
}

export default function WebcamRecorder({ onRecorded, maxDuration = 60 }: WebcamRecorderProps) {
  const [state, setState] = useState<'idle' | 'previewing' | 'countdown' | 'recording' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [isUploading, setIsUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);
  const recordedUrlRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
      }
    };
  }, []);

  // Assign stream to video element once it's mounted
  useEffect(() => {
    if (state === 'previewing' || state === 'countdown' || state === 'recording') {
      if (videoRef.current && streamRef.current && !videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current;
      }
    }
  }, [state]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1920, height: 1080, facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setState('previewing');
    } catch (err: any) {
      setError('Could not access camera. Please allow camera permissions.');
      console.error('Camera error:', err);
    }
  }, []);

  const startCountdown = useCallback(() => {
    setCountdown(3);
    setState('countdown');
    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(interval);
        startRecording();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4';

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      recordedBlobRef.current = blob;
      recordedUrlRef.current = url;

      // Show playback
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = url;
        videoRef.current.play();
      }

      setState('done');
    };

    recorder.start(1000); // collect data every second
    setState('recording');
    setElapsed(0);

    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev + 1 >= maxDuration) {
          stopRecording();
          return prev + 1;
        }
        return prev + 1;
      });
    }, 1000);
  }, [maxDuration]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const retake = useCallback(() => {
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }
    recordedBlobRef.current = null;
    setElapsed(0);
    setState('idle');
  }, []);

  const handleUseRecording = useCallback(async () => {
    if (!recordedBlobRef.current) return;

    setIsUploading(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) throw new Error('Storage not configured');

      const ext = recordedBlobRef.current.type.includes('webm') ? 'webm' : 'mp4';
      const randomStr = Math.random().toString(36).substring(2, 10);
      const storagePath = `recordings/${Date.now()}-${randomStr}.${ext}`;

      const uploadRes = await fetch(
        `${supabaseUrl}/storage/v1/object/video-studio-media/${storagePath}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': recordedBlobRef.current.type,
          },
          body: recordedBlobRef.current,
        }
      );

      if (!uploadRes.ok) throw new Error('Upload failed');

      const publicUrl = `${supabaseUrl}/storage/v1/object/public/video-studio-media/${storagePath}`;
      onRecorded(publicUrl, recordedBlobRef.current);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [onRecorded]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      {/* Video preview area */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          backgroundColor: '#000',
          aspectRatio: '16/9',
        }}
      >
        {state === 'idle' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <button
              onClick={startCamera}
              className="btn btn-primary px-6 py-2.5"
            >
              Start Camera
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted={state !== 'done'}
            playsInline
            loop={state === 'done'}
            className="w-full h-full object-cover"
          />
        )}

        {/* Countdown overlay */}
        {state === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-8xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {countdown}
            </span>
          </div>
        )}

        {/* Recording indicator */}
        {state === 'recording' && (
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-mono text-white">
              {formatTime(elapsed)} / {formatTime(maxDuration)}
            </span>
          </div>
        )}

        {/* Progress bar during recording */}
        {state === 'recording' && (
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <div
              className="h-full transition-all duration-1000"
              style={{
                width: `${(elapsed / maxDuration) * 100}%`,
                backgroundColor: elapsed > maxDuration * 0.8 ? 'var(--status-error)' : 'var(--christmas-green)',
              }}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-4">
        {state === 'previewing' && (
          <button onClick={startCountdown} className="btn btn-primary px-6 py-2.5 gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            Record
          </button>
        )}

        {state === 'recording' && (
          <button onClick={stopRecording} className="btn px-6 py-2.5 gap-2" style={{ backgroundColor: 'var(--status-error)', color: '#fff' }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Stop
          </button>
        )}

        {state === 'done' && (
          <>
            <button onClick={retake} className="btn btn-secondary px-5 py-2.5">
              Retake
            </button>
            <button
              onClick={handleUseRecording}
              disabled={isUploading}
              className="btn btn-primary px-5 py-2.5"
              style={{ opacity: isUploading ? 0.6 : 1 }}
            >
              {isUploading ? 'Uploading...' : 'Use This Recording'}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm mt-3 text-center" style={{ color: 'var(--status-error)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
