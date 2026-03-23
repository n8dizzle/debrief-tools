'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { TemplateId, TEMPLATES } from '@/remotion/constants';

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

function CreateContent() {
  const searchParams = useSearchParams();
  const templateParam = searchParams.get('template') as TemplateId | null;
  const [template] = useState<TemplateId>(templateParam || 'team-update');
  const [duration, setDuration] = useState<number>(TEMPLATES[template]?.defaultDuration || 15);

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

  const getProps = () => {
    switch (template) {
      case 'team-update':
        return teamUpdateProps;
      case 'shoutout':
        return shoutoutProps;
      case 'announcement':
        return announcementProps;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Create {TEMPLATES[template]?.name || 'Video'}
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Fill in the details and preview your video in real-time
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="space-y-4">
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
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Title
                </label>
                <input
                  className="input"
                  value={teamUpdateProps.title}
                  onChange={(e) => setTeamUpdateProps(p => ({ ...p, title: e.target.value }))}
                  placeholder="Weekly Team Update"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Your Name
                  </label>
                  <input
                    className="input"
                    value={teamUpdateProps.speakerName}
                    onChange={(e) => setTeamUpdateProps(p => ({ ...p, speakerName: e.target.value }))}
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Your Title
                  </label>
                  <input
                    className="input"
                    value={teamUpdateProps.speakerTitle}
                    onChange={(e) => setTeamUpdateProps(p => ({ ...p, speakerTitle: e.target.value }))}
                    placeholder="Operations Manager"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Message
                </label>
                <textarea
                  className="input"
                  rows={4}
                  value={teamUpdateProps.message}
                  onChange={(e) => setTeamUpdateProps(p => ({ ...p, message: e.target.value }))}
                  placeholder="Great work this week team! We hit our revenue targets and customer satisfaction scores are up..."
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          )}

          {template === 'shoutout' && (
            <div className="card space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Who are you recognizing?
                </label>
                <input
                  className="input"
                  value={shoutoutProps.recipientName}
                  onChange={(e) => setShoutoutProps(p => ({ ...p, recipientName: e.target.value }))}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Recognition Message
                </label>
                <textarea
                  className="input"
                  rows={3}
                  value={shoutoutProps.message}
                  onChange={(e) => setShoutoutProps(p => ({ ...p, message: e.target.value }))}
                  placeholder="Went above and beyond helping a customer..."
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    From (Your Name)
                  </label>
                  <input
                    className="input"
                    value={shoutoutProps.fromName}
                    onChange={(e) => setShoutoutProps(p => ({ ...p, fromName: e.target.value }))}
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Your Title
                  </label>
                  <input
                    className="input"
                    value={shoutoutProps.fromTitle}
                    onChange={(e) => setShoutoutProps(p => ({ ...p, fromTitle: e.target.value }))}
                    placeholder="Team Lead"
                  />
                </div>
              </div>
            </div>
          )}

          {template === 'announcement' && (
            <div className="card space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Headline
                </label>
                <input
                  className="input"
                  value={announcementProps.headline}
                  onChange={(e) => setAnnouncementProps(p => ({ ...p, headline: e.target.value }))}
                  placeholder="New Safety Protocol"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Details
                </label>
                <textarea
                  className="input"
                  rows={4}
                  value={announcementProps.body}
                  onChange={(e) => setAnnouncementProps(p => ({ ...p, body: e.target.value }))}
                  placeholder="Starting next Monday, all field teams will..."
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Your Name
                  </label>
                  <input
                    className="input"
                    value={announcementProps.speakerName}
                    onChange={(e) => setAnnouncementProps(p => ({ ...p, speakerName: e.target.value }))}
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Your Title
                  </label>
                  <input
                    className="input"
                    value={announcementProps.speakerTitle}
                    onChange={(e) => setAnnouncementProps(p => ({ ...p, speakerTitle: e.target.value }))}
                    placeholder="General Manager"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div>
          <div className="sticky top-4">
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
              Live Preview
            </h2>
            <VideoPlayer
              template={template}
              props={getProps()}
              durationInSeconds={duration}
            />
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Use the controls to play/pause and scrub through the video. Changes update in real-time.
            </p>
          </div>
        </div>
      </div>
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
