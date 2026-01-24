'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MediaPicker from './MediaPicker';
import type { GBPPostTopicType } from '@/lib/supabase';

interface PostComposerProps {
  initialData?: {
    id?: string;
    summary?: string;
    topic_type?: GBPPostTopicType;
    cta_type?: string | null;
    cta_url?: string | null;
    event_title?: string | null;
    event_start_date?: string | null;
    event_end_date?: string | null;
    coupon_code?: string | null;
    redeem_url?: string | null;
    terms_conditions?: string | null;
    media_urls?: string[];
  };
  onSave?: (data: any) => void;
}

const CTA_OPTIONS = [
  { value: '', label: 'No button' },
  { value: 'BOOK', label: 'Book' },
  { value: 'ORDER', label: 'Order online' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'LEARN_MORE', label: 'Learn more' },
  { value: 'SIGN_UP', label: 'Sign up' },
  { value: 'GET_OFFER', label: 'Get offer' },
  { value: 'CALL', label: 'Call now' },
];

const TOPIC_TYPES: { value: GBPPostTopicType; label: string; description: string }[] = [
  { value: 'STANDARD', label: 'Update', description: 'Share news, updates, or information' },
  { value: 'EVENT', label: 'Event', description: 'Promote an upcoming event with dates' },
  { value: 'OFFER', label: 'Offer', description: 'Share a special deal or coupon' },
];

