'use client';

import { useState, useRef, useEffect } from 'react';

type CallStatus = 'idle' | 'connecting' | 'active' | 'ended';

export default function VoiceNominate() {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const retellClientRef = useRef<any>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  async function startCall() {
    setError(null);
    setTranscript([]);
    setCallStatus('connecting');

    try {
      const res = await fetch('/api/nominations/voice-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start voice call');
      }

      const { access_token } = await res.json();

      const { RetellWebClient } = await import('retell-client-js-sdk');
      const retellClient = new RetellWebClient();
      retellClientRef.current = retellClient;

      retellClient.on('call_started', () => setCallStatus('active'));
      retellClient.on('call_ended', () => setCallStatus('ended'));
      retellClient.on('error', (err: any) => {
        console.error('Retell error:', err);
        setError(`Call error: ${err.message || 'Unknown error'}`);
        setCallStatus('ended');
      });
      retellClient.on('update', (update: any) => {
        if (update.transcript) setTranscript(update.transcript);
      });

      await retellClient.startCall({ accessToken: access_token });
    } catch (err: any) {
      console.error('Start call error:', err);
      setError(err.message || 'Failed to start call');
      setCallStatus('idle');
    }
  }

  function endCall() {
    if (retellClientRef.current) {
      retellClientRef.current.stopCall();
    }
    setCallStatus('ended');
  }

  function resetCall() {
    setCallStatus('idle');
    setTranscript([]);
    setError(null);
    retellClientRef.current = null;
  }

  if (callStatus === 'idle') {
    return (
      <div
        className="rounded-xl p-5 text-center"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="text-2xl mb-2">🎙️</div>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--christmas-cream)' }}>
          Prefer to talk?
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Tell us your nomination by voice instead of typing.
          <br />
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            This is an AI assistant in beta — we're still improving the experience.
          </span>
        </p>
        <button onClick={startCall} className="btn btn-primary">
          Nominate by Voice
        </button>
        {error && (
          <p className="text-xs mt-3" style={{ color: '#f87171' }}>{error}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          {callStatus === 'connecting' && (
            <>
              <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#eab308' }} />
              <span className="text-sm" style={{ color: '#eab308' }}>Connecting...</span>
            </>
          )}
          {callStatus === 'active' && (
            <>
              <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
              <span className="text-sm" style={{ color: '#22c55e' }}>Listening...</span>
            </>
          )}
          {callStatus === 'ended' && (
            <>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#9ca3af' }} />
              <span className="text-sm" style={{ color: '#9ca3af' }}>Call ended</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {callStatus === 'active' && (
            <button
              onClick={endCall}
              className="px-3 py-1 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
            >
              End Call
            </button>
          )}
          {callStatus === 'ended' && (
            <button
              onClick={resetCall}
              className="px-3 py-1 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}
            >
              Done
            </button>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div
        ref={transcriptRef}
        className="p-4 overflow-y-auto space-y-2"
        style={{ maxHeight: '300px', minHeight: '120px' }}
      >
        {transcript.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            {callStatus === 'connecting' ? 'Connecting to agent...' : 'Waiting for conversation...'}
          </p>
        ) : (
          transcript.map((turn, i) => (
            <div key={i} className={`flex ${turn.role === 'agent' ? 'justify-start' : 'justify-end'}`}>
              <div
                className="max-w-[85%] px-3 py-2 rounded-lg text-sm"
                style={{
                  background: turn.role === 'agent' ? 'rgba(93, 138, 102, 0.15)' : 'rgba(184, 149, 107, 0.15)',
                  color: 'var(--text-primary, #fff)',
                }}
              >
                {turn.content}
              </div>
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="px-4 pb-3">
          <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
        </div>
      )}

      {callStatus === 'ended' && (
        <div className="px-4 pb-4 text-center">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Your nomination has been submitted. Thank you!
          </p>
        </div>
      )}
    </div>
  );
}
