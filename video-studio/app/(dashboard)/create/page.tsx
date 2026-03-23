'use client';

import { useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { TemplateId, TEMPLATES } from '@/remotion/constants';
import type { AllRenderOptions } from '@/lib/canvas-renderer';

const VideoPlayer = dynamic(() => import('@/components/VideoPlayer'), {
  ssr: false,
  loading: () => (
    <div
      className="rounded-xl flex items-center justify-center"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        aspectRatio: '16/9',
      }}
    >
      <p style={{ color: 'var(--text-muted)' }}>Loading preview...</p>
    </div>
  ),
});

const WebcamRecorder = dynamic(() => import('@/components/WebcamRecorder'), { ssr: false });
const VideoUploader = dynamic(() => import('@/components/VideoUploader'), { ssr: false });
const ExportModal = dynamic(() => import('@/components/ExportModal'), { ssr: false });

type VideoSource = 'text' | 'upload' | 'webcam';

function CreateContent() {
  const searchParams = useSearchParams();
  const templateParam = searchParams.get('template') as TemplateId | null;
  const sourceParam = searchParams.get('source') as VideoSource | null;
  const initialSource: VideoSource = sourceParam === 'upload' ? 'upload' : sourceParam === 'webcam' ? 'webcam' : 'text';
  const [template, setTemplate] = useState<TemplateId>(templateParam || 'team-update');
  const [duration, setDuration] = useState<number>(initialSource === 'text' ? (TEMPLATES[template]?.defaultDuration || 15) : 15);
  const [videoSource, setVideoSource] = useState<VideoSource>(initialSource);

  // Video source state
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [savedVideoId, setSavedVideoId] = useState<string | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);

  // Branded video overlay options
  const [speakerName, setSpeakerName] = useState('');
  const [speakerTitle, setSpeakerTitle] = useState('');
  const [showLowerThird, setShowLowerThird] = useState(true);
  const [showWatermark, setShowWatermark] = useState(true);
  const [videoLabel, setVideoLabel] = useState('Team Update');

  // Template-specific form state
  const [teamUpdateProps, setTeamUpdateProps] = useState({
    title: 'Weekly Team Update',
    speakerName: '',
    speakerTitle: '',
    message: '',
  });

  const [shoutoutProps, setShoutoutProps] = useState({
    recipientName: '',
    message: '',
    fromName: '',
    fromTitle: '',
  });

  const [announcementProps, setAnnouncementProps] = useState({
    headline: '',
    body: '',
    speakerName: '',
    speakerTitle: '',
  });

  const getTextProps = useCallback(() => {
    switch (template) {
      case 'team-update': return teamUpdateProps;
      case 'shoutout': return shoutoutProps;
      case 'announcement': return announcementProps;
    }
  }, [template, teamUpdateProps, shoutoutProps, announcementProps]);

  const getActiveTemplate = () => {
    if (videoSource === 'text') return template;
    return 'branded-video' as any;
  };

  const getActiveProps = () => {
    if (videoSource === 'text') return getTextProps();
    return {
      videoUrl: videoUrl || '',
      speakerName,
      speakerTitle,
      label: videoLabel,
      showLowerThird,
      showWatermark,
    };
  };

  const handleUpload = useCallback((url: string, fileName: string) => {
    setVideoUrl(url);
    setVideoFileName(fileName);
  }, []);

  const handleRecorded = useCallback((url: string) => {
    setVideoUrl(url);
    setVideoFileName('Webcam Recording');
  }, []);

  const clearVideo = useCallback(() => {
    setVideoUrl(null);
    setVideoFileName(null);
  }, []);

  const getRenderOptions = useCallback((): Record<string, any> => {
    if (videoSource !== 'text' && videoUrl) {
      return {
        type: 'branded-video',
        durationInSeconds: duration,
        introLabel: videoLabel,
        speakerName,
        speakerTitle,
        showLowerThird,
        showWatermark,
      };
    }
    const base = { durationInSeconds: duration, introLabel: TEMPLATES[template]?.name || 'Video Studio' };
    switch (template) {
      case 'team-update':
        return { ...base, type: 'team-update', ...teamUpdateProps };
      case 'shoutout':
        return { ...base, type: 'shoutout', ...shoutoutProps };
      case 'announcement':
        return { ...base, type: 'announcement', ...announcementProps };
      default:
        return { ...base, type: 'team-update', ...teamUpdateProps };
    }
  }, [videoSource, videoUrl, duration, videoLabel, speakerName, speakerTitle, showLowerThird, showWatermark, template, teamUpdateProps, shoutoutProps, announcementProps]);

  const canExport = videoSource === 'text' || !!videoUrl;

  const handleExport = useCallback(async () => {
    // Save draft to DB first
    try {
      const templateName = videoSource === 'text'
        ? TEMPLATES[template]?.name || template
        : videoLabel || 'Branded Video';

      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: templateName,
          template: videoSource === 'text' ? template : 'branded-video',
          templateProps: videoSource === 'text' ? getTextProps() : { speakerName, speakerTitle, showLowerThird, showWatermark, videoLabel },
          videoSource,
          sourceVideoUrl: videoUrl,
          durationSeconds: duration,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSavedVideoId(data.id);
      }
    } catch {
      // Still allow export even if save fails
    }

    setShowExport(true);
  }, [videoSource, template, videoLabel, videoUrl, duration, speakerName, speakerTitle, showLowerThird, showWatermark, getTextProps]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Create Video
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Choose your content source and customize
        </p>
      </div>

      {/* Source Tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { id: 'text' as VideoSource, label: 'Text Template', icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          )},
          { id: 'upload' as VideoSource, label: 'Upload Video', icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )},
          { id: 'webcam' as VideoSource, label: 'Record Webcam', icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )},
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => { setVideoSource(tab.id); clearVideo(); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: videoSource === tab.id ? 'rgba(93, 138, 102, 0.15)' : 'var(--bg-card)',
              color: videoSource === tab.id ? 'var(--christmas-cream)' : 'var(--text-secondary)',
              border: `1px solid ${videoSource === tab.id ? 'var(--christmas-green-dark)' : 'var(--border-subtle)'}`,
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="space-y-4">
          {/* Text template mode */}
          {videoSource === 'text' && (
            <>
              {/* Template selector */}
              <div className="card">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Template
                </label>
                <div className="flex gap-2">
                  {(Object.entries(TEMPLATES) as [TemplateId, typeof TEMPLATES[TemplateId]][]).map(([id, tmpl]) => (
                    <button
                      key={id}
                      onClick={() => { setTemplate(id); setDuration(tmpl.defaultDuration); }}
                      className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                      style={{
                        backgroundColor: template === id ? 'rgba(93, 138, 102, 0.15)' : 'transparent',
                        color: template === id ? 'var(--christmas-cream)' : 'var(--text-muted)',
                        border: `1px solid ${template === id ? 'var(--christmas-green-dark)' : 'var(--border-subtle)'}`,
                      }}
                    >
                      {tmpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="card">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Duration: {duration}s
                </label>
                <input
                  type="range"
                  min={5}
                  max={TEMPLATES[template]?.maxDuration || 60}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: 'var(--christmas-green)' }}
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  <span>5s</span>
                  <span>{TEMPLATES[template]?.maxDuration || 60}s</span>
                </div>
              </div>

              {/* Template-specific fields */}
              {template === 'team-update' && (
                <div className="card space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title</label>
                    <input className="input" value={teamUpdateProps.title} onChange={(e) => setTeamUpdateProps(p => ({ ...p, title: e.target.value }))} placeholder="Weekly Team Update" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Your Name</label>
                      <input className="input" value={teamUpdateProps.speakerName} onChange={(e) => setTeamUpdateProps(p => ({ ...p, speakerName: e.target.value }))} placeholder="John Smith" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Your Title</label>
                      <input className="input" value={teamUpdateProps.speakerTitle} onChange={(e) => setTeamUpdateProps(p => ({ ...p, speakerTitle: e.target.value }))} placeholder="Operations Manager" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Message</label>
                    <textarea className="input" rows={4} value={teamUpdateProps.message} onChange={(e) => setTeamUpdateProps(p => ({ ...p, message: e.target.value }))} placeholder="Great work this week team!..." style={{ resize: 'vertical' }} />
                  </div>
                </div>
              )}

              {template === 'shoutout' && (
                <div className="card space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Who are you recognizing?</label>
                    <input className="input" value={shoutoutProps.recipientName} onChange={(e) => setShoutoutProps(p => ({ ...p, recipientName: e.target.value }))} placeholder="Jane Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Recognition Message</label>
                    <textarea className="input" rows={3} value={shoutoutProps.message} onChange={(e) => setShoutoutProps(p => ({ ...p, message: e.target.value }))} placeholder="Went above and beyond..." style={{ resize: 'vertical' }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>From (Your Name)</label>
                      <input className="input" value={shoutoutProps.fromName} onChange={(e) => setShoutoutProps(p => ({ ...p, fromName: e.target.value }))} placeholder="John Smith" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Your Title</label>
                      <input className="input" value={shoutoutProps.fromTitle} onChange={(e) => setShoutoutProps(p => ({ ...p, fromTitle: e.target.value }))} placeholder="Team Lead" />
                    </div>
                  </div>
                </div>
              )}

              {template === 'announcement' && (
                <div className="card space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Headline</label>
                    <input className="input" value={announcementProps.headline} onChange={(e) => setAnnouncementProps(p => ({ ...p, headline: e.target.value }))} placeholder="New Safety Protocol" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Details</label>
                    <textarea className="input" rows={4} value={announcementProps.body} onChange={(e) => setAnnouncementProps(p => ({ ...p, body: e.target.value }))} placeholder="Starting next Monday..." style={{ resize: 'vertical' }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Your Name</label>
                      <input className="input" value={announcementProps.speakerName} onChange={(e) => setAnnouncementProps(p => ({ ...p, speakerName: e.target.value }))} placeholder="John Smith" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Your Title</label>
                      <input className="input" value={announcementProps.speakerTitle} onChange={(e) => setAnnouncementProps(p => ({ ...p, speakerTitle: e.target.value }))} placeholder="General Manager" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Upload mode */}
          {videoSource === 'upload' && (
            <>
              {videoUrl ? (
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--status-success)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {videoFileName}
                      </span>
                    </div>
                    <button onClick={clearVideo} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}>
                      Change
                    </button>
                  </div>
                  <video src={videoUrl} className="w-full rounded-lg" controls style={{ maxHeight: 200 }} />
                </div>
              ) : (
                <VideoUploader onUpload={handleUpload} />
              )}

              {/* Branding options */}
              <BrandingOptions
                speakerName={speakerName}
                setSpeakerName={setSpeakerName}
                speakerTitle={speakerTitle}
                setSpeakerTitle={setSpeakerTitle}
                showLowerThird={showLowerThird}
                setShowLowerThird={setShowLowerThird}
                showWatermark={showWatermark}
                setShowWatermark={setShowWatermark}
                videoLabel={videoLabel}
                setVideoLabel={setVideoLabel}
                duration={duration}
                setDuration={setDuration}
              />
            </>
          )}

          {/* Webcam mode */}
          {videoSource === 'webcam' && (
            <>
              {videoUrl ? (
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--status-success)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        Recording uploaded
                      </span>
                    </div>
                    <button onClick={clearVideo} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}>
                      Re-record
                    </button>
                  </div>
                  <video src={videoUrl} className="w-full rounded-lg" controls style={{ maxHeight: 200 }} />
                </div>
              ) : (
                <WebcamRecorder onRecorded={handleRecorded} maxDuration={60} />
              )}

              {/* Branding options */}
              <BrandingOptions
                speakerName={speakerName}
                setSpeakerName={setSpeakerName}
                speakerTitle={speakerTitle}
                setSpeakerTitle={setSpeakerTitle}
                showLowerThird={showLowerThird}
                setShowLowerThird={setShowLowerThird}
                showWatermark={showWatermark}
                setShowWatermark={setShowWatermark}
                videoLabel={videoLabel}
                setVideoLabel={setVideoLabel}
                duration={duration}
                setDuration={setDuration}
              />
            </>
          )}
        </div>

        {/* Right: Preview */}
        <div>
          <div className="sticky top-4">
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
              Live Preview
            </h2>
            {(videoSource === 'text' || videoUrl) ? (
              <>
                <VideoPlayer
                  template={getActiveTemplate()}
                  props={getActiveProps()}
                  durationInSeconds={duration}
                />
                <p className="text-xs mt-2 mb-4" style={{ color: 'var(--text-muted)' }}>
                  Use the controls to play/pause and scrub through the video. Changes update in real-time.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleExport}
                    disabled={!canExport}
                    className="btn btn-primary w-full py-3 gap-2 text-base"
                    style={{ opacity: canExport ? 1 : 0.5 }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export Branded Video
                  </button>
                  {videoUrl && videoSource !== 'text' && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(videoUrl);
                          const blob = await res.blob();
                          const blobUrl = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = blobUrl;
                          a.download = `original-${Date.now()}.webm`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(blobUrl);
                        } catch {
                          window.open(videoUrl, '_blank');
                        }
                      }}
                      className="btn btn-secondary w-full py-2.5 gap-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Original (No Branding)
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div
                className="rounded-xl flex flex-col items-center justify-center"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  aspectRatio: '16/9',
                }}
              >
                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {videoSource === 'upload' ? 'Upload a video to preview' : 'Record a video to preview'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden video element for rendering branded videos */}
      {videoUrl && (
        <video
          ref={hiddenVideoRef}
          src={videoUrl}
          crossOrigin="anonymous"
          playsInline
          muted
          preload="auto"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={showExport}
        onClose={() => { setShowExport(false); setSavedVideoId(null); }}
        renderOptions={getRenderOptions()}
        videoElement={hiddenVideoRef.current}
        videoId={savedVideoId}
      />
    </div>
  );
}

function BrandingOptions({
  speakerName, setSpeakerName,
  speakerTitle, setSpeakerTitle,
  showLowerThird, setShowLowerThird,
  showWatermark, setShowWatermark,
  videoLabel, setVideoLabel,
  duration, setDuration,
}: {
  speakerName: string; setSpeakerName: (v: string) => void;
  speakerTitle: string; setSpeakerTitle: (v: string) => void;
  showLowerThird: boolean; setShowLowerThird: (v: boolean) => void;
  showWatermark: boolean; setShowWatermark: (v: boolean) => void;
  videoLabel: string; setVideoLabel: (v: string) => void;
  duration: number; setDuration: (v: number) => void;
}) {
  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        Branding Options
      </h3>

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          Total Duration: {duration}s
        </label>
        <input
          type="range"
          min={7}
          max={60}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: 'var(--christmas-green)' }}
        />
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Includes 2s intro + 2s outro
        </p>
      </div>

      {/* Intro label */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Intro Label
        </label>
        <select
          className="select"
          value={videoLabel}
          onChange={(e) => setVideoLabel(e.target.value)}
        >
          <option value="Team Update">Team Update</option>
          <option value="Shoutout">Shoutout</option>
          <option value="Announcement">Announcement</option>
          <option value="Message from Leadership">Message from Leadership</option>
          <option value="Quick Update">Quick Update</option>
        </select>
      </div>

      {/* Lower third */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showLowerThird}
            onChange={(e) => setShowLowerThird(e.target.checked)}
            style={{ accentColor: 'var(--christmas-green)' }}
          />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Show lower third</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showWatermark}
            onChange={(e) => setShowWatermark(e.target.checked)}
            style={{ accentColor: 'var(--christmas-green)' }}
          />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Show logo watermark</span>
        </label>
      </div>

      {showLowerThird && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Your Name</label>
            <input className="input" value={speakerName} onChange={(e) => setSpeakerName(e.target.value)} placeholder="John Smith" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Your Title</label>
            <input className="input" value={speakerTitle} onChange={(e) => setSpeakerTitle(e.target.value)} placeholder="Operations Manager" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)' }}>Loading...</div>}>
      <CreateContent />
    </Suspense>
  );
}