export default function PostComposer({ initialData, onSave }: PostComposerProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [topicType, setTopicType] = useState<GBPPostTopicType>(initialData?.topic_type || 'STANDARD');
  const [summary, setSummary] = useState(initialData?.summary || '');
  const [ctaType, setCtaType] = useState(initialData?.cta_type || '');
  const [ctaUrl, setCtaUrl] = useState(initialData?.cta_url || '');
  const [eventTitle, setEventTitle] = useState(initialData?.event_title || '');
  const [eventStartDate, setEventStartDate] = useState(
    initialData?.event_start_date ? initialData.event_start_date.split('T')[0] : ''
  );
  const [eventEndDate, setEventEndDate] = useState(
    initialData?.event_end_date ? initialData.event_end_date.split('T')[0] : ''
  );
  const [couponCode, setCouponCode] = useState(initialData?.coupon_code || '');
  const [redeemUrl, setRedeemUrl] = useState(initialData?.redeem_url || '');
  const [termsConditions, setTermsConditions] = useState(initialData?.terms_conditions || '');
  const [mediaUrls, setMediaUrls] = useState<string[]>(initialData?.media_urls || []);

  const isEditing = !!initialData?.id;
  const charCount = summary.length;
  const maxChars = 1500;

  const validateForm = () => {
    if (!summary.trim()) {
      setError('Post content is required');
      return false;
    }
    if (topicType === 'EVENT' && !eventTitle.trim()) {
      setError('Event title is required for event posts');
      return false;
    }
    if (ctaType && ctaType !== 'CALL' && !ctaUrl.trim()) {
      setError('URL is required for the selected button type');
      return false;
    }
    return true;
  };

  const buildPostData = () => ({
    summary: summary.trim(),
    topic_type: topicType,
    cta_type: ctaType || null,
    cta_url: ctaUrl || null,
    event_title: topicType === 'EVENT' ? eventTitle || null : null,
    event_start_date: topicType === 'EVENT' && eventStartDate ? `${eventStartDate}T00:00:00Z` : null,
    event_end_date: topicType === 'EVENT' && eventEndDate ? `${eventEndDate}T23:59:59Z` : null,
    coupon_code: topicType === 'OFFER' ? couponCode || null : null,
    redeem_url: topicType === 'OFFER' ? redeemUrl || null : null,
    terms_conditions: topicType === 'OFFER' ? termsConditions || null : null,
    media_urls: mediaUrls,
  });

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    setError(null);

    try {
      const postData = buildPostData();
      const url = isEditing ? `/api/gbp/posts/${initialData.id}` : '/api/gbp/posts';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save post');
      }

      if (onSave) {
        onSave(data);
      } else {
        router.push(`/posts/${data.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save post');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validateForm()) return;

    // First save if not saved
    let postId = initialData?.id;

    setIsPublishing(true);
    setError(null);

    try {
      if (!postId) {
        // Create the post first
        const createResponse = await fetch('/api/gbp/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPostData()),
        });

        const createData = await createResponse.json();
        if (!createResponse.ok) {
          throw new Error(createData.error || 'Failed to create post');
        }
        postId = createData.id;
      }

      // Now publish
      const publishResponse = await fetch(`/api/gbp/posts/${postId}/publish`, {
        method: 'POST',
      });

      const publishData = await publishResponse.json();

      if (!publishResponse.ok) {
        throw new Error(publishData.error || 'Failed to publish post');
      }

      // Redirect to the post detail page
      router.push(`/posts/${postId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish post');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Post Type Selection */}
      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--christmas-cream)' }}>
          Post Type
        </label>
        <div className="grid grid-cols-3 gap-3">
          {TOPIC_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setTopicType(type.value)}
              className="p-4 rounded-lg text-left transition-all"
              style={{
                backgroundColor: topicType === type.value ? 'var(--christmas-green)' : 'var(--bg-card)',
                border: topicType === type.value ? '2px solid var(--christmas-green)' : '1px solid var(--border-subtle)',
                color: topicType === type.value ? 'var(--christmas-cream)' : 'var(--text-secondary)',
              }}
            >
              <div className="font-medium">{type.label}</div>
              <div className="text-xs mt-1 opacity-75">{type.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Post Content */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--christmas-cream)' }}>
          Post Content
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={5}
          maxLength={maxChars}
          placeholder="Write your post content here..."
          className="w-full rounded-lg px-4 py-3 resize-none"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--christmas-cream)',
          }}
        />
        <div className="flex justify-end mt-1">
          <span
            className="text-xs"
            style={{ color: charCount > maxChars * 0.9 ? '#ef4444' : 'var(--text-muted)' }}
          >
            {charCount}/{maxChars}
          </span>
        </div>
      </div>

      {/* Media */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--christmas-cream)' }}>
          Photos (optional)
        </label>
        <MediaPicker selectedUrls={mediaUrls} onSelect={setMediaUrls} maxItems={10} />
      </div>

      {/* Event Fields */}
      {topicType === 'EVENT' && (
        <div className="space-y-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <h4 className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
            Event Details
          </h4>

          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Event Title *
            </label>
            <input
              type="text"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="e.g., Summer AC Tune-Up Special"
              className="w-full rounded-lg px-4 py-2"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--christmas-cream)',
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                Start Date
              </label>
              <input
                type="date"
                value={eventStartDate}
                onChange={(e) => setEventStartDate(e.target.value)}
                className="w-full rounded-lg px-4 py-2"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--christmas-cream)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                End Date
              </label>
              <input
                type="date"
                value={eventEndDate}
                onChange={(e) => setEventEndDate(e.target.value)}
                className="w-full rounded-lg px-4 py-2"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--christmas-cream)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Offer Fields */}
      {topicType === 'OFFER' && (
        <div className="space-y-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <h4 className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
            Offer Details
          </h4>

          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Coupon Code (optional)
            </label>
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="e.g., SUMMER20"
              className="w-full rounded-lg px-4 py-2"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--christmas-cream)',
              }}
            />
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Redeem Online URL (optional)
            </label>
            <input
              type="url"
              value={redeemUrl}
              onChange={(e) => setRedeemUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg px-4 py-2"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--christmas-cream)',
              }}
            />
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Terms & Conditions (optional)
            </label>
            <textarea
              value={termsConditions}
              onChange={(e) => setTermsConditions(e.target.value)}
              rows={2}
              placeholder="e.g., Cannot be combined with other offers..."
              className="w-full rounded-lg px-4 py-2 resize-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--christmas-cream)',
              }}
            />
          </div>
        </div>
      )}

      {/* Call to Action */}
      <div className="space-y-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <h4 className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
          Call to Action Button (optional)
        </h4>

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            Button Type
          </label>
          <select
            value={ctaType}
            onChange={(e) => setCtaType(e.target.value)}
            className="w-full rounded-lg px-4 py-2"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--christmas-cream)',
            }}
          >
            {CTA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {ctaType && ctaType !== 'CALL' && (
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Button URL *
            </label>
            <input
              type="url"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg px-4 py-2"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--christmas-cream)',
              }}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-lg transition-colors"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isPublishing}
          className="px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--christmas-cream)',
          }}
        >
          {isSaving ? 'Saving...' : 'Save Draft'}
        </button>

        <button
          type="button"
          onClick={handlePublish}
          disabled={isSaving || isPublishing}
          className="px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'var(--christmas-green)',
            color: 'var(--christmas-cream)',
          }}
        >
          {isPublishing ? 'Publishing...' : 'Publish Now'}
        </button>
      </div>
    </div>
  );
}
