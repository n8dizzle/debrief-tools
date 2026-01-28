import { NextRequest, NextResponse } from 'next/server';
import { getServiceTitanClient } from '@/lib/servicetitan';

export async function GET(request: NextRequest) {
  try {
    const stClient = getServiceTitanClient();

    if (!stClient.isConfigured()) {
      return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
    }

    // Step 1: Get all tag types
    console.log('Fetching all tag types...');
    const tagTypes = await stClient.getTagTypes();
    console.log(`Found ${tagTypes.length} tag types`);

    // Log all tag types
    if (tagTypes.length > 0) {
      console.log('Tag types:', tagTypes.map(t => `${t.id}: ${t.name}`).join(', '));
    }

    // Step 2: Also fetch a sample of recent jobs to see their tagTypeIds
    console.log('Fetching sample jobs to inspect tagTypeIds...');
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startDate = oneYearAgo.toISOString().split('T')[0];

    const sampleJobs = await stClient.getJobsByTagTypeId(null, {
      completedOnOrAfter: startDate,
      pageSize: 100,
    });

    // Collect all unique tagTypeIds from jobs
    const allTagIds = new Set<number>();
    const jobsWithTags: any[] = [];

    for (const job of sampleJobs) {
      if (job.tagTypeIds && job.tagTypeIds.length > 0) {
        job.tagTypeIds.forEach((id: number) => allTagIds.add(id));
        jobsWithTags.push({
          jobNumber: job.jobNumber,
          tagTypeIds: job.tagTypeIds,
          total: job.total,
          completedOn: job.completedOn,
        });
      }
    }

    console.log(`Found ${allTagIds.size} unique tag IDs from ${jobsWithTags.length} jobs with tags`);
    console.log('Tag IDs found:', [...allTagIds].join(', '));

    // Find "In-house Financing" tag - we know from job 55061874 it's ID 158479256
    const IN_HOUSE_FINANCING_TAG_ID = 158479256;

    // Also look for it in the tag types list
    const inHouseFinancingTag = tagTypes.find(t =>
      t.name.toLowerCase().includes('in-house') ||
      t.name.toLowerCase().includes('in house')
    );

    // Look for "Approved Financing" tag as well
    const approvedFinancingTag = tagTypes.find(t =>
      t.name.toLowerCase().includes('approved financing')
    );

    console.log('In-house Financing tag from list:', inHouseFinancingTag);
    console.log('Approved Financing tag:', approvedFinancingTag);

    // Fetch jobs with the known In-house Financing tag ID
    let inHouseFinancingJobs: any[] = [];
    console.log(`Fetching jobs with In-house Financing tag ID ${IN_HOUSE_FINANCING_TAG_ID}...`);
    inHouseFinancingJobs = await stClient.getJobsByTagTypeId(IN_HOUSE_FINANCING_TAG_ID, {
      completedOnOrAfter: startDate,
      pageSize: 50,
    });
    console.log(`Found ${inHouseFinancingJobs.length} jobs with In-house Financing tag`);

    // Also try to fetch the specific job from the screenshot (55061874)
    let specificJob = null;
    try {
      const job = await stClient.getJobByNumber('55061874');
      if (job) {
        specificJob = {
          id: job.id,
          jobNumber: job.jobNumber,
          tagTypeIds: job.tagTypeIds,
          summary: (job as any).summary,
        };
        console.log('Specific job 55061874 tags:', specificJob.tagTypeIds);
      }
    } catch (e) {
      console.log('Could not fetch specific job');
    }

    return NextResponse.json({
      success: true,
      inHouseFinancingTagId: IN_HOUSE_FINANCING_TAG_ID,
      inHouseFinancingTagFromList: inHouseFinancingTag || null,
      approvedFinancingTag: approvedFinancingTag ? { id: approvedFinancingTag.id, name: approvedFinancingTag.name } : null,
      inHouseFinancingJobsCount: inHouseFinancingJobs.length,
      inHouseFinancingJobsSample: inHouseFinancingJobs.slice(0, 10).map(j => ({
        id: j.id,
        jobNumber: j.jobNumber,
        customerId: j.customerId,
        total: j.total,
        completedOn: j.completedOn,
        tagTypeIds: j.tagTypeIds,
      })),
      specificJob55061874: specificJob,
      tagTypesCount: tagTypes.length,
    });
  } catch (error) {
    console.error('Test tags error:', error);
    return NextResponse.json(
      { error: 'Failed to test tags', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
