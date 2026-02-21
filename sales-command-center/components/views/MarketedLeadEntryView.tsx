'use client';

import { useState } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { MarketedLeadForm } from '@/components/forms/MarketedLeadForm';
import { MarketedLeadInput, LeadAssignmentResult } from '@/types';
import { UserCircle, CheckCircle, X, Phone, MapPin, Clock, Thermometer } from 'lucide-react';

export function MarketedLeadEntryView() {
  const { getNextMarketedAdvisor, addAndAssignLead } = useDashboardStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<LeadAssignmentResult | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const nextAdvisor = getNextMarketedAdvisor();

  const handleSubmit = async (data: MarketedLeadInput) => {
    setIsSubmitting(true);

    try {
      const assignmentResult = await addAndAssignLead(data);

      if (assignmentResult) {
        setResult(assignmentResult);
        setShowConfirmation(true);

        // Trigger Slack notification (fire and forget)
        try {
          await fetch('/api/slack/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead: assignmentResult.lead,
              advisor: assignmentResult.advisor,
            }),
          });
        } catch (error) {
          // Silently fail - Slack notification is not critical
          console.warn('Failed to send Slack notification:', error);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeConfirmation = () => {
    setShowConfirmation(false);
    setResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Enter Marketed Lead</h1>
        <p className="text-muted-foreground mt-1">
          Enter a new marketed lead for automatic round-robin assignment
        </p>
      </div>

      {/* Next in Queue Preview */}
      <div className="glass-card p-6 rounded-xl">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Next in Queue
        </h2>
        {nextAdvisor ? (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <UserCircle className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">{nextAdvisor.name}</h3>
              <p className="text-muted-foreground">{nextAdvisor.email}</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {nextAdvisor.totalLeads} leads assigned | {nextAdvisor.closingRate}% close rate
              </p>
            </div>
            <div className="ml-auto">
              <div className="queue-indicator text-2xl font-bold">#1</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <UserCircle className="w-16 h-16 mx-auto opacity-50 mb-2" />
            <p>No advisors in queue</p>
            <p className="text-sm">Please add an advisor to the queue in the Admin panel</p>
          </div>
        )}
      </div>

      {/* Lead Entry Form */}
      <div className="glass-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-foreground mb-6">Lead Information</h2>
        {nextAdvisor ? (
          <MarketedLeadForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Cannot enter leads without an advisor in the queue.</p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && result && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
          onClick={closeConfirmation}
        >
          <div
            className="glass-card p-8 max-w-lg w-full mx-4 rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-foreground mb-2">
              Lead Assigned!
            </h2>
            <p className="text-center text-muted-foreground mb-6">
              The lead has been successfully assigned
            </p>

            {/* Assignment Details */}
            <div className="bg-muted/30 rounded-xl p-4 mb-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-semibold text-foreground">{result.lead.clientName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="font-semibold text-primary">{result.advisor.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Phone className="w-4 h-4" /> Phone
                </span>
                <span className="text-foreground">{result.lead.phone}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Thermometer className="w-4 h-4" /> System Type
                </span>
                <span className="text-foreground">{result.lead.systemType || 'Unknown'}</span>
              </div>
              {result.lead.unitAge && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Unit Age
                  </span>
                  <span className="text-foreground">{result.lead.unitAge} years</span>
                </div>
              )}
              {result.lead.address && (
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> Address
                  </span>
                  <span className="text-foreground text-right max-w-[200px]">{result.lead.address}</span>
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={closeConfirmation}
              className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all"
            >
              Enter Another Lead
            </button>

            {/* Close Icon */}
            <button
              onClick={closeConfirmation}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
