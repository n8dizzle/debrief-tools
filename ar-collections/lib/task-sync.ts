/**
 * Task Sync Logic
 * Handles bidirectional sync between AR Collections and ServiceTitan
 */

import { getServerSupabase, ARCollectionTaskExtended, ARTaskSyncStatus } from './supabase';
import { getServiceTitanClient, STTask, STTaskCreate, STTaskUpdate } from './servicetitan';

export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  updated: number;
  errors: string[];
}

/**
 * Get all open AR job IDs (invoices with balance > 0)
 */
export async function getOpenARJobIds(): Promise<number[]> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('ar_invoices')
    .select('st_job_id')
    .gt('balance', 0)
    .not('st_job_id', 'is', null)
    .gt('st_job_id', 0);

  if (error || !data) {
    console.error('Failed to get open AR job IDs:', error);
    return [];
  }

  return data
    .map(inv => inv.st_job_id)
    .filter((id): id is number => id !== null && id > 0);
}

/**
 * Push a single task to ServiceTitan
 */
export async function pushTaskToST(task: ARCollectionTaskExtended): Promise<{ success: boolean; stTaskId?: number; error?: string }> {
  const stClient = getServiceTitanClient();
  const supabase = getServerSupabase();

  // Task must have a type ID to sync
  if (!task.st_type_id) {
    return { success: false, error: 'Task has no ST type ID assigned' };
  }

  // If task doesn't have st_job_id but has invoice_id, look it up
  let stJobId = task.st_job_id;
  let stCustomerId = task.st_customer_id;
  let businessUnitId: number | null = null;

  if (task.invoice_id) {
    const { data: invoice } = await supabase
      .from('ar_invoices')
      .select('st_job_id, st_customer_id, business_unit_id')
      .eq('id', task.invoice_id)
      .single();

    if (invoice) {
      if (!stJobId) stJobId = invoice.st_job_id;
      if (!stCustomerId) stCustomerId = invoice.st_customer_id;
      businessUnitId = invoice.business_unit_id;

      // Update the task with the job ID for future syncs
      if (stJobId && !task.st_job_id) {
        await supabase
          .from('ar_collection_tasks')
          .update({ st_job_id: stJobId, st_customer_id: stCustomerId })
          .eq('id', task.id);
      }
    }
  }

  // Get business unit ID from job if we have a job ID
  if (!businessUnitId && stJobId) {
    try {
      // Get job details to find business unit
      const job = await stClient.getJob(stJobId);
      if (job) {
        businessUnitId = job.businessUnitId;
      }
    } catch (e) {
      console.error('Failed to get job for business unit:', e);
    }
  }

  // Business unit is required by ST
  if (!businessUnitId) {
    return { success: false, error: 'Could not determine business unit for task' };
  }

  // Need either a job ID or customer ID to create the task
  if (!stJobId && !stCustomerId) {
    return { success: false, error: 'Task must have either st_job_id or st_customer_id' };
  }

  // Get "AR" source ID for tasks pushed from AR Collections
  let sourceId = task.st_source_id;
  if (!sourceId) {
    // Look for source named "AR" first, fall back to first active source
    const { data: arSource } = await supabase
      .from('ar_st_task_sources')
      .select('st_source_id')
      .eq('is_active', true)
      .ilike('name', '%AR%')
      .limit(1)
      .single();

    if (arSource) {
      sourceId = arSource.st_source_id;
    } else {
      // Fallback to first active source
      const { data: firstSource } = await supabase
        .from('ar_st_task_sources')
        .select('st_source_id')
        .eq('is_active', true)
        .limit(1)
        .single();
      sourceId = firstSource?.st_source_id || null;
    }
  }

  if (!sourceId) {
    return { success: false, error: 'No ST task source configured. Refresh ST config in Settings.' };
  }

  // Map our priority to ST priority strings
  const priorityMap: Record<string, 'Low' | 'Normal' | 'High' | 'Urgent'> = {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    urgent: 'Urgent',
  };

  // Get default employee ID if not assigned
  let assignedToId = task.st_assigned_to;
  if (!assignedToId) {
    // Get first active employee as default
    const { data: defaultEmployee } = await supabase
      .from('ar_st_employees')
      .select('st_employee_id')
      .eq('is_active', true)
      .limit(1)
      .single();
    assignedToId = defaultEmployee?.st_employee_id || null;
  }

  if (!assignedToId) {
    return { success: false, error: 'No employee available for task assignment' };
  }

  // Build the ST task create payload
  const stTaskData: STTaskCreate = {
    employeeTaskSourceId: sourceId,
    employeeTaskTypeId: task.st_type_id,
    name: task.title,
    description: task.description && task.description.trim() ? task.description : undefined,
    dueDate: task.due_date || undefined,
    isClosed: false,
    priority: priorityMap[task.priority] || 'Normal',
    assignedToId: assignedToId,
    reportedById: assignedToId, // Use same employee as reporter
    reportedDate: new Date().toISOString(),
    businessUnitId: businessUnitId,
  };

  if (stJobId) {
    stTaskData.jobId = stJobId;
  } else if (stCustomerId) {
    stTaskData.customerId = stCustomerId;
  }

  try {
    const stTask = await stClient.createTask(stTaskData);
    if (!stTask) {
      return { success: false, error: 'Failed to create task in ServiceTitan' };
    }

    // Update our task with ST task ID
    const { error: updateError } = await supabase
      .from('ar_collection_tasks')
      .update({
        st_task_id: stTask.id,
        st_source_id: sourceId,
        sync_status: 'synced',
        st_synced_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq('id', task.id);

    if (updateError) {
      console.error('Failed to update task after ST push:', updateError);
    }

    return { success: true, stTaskId: stTask.id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    // Mark task as push failed
    await supabase
      .from('ar_collection_tasks')
      .update({
        sync_status: 'push_failed',
        sync_error: errorMsg,
      })
      .eq('id', task.id);

    return { success: false, error: errorMsg };
  }
}

/**
 * Push all pending tasks to ServiceTitan
 */
export async function pushPendingTasksToST(): Promise<SyncResult> {
  const supabase = getServerSupabase();
  const result: SyncResult = {
    success: true,
    pushed: 0,
    pulled: 0,
    updated: 0,
    errors: [],
  };

  // Get all tasks with pending_push status
  const { data: tasks, error } = await supabase
    .from('ar_collection_tasks')
    .select('*')
    .eq('sync_status', 'pending_push');

  if (error || !tasks || tasks.length === 0) {
    return result;
  }

  console.log(`Found ${tasks.length} tasks to push to ST`);

  for (const task of tasks) {
    const pushResult = await pushTaskToST(task as ARCollectionTaskExtended);
    if (pushResult.success) {
      result.pushed++;
    } else {
      result.errors.push(`Task ${task.id}: ${pushResult.error}`);
    }

    // Small delay between API calls
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Sync a task update to ServiceTitan
 */
export async function syncTaskUpdateToST(
  task: ARCollectionTaskExtended,
  updates: { status?: string; outcome?: string; completed_at?: string }
): Promise<boolean> {
  if (!task.st_task_id) {
    return false;
  }

  const stClient = getServiceTitanClient();
  const supabase = getServerSupabase();

  const stUpdates: STTaskUpdate = {};

  // Map status: pending->Open, in_progress->InProgress, completed->Completed, cancelled->Cancelled
  if (updates.status) {
    const statusMap: Record<string, string> = {
      pending: 'Open',
      in_progress: 'InProgress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    stUpdates.status = statusMap[updates.status] || updates.status;
  }

  if (updates.completed_at) {
    stUpdates.completedOn = updates.completed_at;
  }

  // If completed, try to find a matching resolution
  if (updates.status === 'completed' && updates.outcome) {
    const { data: resolutions } = await supabase
      .from('ar_st_task_resolutions')
      .select('st_resolution_id, name')
      .eq('is_active', true);

    if (resolutions) {
      // Try to find a matching resolution by name (case-insensitive)
      const matchingResolution = resolutions.find(r =>
        r.name.toLowerCase().includes(updates.outcome!.toLowerCase()) ||
        updates.outcome!.toLowerCase().includes(r.name.toLowerCase())
      );

      if (matchingResolution) {
        stUpdates.resolutionId = matchingResolution.st_resolution_id;
      }
    }
  }

  try {
    const stTask = await stClient.updateTask(task.st_task_id, stUpdates);
    if (stTask) {
      await supabase
        .from('ar_collection_tasks')
        .update({
          sync_status: 'synced',
          st_synced_at: new Date().toISOString(),
          sync_error: null,
        })
        .eq('id', task.id);

      return true;
    }
  } catch (error) {
    console.error('Failed to sync task update to ST:', error);

    await supabase
      .from('ar_collection_tasks')
      .update({
        sync_status: 'push_failed',
        sync_error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', task.id);
  }

  return false;
}

/**
 * Pull tasks from ServiceTitan for open AR jobs
 */
export async function pullTasksFromST(): Promise<SyncResult> {
  const stClient = getServiceTitanClient();
  const supabase = getServerSupabase();

  const result: SyncResult = {
    success: true,
    pushed: 0,
    pulled: 0,
    updated: 0,
    errors: [],
  };

  // Get all open AR job IDs
  const jobIds = await getOpenARJobIds();
  if (jobIds.length === 0) {
    return result;
  }

  console.log(`Pulling tasks for ${jobIds.length} open AR jobs`);

  // Get all existing ST task IDs we already have
  const { data: existingTasks } = await supabase
    .from('ar_collection_tasks')
    .select('st_task_id, id, sync_status, updated_at')
    .not('st_task_id', 'is', null);

  const existingStTaskIds = new Map(
    (existingTasks || []).map(t => [t.st_task_id, t])
  );

  // Process jobs in batches
  const batchSize = 10;
  for (let i = 0; i < jobIds.length; i += batchSize) {
    const batchJobIds = jobIds.slice(i, i + batchSize);

    for (const jobId of batchJobIds) {
      try {
        const stTasks = await stClient.getTasksForJob(jobId);

        for (const stTask of stTasks) {
          const existing = existingStTaskIds.get(stTask.id);

          if (existing) {
            // Task exists - check if ST modified after our sync
            const stModified = stTask.modifiedOn ? new Date(stTask.modifiedOn) : null;
            const ourUpdated = existing.updated_at ? new Date(existing.updated_at) : null;

            if (stModified && ourUpdated && stModified > ourUpdated) {
              // ST is newer - update our record (ST wins for status)
              await updateTaskFromST(existing.id, stTask);
              result.updated++;
            }
          } else {
            // New task from ST - create local record
            await createTaskFromST(stTask, jobId);
            result.pulled++;
          }
        }
      } catch (error) {
        result.errors.push(`Job ${jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Create a local task from a ServiceTitan task
 */
async function createTaskFromST(stTask: STTask, jobId: number): Promise<void> {
  const supabase = getServerSupabase();

  // Get the invoice for this job
  const { data: invoice } = await supabase
    .from('ar_invoices')
    .select('id, customer_id, st_customer_id')
    .eq('st_job_id', jobId)
    .single();

  // Map ST status to our status
  const statusMap: Record<string, string> = {
    Open: 'pending',
    InProgress: 'in_progress',
    Completed: 'completed',
    Cancelled: 'cancelled',
  };

  // Map ST priority to our priority
  const priorityMap: Record<number, string> = {
    1: 'urgent',
    2: 'high',
    3: 'normal',
    4: 'low',
  };

  // Default task type based on ST task type (we'll refine this with actual mappings later)
  const taskType = 'call'; // Default, could be refined based on ST type name

  await supabase
    .from('ar_collection_tasks')
    .insert({
      invoice_id: invoice?.id || null,
      customer_id: invoice?.customer_id || null,
      st_customer_id: invoice?.st_customer_id || stTask.customerId || null,
      st_job_id: jobId,
      st_task_id: stTask.id,
      st_source_id: stTask.sourceId || null,
      st_type_id: stTask.typeId || null,
      st_resolution_id: stTask.resolutionId || null,
      task_type: taskType,
      title: stTask.subject || 'Task from ServiceTitan',
      description: stTask.description || null,
      status: statusMap[stTask.status || 'Open'] || 'pending',
      priority: priorityMap[stTask.priority || 3] || 'normal',
      due_date: stTask.dueDate || null,
      completed_at: stTask.completedOn || null,
      sync_status: 'from_st' as ARTaskSyncStatus,
      st_synced_at: new Date().toISOString(),
    });
}

/**
 * Update a local task from a ServiceTitan task
 */
async function updateTaskFromST(taskId: string, stTask: STTask): Promise<void> {
  const supabase = getServerSupabase();

  const statusMap: Record<string, string> = {
    Open: 'pending',
    InProgress: 'in_progress',
    Completed: 'completed',
    Cancelled: 'cancelled',
  };

  await supabase
    .from('ar_collection_tasks')
    .update({
      title: stTask.subject || undefined,
      description: stTask.description || undefined,
      status: statusMap[stTask.status || 'Open'] || 'pending',
      due_date: stTask.dueDate || null,
      completed_at: stTask.completedOn || null,
      st_resolution_id: stTask.resolutionId || null,
      st_synced_at: new Date().toISOString(),
      sync_status: 'synced',
      sync_error: null,
    })
    .eq('id', taskId);
}

/**
 * Run full bidirectional sync
 */
export async function runFullTaskSync(): Promise<SyncResult> {
  const supabase = getServerSupabase();

  // Create sync log entry
  const { data: logEntry } = await supabase
    .from('ar_task_sync_log')
    .insert({
      sync_type: 'full_sync',
      started_at: new Date().toISOString(),
      status: 'running',
    })
    .select()
    .single();

  const logId = logEntry?.id;

  // First push pending tasks to ST
  const pushResult = await pushPendingTasksToST();

  // Then pull tasks from ST
  const pullResult = await pullTasksFromST();

  // Combine results
  const finalResult: SyncResult = {
    success: pushResult.success && pullResult.success,
    pushed: pushResult.pushed,
    pulled: pullResult.pulled,
    updated: pullResult.updated,
    errors: [...pushResult.errors, ...pullResult.errors],
  };

  // Update sync log
  if (logId) {
    await supabase
      .from('ar_task_sync_log')
      .update({
        completed_at: new Date().toISOString(),
        tasks_pushed: finalResult.pushed,
        tasks_pulled: finalResult.pulled,
        tasks_updated: finalResult.updated,
        errors: finalResult.errors.length > 0 ? finalResult.errors.join('; ') : null,
        status: finalResult.success ? 'completed' : 'failed',
      })
      .eq('id', logId);
  }

  return finalResult;
}
