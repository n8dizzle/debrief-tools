// API route for Service Titan integration
import { NextRequest, NextResponse } from 'next/server';
import {
  syncLeadsFromServiceTitan,
  createLeadInServiceTitan,
  testConnection,
  clearTokenCache,
  syncSalesDataForAdvisors,
  getServiceTitanConfigFromEnv,
  isServiceTitanConfigured,
  syncComfortAdvisorsFromServiceTitan,
  syncEmployeesFromServiceTitan,
  syncTechniciansFromServiceTitan,
  getBusinessUnits,
  getTeams,
  authenticateServiceTitan,
} from '@/lib/serviceTitan';
import { isSlackConfigured, sendMarketedLeadNotification } from '@/lib/slack';
import { createServerSupabaseClient } from '@/lib/supabase';
import { ServiceTitanConfig } from '@/types';

// Get config from env vars or request body
function getConfig(bodyConfig?: Partial<ServiceTitanConfig>): ServiceTitanConfig | null {
  // First try environment variables
  const envConfig = getServiceTitanConfigFromEnv();
  if (envConfig) {
    return envConfig;
  }

  // Fall back to body config if provided
  if (bodyConfig?.clientId && bodyConfig?.clientSecret && bodyConfig?.appKey && bodyConfig?.tenantId) {
    return {
      clientId: bodyConfig.clientId,
      clientSecret: bodyConfig.clientSecret,
      appKey: bodyConfig.appKey,
      tenantId: bodyConfig.tenantId,
      environment: bodyConfig.environment || 'production',
    };
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config: bodyConfig, lead } = body;

    const config = getConfig(bodyConfig);

    // Validate config
    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: 'Service Titan not configured. Set ST_CLIENT_ID, ST_CLIENT_SECRET, ST_APP_KEY, and ST_TENANT_ID environment variables.'
        },
        { status: 400 }
      );
    }

    if (action === 'test') {
      const result = await testConnection(config);
      return NextResponse.json({
        success: result.success,
        message: result.message,
        configuredViaEnv: isServiceTitanConfigured(),
      });
    }

    if (action === 'sync') {
      try {
        const { startDate, endDate, status } = body;
        const options = {
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          status: status || undefined,
        };
        const leads = await syncLeadsFromServiceTitan(config, options);
        return NextResponse.json({ success: true, leads, count: leads.length });
      } catch (error: any) {
        // Clear token cache on sync failure (might be auth issue)
        clearTokenCache();
        throw error;
      }
    }

    if (action === 'create') {
      if (!lead) {
        return NextResponse.json(
          { success: false, error: 'Lead data is required for create action' },
          { status: 400 }
        );
      }
      const serviceTitanId = await createLeadInServiceTitan(config, lead);
      return NextResponse.json({ success: true, serviceTitanId });
    }

    if (action === 'syncSales') {
      const { startDate, endDate } = body;

      // Fetch advisors from database to get their service_titan_ids
      const supabase = createServerSupabaseClient();
      const { data: advisors, error: fetchError } = await supabase
        .from('comfort_advisors')
        .select('id, name, service_titan_id')
        .eq('active', true);

      if (fetchError) {
        return NextResponse.json(
          { success: false, error: `Failed to fetch advisors: ${fetchError.message}` },
          { status: 500 }
        );
      }

      if (!advisors || advisors.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No active advisors found. Add advisors first.' },
          { status: 400 }
        );
      }

      // Filter to only advisors with service_titan_id
      const linkedAdvisors = advisors.filter(a => a.service_titan_id);

      if (linkedAdvisors.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No advisors are linked to Service Titan. Use "Link Advisors" first to match advisors by email.' },
          { status: 400 }
        );
      }

      // Use the service_titan_id for fetching sales
      const advisorStIds = linkedAdvisors.map(a => a.service_titan_id!);

      const salesData = await syncSalesDataForAdvisors(config, advisorStIds, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      // Map sales data back to advisor UUIDs and persist to database
      const mappedSalesData = [];
      for (const sd of salesData) {
        const advisor = linkedAdvisors.find(a => a.service_titan_id === sd.advisorId);
        if (advisor) {
          // Update advisor sales metrics in database
          await supabase
            .from('comfort_advisors')
            .update({
              sales_mtd: sd.totalSales,
              average_sale: sd.averageSale,
              closing_rate: sd.closeRate,
              sales_opps: sd.salesOpps,
              sold_leads: sd.soldCount,
            })
            .eq('id', advisor.id);
        }
        mappedSalesData.push({
          advisorId: advisor?.id || sd.advisorId,
          advisorName: advisor?.name,
          totalSales: sd.totalSales,
          averageSale: sd.averageSale,
          closeRate: sd.closeRate,
          salesOpps: sd.salesOpps,
          soldCount: sd.soldCount,
          sales: sd.sales,
        });
      }

      return NextResponse.json({ success: true, salesData: mappedSalesData });
    }

    if (action === 'status') {
      // Check if configured and return status
      return NextResponse.json({
        success: true,
        configured: isServiceTitanConfigured(),
        environment: config.environment,
      });
    }

    if (action === 'getBusinessUnits') {
      try {
        const businessUnits = await getBusinessUnits(config);
        return NextResponse.json({
          success: true,
          businessUnits,
        });
      } catch (error: any) {
        clearTokenCache();
        throw error;
      }
    }

    if (action === 'getTeams') {
      try {
        const teams = await getTeams(config);
        return NextResponse.json({
          success: true,
          teams,
        });
      } catch (error: any) {
        clearTokenCache();
        throw error;
      }
    }

    if (action === 'syncAdvisors' || action === 'syncTechnicians') {
      try {
        const { team } = body;

        // Fetch technicians from Service Titan, optionally filtered by team
        const technicians = await syncTechniciansFromServiceTitan(config, team);

        if (technicians.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No technicians found in Service Titan.',
          });
        }

        // Filter out technicians without emails (required for advisor)
        const techsWithEmail = technicians.filter(tech => tech.email && tech.email.trim() !== '');

        // Save to Supabase
        const supabase = createServerSupabaseClient();
        const savedAdvisors = [];
        const skipped = [];

        for (let i = 0; i < technicians.length; i++) {
          const tech = technicians[i];

          // Use email if available, otherwise generate a placeholder
          const email = tech.email && tech.email.trim() !== ''
            ? tech.email.toLowerCase()
            : `tech-${tech.id}@servicetitan.local`;

          // Check if advisor already exists by email or service_titan_id
          const { data: existingByStId } = await supabase
            .from('comfort_advisors')
            .select('id')
            .eq('service_titan_id', tech.id)
            .single();

          const { data: existingByEmail } = await supabase
            .from('comfort_advisors')
            .select('id')
            .eq('email', email)
            .single();

          const existing = existingByStId || existingByEmail;

          if (existing) {
            // Update existing
            const { data, error } = await supabase
              .from('comfort_advisors')
              .update({
                name: tech.name,
                phone: tech.phone,
                service_titan_id: tech.id,
              })
              .eq('id', existing.id)
              .select()
              .single();

            if (!error && data) savedAdvisors.push(data);
          } else {
            // Insert new
            const { data, error } = await supabase
              .from('comfort_advisors')
              .insert({
                name: tech.name,
                email: email,
                phone: tech.phone,
                active: true,
                service_titan_id: tech.id,
                tgl_queue_position: i + 1,
                marketed_queue_position: i + 1,
              })
              .select()
              .single();

            if (error) {
              skipped.push({ name: tech.name, error: error.message });
            } else if (data) {
              savedAdvisors.push(data);
            }
          }
        }

        return NextResponse.json({
          success: true,
          advisors: savedAdvisors,
          count: savedAdvisors.length,
          skipped: skipped.length > 0 ? skipped : undefined,
          message: `Imported ${savedAdvisors.length} technicians from Service Titan.${skipped.length > 0 ? ` Skipped ${skipped.length}.` : ''}`,
        });
      } catch (error: any) {
        clearTokenCache();
        throw error;
      }
    }

    if (action === 'linkAdvisors') {
      try {
        // Fetch all employees from Service Titan
        const allEmployees = await syncEmployeesFromServiceTitan(config);

        // Fetch existing advisors from Supabase
        const supabase = createServerSupabaseClient();
        const { data: existingAdvisors, error: fetchError } = await supabase
          .from('comfort_advisors')
          .select('*');

        if (fetchError) {
          throw new Error(`Failed to fetch advisors: ${fetchError.message}`);
        }

        if (!existingAdvisors || existingAdvisors.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No advisors found in database. Please add advisors first.',
          });
        }

        // Match advisors by email (case-insensitive)
        const linked = [];
        const unlinked = [];

        for (const advisor of existingAdvisors) {
          const advisorEmail = advisor.email?.toLowerCase();
          const match = allEmployees.find(
            emp => emp.email?.toLowerCase() === advisorEmail
          );

          if (match) {
            // Update advisor with Service Titan ID
            const { data, error } = await supabase
              .from('comfort_advisors')
              .update({ service_titan_id: match.id })
              .eq('id', advisor.id)
              .select()
              .single();

            if (!error && data) {
              linked.push({
                advisor: advisor.name,
                email: advisor.email,
                serviceTitanId: match.id,
                serviceTitanName: match.name
              });
            }
          } else {
            unlinked.push({
              advisor: advisor.name,
              email: advisor.email
            });
          }
        }

        return NextResponse.json({
          success: true,
          linked,
          unlinked,
          message: `Linked ${linked.length} advisors. ${unlinked.length} could not be matched.`,
        });
      } catch (error: any) {
        clearTokenCache();
        throw error;
      }
    }

    if (action === 'checkWebhooks') {
      try {
        // Try to list webhook subscriptions
        const response = await fetch(`https://api.servicetitan.io/events/v2/tenant/${config.tenantId}/subscriptions`, {
          headers: {
            'Authorization': `Bearer ${await authenticateServiceTitan(config)}`,
            'ST-App-Key': config.appKey,
          },
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            success: true,
            webhooksAvailable: true,
            subscriptions: data.data || [],
            message: 'Webhooks are available on your account!',
          });
        } else if (response.status === 403) {
          return NextResponse.json({
            success: true,
            webhooksAvailable: false,
            message: 'Webhooks not available - may require additional permissions or plan upgrade.',
            status: response.status,
          });
        } else {
          const errorText = await response.text();
          return NextResponse.json({
            success: true,
            webhooksAvailable: false,
            message: `Webhook API returned: ${response.status}`,
            details: errorText,
          });
        }
      } catch (error: any) {
        return NextResponse.json({
          success: false,
          error: error.message,
        });
      }
    }

    if (action === 'getJobTypes') {
      try {
        // Get job types to find "H - Mktg Lead Estimate"
        const response = await fetch(`https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/job-types?pageSize=200`, {
          headers: {
            'Authorization': `Bearer ${await authenticateServiceTitan(config)}`,
            'ST-App-Key': config.appKey,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch job types: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return NextResponse.json({
          success: true,
          jobTypes: data.data || [],
        });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
      }
    }

    if (action === 'getUnassignedJobs') {
      try {
        // Business Unit and Job Type IDs for marketing leads
        const HVAC_SALES_BU_ID = '33643795';
        const MKTG_LEAD_JOB_TYPE_ID = '52687000';
        const TGL_LEAD_JOB_TYPE_ID = '52683039';

        // Get recent jobs
        const params = new URLSearchParams({
          pageSize: '100',
          createdOnOrAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });

        const response = await fetch(`https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/jobs?${params}`, {
          headers: {
            'Authorization': `Bearer ${await authenticateServiceTitan(config)}`,
            'ST-App-Key': config.appKey,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch jobs: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Filter for HVAC - Sales business unit with marketing lead job type
        const marketingLeadJobs = (data.data || []).filter((job: any) =>
          job.businessUnitId?.toString() === HVAC_SALES_BU_ID &&
          job.jobTypeId?.toString() === MKTG_LEAD_JOB_TYPE_ID
        );

        // Filter for TGL jobs
        const tglJobs = (data.data || []).filter((job: any) =>
          job.jobTypeId?.toString() === TGL_LEAD_JOB_TYPE_ID
        );

        // Check which marketing lead jobs are unassigned (no soldById)
        const unassignedMarketingJobs = marketingLeadJobs.filter((job: any) => !job.soldById);

        // Check which TGL jobs are unassigned
        const unassignedTGLJobs = tglJobs.filter((job: any) => !job.soldById);

        return NextResponse.json({
          success: true,
          totalJobs: data.data?.length || 0,
          marketingLeadJobs: {
            total: marketingLeadJobs.length,
            unassigned: unassignedMarketingJobs.length,
            jobs: marketingLeadJobs.slice(0, 5).map((j: any) => ({
              id: j.id,
              jobNumber: j.jobNumber,
              status: j.jobStatus,
              soldById: j.soldById,
              createdOn: j.createdOn,
              customerId: j.customerId,
            })),
          },
          tglJobs: {
            total: tglJobs.length,
            unassigned: unassignedTGLJobs.length,
          },
          unassignedMarketingJobs,
          unassignedTGLJobs,
        });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
      }
    }

    if (action === 'assignJob') {
      try {
        const { jobId, soldById } = body;

        if (!jobId || !soldById) {
          return NextResponse.json({
            success: false,
            error: 'jobId and soldById are required'
          }, { status: 400 });
        }

        // Update the job with soldById
        const response = await fetch(`https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/jobs/${jobId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${await authenticateServiceTitan(config)}`,
            'ST-App-Key': config.appKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            soldById: parseInt(soldById),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return NextResponse.json({
            success: false,
            error: `Failed to assign job: ${response.status}`,
            details: errorText,
          });
        }

        const data = await response.json();
        return NextResponse.json({
          success: true,
          message: `Job ${jobId} assigned to soldById ${soldById}`,
          job: data,
        });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
      }
    }

    if (action === 'getSampleJob') {
      try {
        const params = new URLSearchParams({
          pageSize: '10',
          sort: '-createdOn',
        });

        const response = await fetch(`https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/jobs?${params}`, {
          headers: {
            'Authorization': `Bearer ${await authenticateServiceTitan(config)}`,
            'ST-App-Key': config.appKey,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch jobs: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return NextResponse.json({
          success: true,
          sampleJob: data.data?.[0] || null,
          jobFields: data.data?.[0] ? Object.keys(data.data[0]) : [],
        });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
      }
    }

    if (action === 'getAppointment') {
      try {
        const { appointmentId } = body;

        if (!appointmentId) {
          return NextResponse.json({ success: false, error: 'appointmentId required' }, { status: 400 });
        }

        const response = await fetch(`https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/appointments/${appointmentId}`, {
          headers: {
            'Authorization': `Bearer ${await authenticateServiceTitan(config)}`,
            'ST-App-Key': config.appKey,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch appointment: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return NextResponse.json({
          success: true,
          appointment: data,
          fields: Object.keys(data),
        });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
      }
    }

    if (action === 'getAppointmentAssignments') {
      try {
        const { appointmentId } = body;

        // Try the appointment-assignments endpoint
        const response = await fetch(`https://api.servicetitan.io/dispatch/v2/tenant/${config.tenantId}/appointment-assignments?appointmentIds=${appointmentId || ''}`, {
          headers: {
            'Authorization': `Bearer ${await authenticateServiceTitan(config)}`,
            'ST-App-Key': config.appKey,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          return NextResponse.json({
            success: false,
            error: `Failed: ${response.status}`,
            details: errorText,
          });
        }

        const data = await response.json();
        return NextResponse.json({
          success: true,
          assignments: data,
        });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
      }
    }

    if (action === 'assignTechToAppointment') {
      try {
        const { appointmentId, technicianId, jobId } = body;

        if (!appointmentId || !technicianId) {
          return NextResponse.json({
            success: false,
            error: 'appointmentId and technicianId required'
          }, { status: 400 });
        }

        const token = await authenticateServiceTitan(config);
        const attempts: { endpoint: string; status: number; details: string; success?: boolean }[] = [];

        // Approach 1: Try dispatch/v2 assignment endpoint
        const dispatchResponse = await fetch(`https://api.servicetitan.io/dispatch/v2/tenant/${config.tenantId}/appointment-assignments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'ST-App-Key': config.appKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appointmentId: parseInt(appointmentId),
            technicianId: parseInt(technicianId),
          }),
        });

        if (dispatchResponse.ok) {
          const data = await dispatchResponse.json();
          return NextResponse.json({
            success: true,
            message: `Technician ${technicianId} assigned to appointment ${appointmentId}`,
            result: data,
            method: 'dispatch-appointment-assignments',
          });
        }
        attempts.push({
          endpoint: 'dispatch/v2/appointment-assignments POST',
          status: dispatchResponse.status,
          details: await dispatchResponse.text(),
        });

        // Approach 2: Try jpm appointments PATCH endpoint
        const patchResponse = await fetch(`https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/appointments/${appointmentId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'ST-App-Key': config.appKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            technicianId: parseInt(technicianId),
          }),
        });

        if (patchResponse.ok) {
          const data = await patchResponse.json();
          return NextResponse.json({
            success: true,
            message: `Technician ${technicianId} assigned to appointment ${appointmentId}`,
            result: data,
            method: 'jpm-appointments-patch',
          });
        }
        attempts.push({
          endpoint: 'jpm/v2/appointments/{id} PATCH',
          status: patchResponse.status,
          details: await patchResponse.text(),
        });

        // Approach 3: Try telecom dispatch/assign endpoint
        const assignResponse = await fetch(`https://api.servicetitan.io/telecom/v2/tenant/${config.tenantId}/calls/book-job`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'ST-App-Key': config.appKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appointmentId: parseInt(appointmentId),
            technicianIds: [parseInt(technicianId)],
          }),
        });

        if (assignResponse.ok) {
          const data = await assignResponse.json();
          return NextResponse.json({
            success: true,
            message: `Technician ${technicianId} assigned to appointment ${appointmentId}`,
            result: data,
            method: 'telecom-book-job',
          });
        }
        attempts.push({
          endpoint: 'telecom/v2/calls/book-job POST',
          status: assignResponse.status,
          details: await assignResponse.text(),
        });

        return NextResponse.json({
          success: false,
          error: 'Assignment failed - API endpoint for technician assignment may not be available',
          note: 'Service Titan may require technician assignments to be done through their dispatch board UI',
          attempts,
        });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
      }
    }

    if (action === 'getRecentAppointments') {
      try {
        const params = new URLSearchParams({
          pageSize: '20',
          startsOnOrAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        const response = await fetch(`https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/appointments?${params}`, {
          headers: {
            'Authorization': `Bearer ${await authenticateServiceTitan(config)}`,
            'ST-App-Key': config.appKey,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch appointments: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Get a sample to see the structure
        const sample = data.data?.[0];

        return NextResponse.json({
          success: true,
          totalAppointments: data.data?.length || 0,
          sampleAppointment: sample,
          fields: sample ? Object.keys(sample) : [],
          // Show appointments without technicians
          unassignedAppointments: (data.data || []).filter((apt: any) =>
            !apt.technicianId && !apt.assignedTechnicians?.length
          ).map((apt: any) => ({
            id: apt.id,
            jobId: apt.jobId,
            start: apt.start,
            technicianId: apt.technicianId,
            assignedTechnicians: apt.assignedTechnicians,
          })),
        });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
      }
    }

    if (action === 'getRecentJobs') {
      try {
        // Get jobs from the last 24 hours to catch newly created ones
        const params = new URLSearchParams({
          pageSize: '50',
          createdOnOrAfter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        });

        const response = await fetch(`https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/jobs?${params}`, {
          headers: {
            'Authorization': `Bearer ${await authenticateServiceTitan(config)}`,
            'ST-App-Key': config.appKey,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch jobs: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const jobs = (data.data || []).map((job: any) => ({
          id: job.id,
          jobNumber: job.jobNumber,
          businessUnitId: job.businessUnitId,
          jobTypeId: job.jobTypeId,
          jobStatus: job.jobStatus,
          createdOn: job.createdOn,
          customerId: job.customerId,
        }));

        return NextResponse.json({
          success: true,
          totalJobs: jobs.length,
          jobs,
          expectedBusinessUnitId: '33643795',
          expectedJobTypeId: '52687000',
        });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
      }
    }

    if (action === 'testSlack') {
      try {
        if (!isSlackConfigured()) {
          return NextResponse.json({
            success: false,
            error: 'Slack not configured. Set SLACK_WEBHOOK_URL or SLACK_BOT_TOKEN in environment variables.',
          });
        }

        // Get a real lead from the database to use for testing
        const supabase = createServerSupabaseClient();
        const { data: leads } = await supabase
          .from('leads')
          .select('*, advisor:comfort_advisors(name, phone, email, marketed_queue_position)')
          .order('created_at', { ascending: false })
          .limit(1);

        const testLead = leads?.[0];

        // Get advisors in queue order
        const { data: advisors } = await supabase
          .from('comfort_advisors')
          .select('*')
          .eq('active', true)
          .eq('in_queue', true)
          .not('marketed_queue_position', 'is', null)
          .order('marketed_queue_position', { ascending: true });

        // Current first in line gets this lead, next in line is shown at bottom
        const currentAdvisor = advisors?.[0];
        const nextAdvisor = advisors && advisors.length > 1 ? advisors[1] : null;

        // Send a test notification using current queue order
        const result = await sendMarketedLeadNotification({
          jobId: testLead?.service_titan_id || 'TEST-123',
          jobNumber: testLead?.service_titan_id || 'TEST-123',
          customerName: testLead?.client_name || 'Test Customer',
          customerPhone: testLead?.phone || '(555) 123-4567',
          customerAddress: testLead?.address || '123 Test Street, Dallas, TX 75201',
          scheduledDate: new Date().toISOString(),
          leadId: testLead?.id,
          recommendedAdvisor: {
            name: currentAdvisor?.name || 'Test Advisor',
            phone: currentAdvisor?.phone || '(555) 987-6543',
            email: currentAdvisor?.email || 'test@example.com',
            position: currentAdvisor?.marketed_queue_position || 1,
          },
          nextInLine: nextAdvisor ? {
            name: nextAdvisor.name,
            phone: nextAdvisor.phone,
          } : undefined,
        });

        return NextResponse.json({
          success: result.ok,
          message: result.ok ? 'Test MARKETED notification sent to #ml-quote!' : 'Failed to send notification',
          error: result.error,
          testLeadUsed: testLead?.client_name || 'Test Customer',
          assignedTo: currentAdvisor?.name || 'None',
          nextInLineShown: nextAdvisor?.name || 'None (only 1 advisor in queue)',
          channel: '#ml-quote',
        });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
      }
    }

    if (action === 'testTGLSlack') {
      try {
        if (!isSlackConfigured()) {
          return NextResponse.json({
            success: false,
            error: 'Slack not configured. Set SLACK_TGL_WEBHOOK_URL in environment variables.',
          });
        }

        const supabase = createServerSupabaseClient();

        // Get advisors for TGL queue
        const { data: advisors } = await supabase
          .from('comfort_advisors')
          .select('*')
          .eq('active', true)
          .eq('in_queue', true)
          .not('tgl_queue_position', 'is', null)
          .order('tgl_queue_position', { ascending: true });

        const currentAdvisor = advisors?.[0];
        const nextAdvisor = advisors && advisors.length > 1 ? advisors[1] : advisors?.[0];

        // Import sendTGLNotification
        const { sendTGLNotification } = await import('@/lib/slack');

        const result = await sendTGLNotification({
          jobId: 'TGL-TEST-123',
          jobNumber: 'TGL-TEST-123',
          customerName: 'Test TGL Customer',
          customerPhone: '(555) 123-4567',
          customerAddress: '123 Test Street, Dallas, TX 75201',
          scheduledDate: new Date().toISOString(),
          techName: 'Test Technician',
          recommendedAdvisor: {
            name: currentAdvisor?.name || 'Test Advisor',
            phone: currentAdvisor?.phone || '(555) 987-6543',
            email: currentAdvisor?.email || 'test@example.com',
            position: currentAdvisor?.tgl_queue_position || 1,
          },
          nextInLine: nextAdvisor ? {
            name: nextAdvisor.name,
            phone: nextAdvisor.phone,
          } : undefined,
        });

        return NextResponse.json({
          success: result.ok,
          message: result.ok ? 'Test TGL notification sent to #tgl-estimates!' : 'Failed to send notification',
          error: result.error,
          assignedTo: currentAdvisor?.name || 'Test Advisor',
          nextInLineShown: nextAdvisor?.name || 'None',
          channel: '#tgl-estimates',
        });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
      }
    }

    if (action === 'slackStatus') {
      return NextResponse.json({
        success: true,
        configured: isSlackConfigured(),
        webhookConfigured: !!process.env.SLACK_WEBHOOK_URL,
        botTokenConfigured: !!process.env.SLACK_BOT_TOKEN,
      });
    }

    if (action === 'getTags') {
      const token = await authenticateServiceTitan(config);

      // Try settings API for tag types
      const tagsResponse = await fetch(
        `https://api.servicetitan.io/settings/v2/tenant/${config.tenantId}/tag-types?pageSize=200`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'ST-App-Key': config.appKey,
          },
        }
      );

      if (!tagsResponse.ok) {
        const errorText = await tagsResponse.text();
        return NextResponse.json({ success: false, error: `Failed to fetch tags: ${errorText}` }, { status: tagsResponse.status });
      }

      const tagsData = await tagsResponse.json();
      return NextResponse.json({
        success: true,
        tags: tagsData.data || [],
        total: tagsData.data?.length || 0,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Supported actions: test, sync, syncSales, syncAdvisors, create, status, testSlack, slackStatus, checkWebhooks, getJobTypes, getUnassignedJobs' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Service Titan API error:', error);

    // Provide more specific error messages
    let errorMessage = error.message || 'An unexpected error occurred';
    let statusCode = 500;

    if (errorMessage.includes('authentication failed') || errorMessage.includes('401')) {
      errorMessage = 'Authentication failed. Please check your Client ID and Client Secret.';
      statusCode = 401;
    } else if (errorMessage.includes('403')) {
      errorMessage = 'Access forbidden. Please verify your App Key and Tenant ID have the correct permissions.';
      statusCode = 403;
    } else if (errorMessage.includes('404')) {
      errorMessage = 'Resource not found. Please verify your Tenant ID is correct.';
      statusCode = 404;
    } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('fetch failed')) {
      errorMessage = 'Unable to connect to Service Titan servers. Please check your internet connection.';
      statusCode = 503;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Service Titan API endpoint',
    configured: isServiceTitanConfigured(),
    slackConfigured: isSlackConfigured(),
    actions: ['test', 'sync', 'syncSales', 'create', 'status', 'testSlack', 'slackStatus'],
    documentation: 'POST with { action } to interact with Service Titan. Config is loaded from environment variables.',
  });
}
