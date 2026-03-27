'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { DdDocument, DdActionItem, DdChatMessage, DdDocumentPage } from '@/lib/supabase';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', className: 'badge-new' },
  { value: 'in_progress', label: 'In Progress', className: 'badge-in-progress' },
  { value: 'complete', label: 'Complete', className: 'badge-complete' },
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High', className: 'badge-high' },
  { value: 'medium', label: 'Medium', className: 'badge-medium' },
  { value: 'low', label: 'Low', className: 'badge-low' },
];

const STARTER_QUESTIONS: Record<string, string[]> = {
  invoice: ['What are the payment terms?', 'What is the total amount due?', 'What is the contact info?'],
  permit: ['When does this expire?', 'What are the conditions?', 'What is the permit number?'],
  contract: ['What are the key terms?', 'When does this expire?', 'What are the payment terms?'],
  default: ['What is the contact info?', 'When is this due?', 'What are the key details?'],
};

function formatDocType(type: string | null): string {
  if (!type) return 'Unknown';
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [doc, setDoc] = useState<DdDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [newAction, setNewAction] = useState('');
  const [addingAction, setAddingAction] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [driveUploading, setDriveUploading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageRotations, setImageRotations] = useState<Record<string, number>>({});

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<DdChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [showCcField, setShowCcField] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSelectedIds, setEmailSelectedIds] = useState<string[]>([]);
  const [emailIncludeImage, setEmailIncludeImage] = useState(false);
  const [emailIncludeAnalysis, setEmailIncludeAnalysis] = useState(false);
  const [emailIncludeChat, setEmailIncludeChat] = useState(false);
  const [emailIncludeNotes, setEmailIncludeNotes] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<{ id: string; name: string; email: string }[]>([]);
  const [showStaffSuggestions, setShowStaffSuggestions] = useState(false);
  const [showCcStaffSuggestions, setShowCcStaffSuggestions] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const ccInputRef = useRef<HTMLInputElement>(null);
  const [staffLoaded, setStaffLoaded] = useState(false);

  useEffect(() => {
    fetchDocument();
    loadStaffList();
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchDocument = async () => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (!res.ok) throw new Error('Failed to load document');
      const data = await res.json();
      setDoc(data);
      setNotes(data.notes || '');
      // Initialize rotations from DB
      const rots: Record<string, number> = {};
      if (data.pages?.length) {
        for (const p of data.pages) {
          if (p.rotation) rots[`page-${p.id}`] = p.rotation;
        }
      } else if (data.rotation) {
        rots['single'] = data.rotation;
      }
      setImageRotations(rots);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const rotateImage = async (key: string, pageId?: string) => {
    const newRotation = ((imageRotations[key] || 0) + 90) % 360;
    setImageRotations(prev => ({ ...prev, [key]: newRotation }));
    // Save to DB
    if (pageId) {
      await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageRotations: { [pageId]: newRotation } }),
      });
    } else {
      await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotation: newRotation }),
      });
    }
  };

  const updateDocument = async (updates: Partial<DdDocument>) => {
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update');
      // Re-fetch full document to get all joined data (owner, pages, action_items, signed URLs)
      await fetchDocument();
    } catch (err: any) {
      console.error('Update error:', err);
    }
  };

  const handleDriveUpload = async () => {
    setDriveUploading(true);
    setDriveError(null);
    try {
      const res = await fetch(`/api/documents/${id}/drive`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDoc(prev => prev ? { ...prev, drive_file_id: data.drive_file_id } : prev);
      } else if (res.status === 409) {
        // Already uploaded — refresh doc to get the drive_file_id
        await fetchDocument();
      } else {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        setDriveError(data.error || 'Upload failed');
      }
    } catch (err) {
      setDriveError('Failed to upload to Google Drive');
    } finally {
      setDriveUploading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/inbox');
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      const res = await fetch(`/api/documents/${id}/analyze`, { method: 'POST' });
      if (res.ok) {
        await fetchDocument();
      }
    } catch (err) {
      console.error('Reanalyze error:', err);
    } finally {
      setReanalyzing(false);
    }
  };

  const handleAddAction = async () => {
    if (!newAction.trim()) return;
    setAddingAction(true);
    try {
      const res = await fetch(`/api/documents/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newAction.trim() }),
      });
      if (res.ok) {
        setNewAction('');
        await fetchDocument();
      }
    } catch (err) {
      console.error('Add action error:', err);
    } finally {
      setAddingAction(false);
    }
  };

  const handleActionStatusChange = async (actionId: string, status: string) => {
    try {
      const res = await fetch(`/api/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await fetchDocument();
      }
    } catch (err) {
      console.error('Action update error:', err);
    }
  };

  const handleSaveNotes = async () => {
    await updateDocument({ notes });
    setEditingNotes(false);
  };

  // Chat functions
  const loadChatHistory = async () => {
    if (chatHistoryLoaded) return;
    try {
      const res = await fetch(`/api/documents/${id}/chat`);
      if (res.ok) {
        const messages = await res.json();
        setChatMessages(messages);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
    setChatHistoryLoaded(true);
  };

  const handleChatToggle = () => {
    const opening = !chatOpen;
    setChatOpen(opening);
    if (opening) {
      loadChatHistory();
    }
  };

  const handleChatSend = async (messageText?: string) => {
    const text = messageText || chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatLoading(true);

    // Optimistically add user message
    const tempUserMsg: DdChatMessage = {
      id: 'temp-user-' + Date.now(),
      document_id: id,
      role: 'user',
      content: text,
      user_id: null,
      created_at: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/documents/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: DdChatMessage = {
          id: 'temp-assistant-' + Date.now(),
          document_id: id,
          role: 'assistant',
          content: data.content,
          user_id: null,
          created_at: new Date().toISOString(),
        };
        setChatMessages(prev => [...prev, assistantMsg]);
      } else {
        const errData = await res.json().catch(() => ({ error: 'Failed to get response' }));
        setChatMessages(prev => [...prev, {
          id: 'temp-error-' + Date.now(),
          document_id: id,
          role: 'assistant',
          content: `Error: ${errData.error || 'Something went wrong'}`,
          user_id: null,
          created_at: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      console.error('Chat send error:', err);
    } finally {
      setChatLoading(false);
    }
  };

  // Email functions
  const openEmailModal = () => {
    const actionItems = (doc?.action_items || []) as DdActionItem[];
    const pendingIds = actionItems
      .filter(a => a.status === 'pending' || a.status === 'in_progress')
      .map(a => a.id);
    setEmailSelectedIds(pendingIds);
    setEmailRecipients([]);
    setEmailInput('');
    setCcRecipients([]);
    setCcInput('');
    setShowCcField(false);
    setEmailMessage('');
    setEmailIncludeImage(false);
    setEmailIncludeAnalysis(false);
    setEmailIncludeChat(false);
    setEmailSent(false);
    setEmailError(null);
    setEmailModalOpen(true);
    loadStaffList();
  };

  const addRecipient = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed && trimmed.includes('@') && !emailRecipients.includes(trimmed) && !ccRecipients.includes(trimmed)) {
      setEmailRecipients(prev => [...prev, trimmed]);
    }
    setEmailInput('');
    setShowStaffSuggestions(false);
  };

  const removeRecipient = (email: string) => {
    setEmailRecipients(prev => prev.filter(e => e !== email));
  };

  const addCcRecipient = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed && trimmed.includes('@') && !ccRecipients.includes(trimmed) && !emailRecipients.includes(trimmed)) {
      setCcRecipients(prev => [...prev, trimmed]);
    }
    setCcInput('');
    setShowCcStaffSuggestions(false);
  };

  const removeCcRecipient = (email: string) => {
    setCcRecipients(prev => prev.filter(e => e !== email));
  };

  const handleEmailInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === 'Tab' || e.key === ',') && emailInput.trim()) {
      e.preventDefault();
      addRecipient(emailInput);
    } else if (e.key === 'Backspace' && !emailInput && emailRecipients.length > 0) {
      setEmailRecipients(prev => prev.slice(0, -1));
    }
  };

  const handleCcInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === 'Tab' || e.key === ',') && ccInput.trim()) {
      e.preventDefault();
      addCcRecipient(ccInput);
    } else if (e.key === 'Backspace' && !ccInput && ccRecipients.length > 0) {
      setCcRecipients(prev => prev.slice(0, -1));
    }
  };

  const handleEmailSend = async () => {
    if (emailRecipients.length === 0) return;
    setEmailSending(true);
    setEmailError(null);

    try {
      const res = await fetch(`/api/documents/${id}/email-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailRecipients,
          cc: ccRecipients.length > 0 ? ccRecipients : undefined,
          actionItemIds: emailSelectedIds,
          message: emailMessage.trim() || undefined,
          includeImage: emailIncludeImage,
          includeAnalysis: emailIncludeAnalysis,
          includeChat: emailIncludeChat,
          includeNotes: emailIncludeNotes,
        }),
      });

      if (res.ok) {
        setEmailSent(true);
      } else {
        const data = await res.json().catch(() => ({ error: 'Failed to send' }));
        setEmailError(data.error || 'Failed to send email');
      }
    } catch (err) {
      setEmailError('Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  const toggleEmailAction = (actionId: string) => {
    setEmailSelectedIds(prev =>
      prev.includes(actionId)
        ? prev.filter(id => id !== actionId)
        : [...prev, actionId]
    );
  };

  const allSelected = [...emailRecipients, ...ccRecipients];
  const filteredStaff = staffList.filter(
    u => emailInput && !allSelected.includes(u.email.toLowerCase()) && (
      u.name?.toLowerCase().includes(emailInput.toLowerCase()) ||
      u.email.toLowerCase().includes(emailInput.toLowerCase())
    )
  );
  const filteredCcStaff = staffList.filter(
    u => ccInput && !allSelected.includes(u.email.toLowerCase()) && (
      u.name?.toLowerCase().includes(ccInput.toLowerCase()) ||
      u.email.toLowerCase().includes(ccInput.toLowerCase())
    )
  );

  const loadStaffList = () => {
    if (staffLoaded) return;
    setStaffLoaded(true);
    fetch('/api/users')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setStaffList(data); })
      .catch(() => {});
  };

  const handleAssignOwner = async (userId: string | null) => {
    await updateDocument({ assigned_to: userId } as any);
  };

  const handleAssignAction = async (actionId: string, userId: string | null) => {
    try {
      const res = await fetch(`/api/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: userId }),
      });
      if (res.ok) {
        await fetchDocument();
      }
    } catch (err) {
      console.error('Assign action error:', err);
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    try {
      const res = await fetch(`/api/actions/${actionId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchDocument();
      }
    } catch (err) {
      console.error('Delete action error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg className="w-8 h-8 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--christmas-green)' }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p style={{ color: 'var(--text-muted)' }}>Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--status-error)' }}>{error || 'Document not found'}</p>
        <Link href="/inbox" className="btn btn-secondary mt-4">Back to Inbox</Link>
      </div>
    );
  }

  const extractedData = doc.extracted_data || {};
  const actionItems = (doc.action_items || []) as DdActionItem[];
  const pendingActions = actionItems.filter(a => a.status === 'pending' || a.status === 'in_progress');
  const completedActions = actionItems.filter(a => a.status === 'done');
  const dismissedActions = actionItems.filter(a => a.status === 'dismissed');
  const starterQuestions = STARTER_QUESTIONS[doc.document_type || ''] || STARTER_QUESTIONS.default;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/10" style={{ color: 'var(--text-secondary)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <form
              onSubmit={e => {
                e.preventDefault();
                updateDocument({ title: titleInput.trim() || null } as any);
                setEditingTitle(false);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
                className="input text-xl font-bold flex-1"
                autoFocus
                onKeyDown={e => { if (e.key === 'Escape') setEditingTitle(false); }}
                onBlur={() => {
                  updateDocument({ title: titleInput.trim() || null } as any);
                  setEditingTitle(false);
                }}
              />
            </form>
          ) : (
            <h1
              className="text-xl font-bold truncate cursor-pointer hover:opacity-80"
              style={{ color: 'var(--christmas-cream)' }}
              onClick={() => { setTitleInput(doc.title || ''); setEditingTitle(true); }}
              title="Click to edit title"
            >
              {doc.title || 'Untitled Document'}
            </h1>
          )}
          <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span>{formatDocType(doc.document_type)}</span>
            <span>·</span>
            <span>{timeAgo(doc.created_at)}</span>
            {doc.uploader && (
              <>
                <span>·</span>
                <span>by {doc.uploader.name || doc.uploader.email}</span>
              </>
            )}
          </div>
        </div>
        {/* Google Drive button */}
        {(doc as any).drive_file_id ? (
          <a
            href={`https://drive.google.com/file/d/${(doc as any).drive_file_id}/view`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: 'rgba(93, 138, 102, 0.15)', color: 'var(--christmas-green-light)' }}
            title="View in Google Drive"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.71 3.5L1.15 15l4.58 7.5h13.54l4.58-7.5L17.29 3.5H7.71zm.58 1h8.42l5.85 10.5H2.44L8.29 4.5zM5.44 16h13.12l-3.82 6H9.26l-3.82-6z" />
            </svg>
            In Drive
          </a>
        ) : (
          <button
            onClick={handleDriveUpload}
            disabled={driveUploading || !doc.analyzed_at}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
            style={{
              backgroundColor: driveError ? 'rgba(220, 38, 38, 0.15)' : 'var(--bg-secondary)',
              color: driveError ? 'var(--status-error)' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              opacity: !doc.analyzed_at ? 0.5 : 1,
            }}
            title={!doc.analyzed_at ? 'Analyze document first' : 'Send to Google Drive'}
          >
            {driveUploading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.71 3.5L1.15 15l4.58 7.5h13.54l4.58-7.5L17.29 3.5H7.71zm.58 1h8.42l5.85 10.5H2.44L8.29 4.5zM5.44 16h13.12l-3.82 6H9.26l-3.82-6z" />
              </svg>
            )}
            {driveUploading ? 'Uploading...' : driveError ? 'Retry Drive' : 'Send to Drive'}
          </button>
        )}
        {/* Email button */}
        <button
          onClick={openEmailModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
          title="Email document"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Email
        </button>
        {/* Delete button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Delete document"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column - Image + Chat */}
        <div>
          <div className="card p-0 overflow-hidden">
            {(() => {
              const pages = (doc.pages || []) as DdDocumentPage[];
              const hasMultiplePages = pages.length > 1;

              if (hasMultiplePages) {
                return (
                  <div className="space-y-0">
                    {pages.map((page) => {
                      const rotKey = `page-${page.id}`;
                      const rotation = imageRotations[rotKey] || 0;
                      return (
                        <div key={page.id}>
                          <div
                            className="px-3 py-1.5 text-xs font-medium flex items-center justify-between"
                            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}
                          >
                            <span>Page {page.page_number} of {pages.length}</span>
                            {page.image_url && (
                              <button
                                onClick={() => rotateImage(rotKey, page.id)}
                                className="p-1 rounded hover:bg-white/10 transition-colors"
                                title="Rotate image"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {page.image_url ? (
                            <div className="overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                              <img
                                src={page.image_url}
                                alt={`${doc.title || 'Document'} — Page ${page.page_number}`}
                                className="w-full transition-transform duration-200"
                                style={{ transform: rotation ? `rotate(${rotation}deg)` : undefined }}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-48" style={{ color: 'var(--text-muted)' }}>
                              Page {page.page_number} unavailable
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // Single page or fallback
              const singleRotation = imageRotations['single'] || 0;
              return doc.image_url ? (
                <div>
                  <div
                    className="px-3 py-1.5 text-xs font-medium flex items-center justify-end"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <button
                      onClick={() => setImageRotations(prev => ({ ...prev, single: (prev.single || 0) + 90 }))}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      title="Rotate image"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                  <div className="overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <img
                      src={doc.image_url}
                      alt={doc.title || 'Document'}
                      className="w-full transition-transform duration-200"
                      style={{ transform: singleRotation ? `rotate(${singleRotation}deg)` : undefined }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48" style={{ color: 'var(--text-muted)' }}>
                  Image unavailable
                </div>
              );
            })()}
          </div>

        </div>

        {/* Right column - Analysis + Chat + Actions */}
        <div>
          {/* Status, Priority & Owner */}
          <div className="card mb-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Status</label>
                <select
                  value={doc.status}
                  onChange={e => updateDocument({ status: e.target.value as any })}
                  className="select"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Priority</label>
                <select
                  value={doc.priority}
                  onChange={e => updateDocument({ priority: e.target.value as any })}
                  className="select"
                >
                  {PRIORITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Owner</label>
                <select
                  value={doc.assigned_to || ''}
                  onChange={e => handleAssignOwner(e.target.value || null)}
                  className="select"
                >
                  <option value="">Unassigned</option>
                  {staffList.map(user => (
                    <option key={user.id} value={user.id}>{user.name || user.email}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* AI Analysis */}
          {doc.analyzed_at ? (
            <div className="card mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>AI Analysis</h3>
                <button
                  onClick={handleReanalyze}
                  disabled={reanalyzing}
                  className="text-xs flex items-center gap-1"
                  style={{ color: 'var(--christmas-green-light)' }}
                >
                  {reanalyzing ? 'Analyzing...' : 'Re-analyze'}
                </button>
              </div>

              {doc.summary && (
                <p className="text-sm mb-4" style={{ color: 'var(--text-primary)' }}>{doc.summary}</p>
              )}

              {/* Extracted fields */}
              <div className="space-y-2">
                {Object.entries(extractedData).map(([key, value]) => {
                  if (!value) return null;
                  const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  const displayValue = key === 'amount' ? `$${Number(value).toLocaleString()}` : String(value);
                  return (
                    <div key={key} className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                      <span className="text-right ml-4" style={{ color: 'var(--text-primary)' }}>{displayValue}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : doc.analysis_error ? (
            <div className="card mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--status-error)' }}>Analysis Failed</h3>
                <button onClick={handleReanalyze} disabled={reanalyzing} className="btn btn-secondary text-xs">
                  {reanalyzing ? 'Retrying...' : 'Retry'}
                </button>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{doc.analysis_error}</p>
            </div>
          ) : (
            <div className="card mb-4 text-center py-6">
              <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>This document hasn't been analyzed yet.</p>
              <button onClick={handleReanalyze} disabled={reanalyzing} className="btn btn-primary">
                {reanalyzing ? 'Analyzing...' : 'Analyze Now'}
              </button>
            </div>
          )}

          {/* Notes */}
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Notes</h3>
              {!editingNotes && (
                <button onClick={() => setEditingNotes(true)} className="text-xs" style={{ color: 'var(--christmas-green-light)' }}>
                  Edit
                </button>
              )}
            </div>
            {editingNotes ? (
              <div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="input min-h-[80px] resize-y"
                  placeholder="Add notes..."
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={handleSaveNotes} className="btn btn-primary text-xs">Save</button>
                  <button onClick={() => { setEditingNotes(false); setNotes(doc.notes || ''); }} className="btn btn-secondary text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap" style={{ color: doc.notes ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {doc.notes || 'No notes yet.'}
              </p>
            )}
          </div>

          {/* Action Items */}
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Action Items ({pendingActions.length} pending)
              </h3>
            </div>

            {/* Pending actions */}
            <div className="space-y-1 mb-4">
              {pendingActions.map(action => (
                <div key={action.id} className="flex items-center gap-2 p-1.5 rounded group">
                  <button
                    onClick={() => handleActionStatusChange(action.id, 'done')}
                    className="w-4 h-4 rounded border-2 flex-shrink-0 transition-colors hover:border-green-500"
                    style={{ borderColor: 'var(--border-default)' }}
                    title="Mark done"
                  />
                  <p className="text-sm flex-1 min-w-0" style={{ color: 'var(--text-primary)' }}>{action.description}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleActionStatusChange(action.id, 'dismissed')}
                      className="flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      title="Dismiss"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteAction(action.id)}
                      className="flex-shrink-0 hover:text-red-400 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
              {pendingActions.length === 0 && (
                <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>No pending actions.</p>
              )}
            </div>

            {/* Add new action */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newAction}
                onChange={e => setNewAction(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddAction()}
                placeholder="Add action item..."
                className="input flex-1"
                disabled={addingAction}
              />
              <button
                onClick={handleAddAction}
                disabled={addingAction || !newAction.trim()}
                className="btn btn-primary"
              >
                Add
              </button>
            </div>

            {/* Completed actions */}
            {completedActions.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                  Done ({completedActions.length})
                </p>
                {completedActions.map(action => (
                  <div key={action.id} className="flex items-center gap-2 p-1.5 group">
                    <button
                      onClick={() => handleActionStatusChange(action.id, 'pending')}
                      className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center hover:opacity-70"
                      style={{ backgroundColor: 'var(--status-success)' }}
                      title="Undo"
                    >
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <p className="text-sm line-through flex-1" style={{ color: 'var(--text-muted)' }}>{action.description}</p>
                    <button
                      onClick={() => handleDeleteAction(action.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                      style={{ color: 'var(--text-muted)' }}
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Dismissed actions */}
            {dismissedActions.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                  Dismissed ({dismissedActions.length})
                </p>
                {dismissedActions.map(action => (
                  <div key={action.id} className="flex items-center gap-2 p-1.5 group">
                    <button
                      onClick={() => handleActionStatusChange(action.id, 'pending')}
                      className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center hover:opacity-70"
                      style={{ backgroundColor: 'var(--border-default)' }}
                      title="Undo"
                    >
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <p className="text-sm line-through flex-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{action.description}</p>
                    <button
                      onClick={() => handleDeleteAction(action.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                      style={{ color: 'var(--text-muted)' }}
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ask AI Chat Panel */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <button
              onClick={handleChatToggle}
              className="w-full flex items-center justify-between p-4"
              style={{ color: 'var(--text-secondary)' }}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--christmas-green-light)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="text-sm font-semibold">Ask AI</span>
                {chatMessages.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(93, 138, 102, 0.15)', color: 'var(--christmas-green-light)' }}>
                    {chatMessages.length}
                  </span>
                )}
              </div>
              <svg
                className={`w-4 h-4 transition-transform ${chatOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {chatOpen && (
              <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {/* Chat messages */}
                <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto" style={{ minHeight: chatMessages.length > 0 ? '100px' : undefined }}>
                  {chatMessages.length === 0 && !chatLoading && (
                    <div>
                      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                        Ask questions about this document. Try:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {starterQuestions.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => handleChatSend(q)}
                            className="text-xs px-3 py-1.5 rounded-full transition-colors"
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--christmas-green-light)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {chatMessages.map(msg => {
                    // Split content from sources for assistant messages
                    const hasSources = msg.role === 'assistant' && msg.content.includes('\n\nSources:\n');
                    const mainContent = hasSources ? msg.content.split('\n\nSources:\n')[0] : msg.content;
                    const sourcesText = hasSources ? msg.content.split('\n\nSources:\n')[1] : '';
                    const sourceLinks = sourcesText
                      ? sourcesText.split('\n').filter(Boolean).map(line => {
                          const match = line.match(/^- (.+?):\s*(https?:\/\/.+)$/);
                          return match ? { title: match[1], url: match[2] } : null;
                        }).filter(Boolean) as { title: string; url: string }[]
                      : [];

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className="max-w-[85%] rounded-lg px-3 py-2 text-sm"
                          style={{
                            backgroundColor: msg.role === 'user' ? 'var(--christmas-green)' : 'var(--bg-secondary)',
                            color: msg.role === 'user' ? 'var(--christmas-cream)' : 'var(--text-primary)',
                          }}
                        >
                          <p className="whitespace-pre-wrap">{mainContent}</p>
                          {sourceLinks.length > 0 && (
                            <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Sources:</p>
                              {sourceLinks.map((src, i) => (
                                <a
                                  key={i}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-xs truncate"
                                  style={{ color: 'var(--christmas-green-light)' }}
                                >
                                  {src.title}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {chatLoading && (
                    <div className="flex justify-start">
                      <div
                        className="rounded-lg px-3 py-2 text-sm"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                      >
                        <span className="inline-flex gap-1">
                          <span className="animate-pulse">.</span>
                          <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>.</span>
                          <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>.</span>
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat input */}
                <div className="p-3 flex gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                    placeholder="Ask about this document..."
                    className="input flex-1"
                    disabled={chatLoading}
                  />
                  <button
                    onClick={() => handleChatSend()}
                    disabled={chatLoading || !chatInput.trim()}
                    className="btn btn-primary"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {emailModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setEmailModalOpen(false); }}
        >
          <div
            className="w-full max-w-lg rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>Email Document</h3>
              <button onClick={() => setEmailModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {emailSent ? (
                <div className="text-center py-6">
                  <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--status-success)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Email sent!</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Action items sent to {emailRecipients.length} recipient{emailRecipients.length !== 1 ? 's' : ''}
                  </p>
                  <button onClick={() => setEmailModalOpen(false)} className="btn btn-primary mt-4">Done</button>
                </div>
              ) : (
                <>
                  {/* Email To - multi-recipient with chips */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>To</label>
                      {!showCcField && (
                        <button
                          onClick={() => setShowCcField(true)}
                          className="text-xs"
                          style={{ color: 'var(--christmas-green-light)' }}
                        >
                          + CC
                        </button>
                      )}
                    </div>
                    <div
                      className="flex flex-wrap gap-1.5 p-2 rounded-lg min-h-[42px] cursor-text"
                      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                      onClick={() => emailInputRef.current?.focus()}
                    >
                      {emailRecipients.map(email => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                          style={{ backgroundColor: 'rgba(93, 138, 102, 0.2)', color: 'var(--christmas-green-light)' }}
                        >
                          {email}
                          <button
                            onClick={e => { e.stopPropagation(); removeRecipient(email); }}
                            className="hover:opacity-70"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                      <input
                        ref={emailInputRef}
                        type="text"
                        value={emailInput}
                        onChange={e => {
                          setEmailInput(e.target.value);
                          setShowStaffSuggestions(true);
                        }}
                        onFocus={() => setShowStaffSuggestions(true)}
                        onBlur={() => {
                          setTimeout(() => setShowStaffSuggestions(false), 200);
                          if (emailInput.trim().includes('@')) addRecipient(emailInput);
                        }}
                        onKeyDown={handleEmailInputKeyDown}
                        placeholder={emailRecipients.length === 0 ? 'Type email or name...' : ''}
                        className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm"
                        style={{ color: 'var(--text-primary)' }}
                      />
                    </div>
                    {showStaffSuggestions && filteredStaff.length > 0 && (
                      <div
                        className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-10 max-h-[160px] overflow-y-auto"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}
                      >
                        {filteredStaff.slice(0, 5).map(user => (
                          <button
                            key={user.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseDown={e => {
                              e.preventDefault();
                              addRecipient(user.email);
                            }}
                          >
                            <div>{user.name}</div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* CC field */}
                  {showCcField && (
                    <div className="relative">
                      <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>CC</label>
                      <div
                        className="flex flex-wrap gap-1.5 p-2 rounded-lg min-h-[42px] cursor-text"
                        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                        onClick={() => ccInputRef.current?.focus()}
                      >
                        {ccRecipients.map(email => (
                          <span
                            key={email}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                            style={{ backgroundColor: 'rgba(184, 149, 107, 0.2)', color: 'var(--christmas-gold)' }}
                          >
                            {email}
                            <button
                              onClick={e => { e.stopPropagation(); removeCcRecipient(email); }}
                              className="hover:opacity-70"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                        <input
                          ref={ccInputRef}
                          type="text"
                          value={ccInput}
                          onChange={e => {
                            setCcInput(e.target.value);
                            setShowCcStaffSuggestions(true);
                          }}
                          onFocus={() => setShowCcStaffSuggestions(true)}
                          onBlur={() => {
                            setTimeout(() => setShowCcStaffSuggestions(false), 200);
                            if (ccInput.trim().includes('@')) addCcRecipient(ccInput);
                          }}
                          onKeyDown={handleCcInputKeyDown}
                          placeholder={ccRecipients.length === 0 ? 'Type email or name...' : ''}
                          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm"
                          style={{ color: 'var(--text-primary)' }}
                        />
                      </div>
                      {showCcStaffSuggestions && filteredCcStaff.length > 0 && (
                        <div
                          className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-10 max-h-[160px] overflow-y-auto"
                          style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}
                        >
                          {filteredCcStaff.slice(0, 5).map(user => (
                            <button
                              key={user.id}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                              style={{ color: 'var(--text-primary)' }}
                              onMouseDown={e => {
                                e.preventDefault();
                                addCcRecipient(user.email);
                              }}
                            >
                              <div>{user.name}</div>
                              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action items checkboxes — only pending items, hidden if none exist */}
                  {pendingActions.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--text-muted)' }}>
                        Action Items to Include
                      </label>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {pendingActions.map(action => (
                          <label
                            key={action.id}
                            className="flex items-start gap-2 p-2 rounded-lg cursor-pointer"
                            style={{ backgroundColor: 'var(--bg-secondary)' }}
                          >
                            <input
                              type="checkbox"
                              checked={emailSelectedIds.includes(action.id)}
                              onChange={() => toggleEmailAction(action.id)}
                              className="mt-0.5 accent-[#5D8A66]"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{action.description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`badge badge-${action.priority}`} style={{ fontSize: '10px', padding: '1px 6px' }}>{action.priority}</span>
                                {action.due_date && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{action.due_date}</span>}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Include extras */}
                  <div>
                    <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--text-muted)' }}>Also Include</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailIncludeImage}
                          onChange={e => setEmailIncludeImage(e.target.checked)}
                          className="accent-[#5D8A66]"
                        />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Document image (as attachment)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailIncludeAnalysis}
                          onChange={e => setEmailIncludeAnalysis(e.target.checked)}
                          className="accent-[#5D8A66]"
                        />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>AI analysis (summary + details)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailIncludeChat}
                          onChange={e => setEmailIncludeChat(e.target.checked)}
                          className="accent-[#5D8A66]"
                        />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>AI chat transcript</span>
                      </label>
                      {doc?.notes && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={emailIncludeNotes}
                            onChange={e => setEmailIncludeNotes(e.target.checked)}
                            className="accent-[#5D8A66]"
                          />
                          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Notes</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Personal message */}
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>
                      Message (optional)
                    </label>
                    <textarea
                      value={emailMessage}
                      onChange={e => setEmailMessage(e.target.value)}
                      placeholder="Add a personal note..."
                      className="input min-h-[60px] resize-y"
                    />
                  </div>

                  {emailError && (
                    <p className="text-sm" style={{ color: 'var(--status-error)' }}>{emailError}</p>
                  )}

                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEmailModalOpen(false)} className="btn btn-secondary">Cancel</button>
                    <button
                      onClick={handleEmailSend}
                      disabled={emailSending || emailRecipients.length === 0}
                      className="btn btn-primary"
                    >
                      {emailSending ? 'Sending...' : `Send${emailRecipients.length > 0 ? ` to ${emailRecipients.length}` : ''}${ccRecipients.length > 0 ? ` (+${ccRecipients.length} CC)` : ''}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }}
        >
          <div
            className="w-full max-w-sm rounded-xl p-6"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <h3 className="font-semibold mb-2" style={{ color: 'var(--christmas-cream)' }}>Delete Document?</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              This will permanently delete this document, its action items, chat history, and uploaded images. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: 'rgba(220, 38, 38, 0.8)', color: 'white' }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
