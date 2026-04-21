import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Fetch all data in parallel
  const [
    campaignResult,
    newCustomersResult,
    reviewsResult,
    completedJobsResult,
  ] = await Promise.all([
    // Campaign report aggregates for the date range
    supabase
      .from('st_campaign_reports')
      .select('inbound_calls, unique_inbound_calls, total_jobs_booked, booked_jobs_completed, completed_revenue, total_sales, jobs_booked_new_customers, jobs_booked_existing_customers, revenue_per_lead')
      .gte('report_date_start', startDate)
      .lte('report_date_end', endDate),

    // New customers created in date range
    supabase
      .from('new_customers')
      .select('st_customer_id, completed_revenue, total_sales, completed_jobs, lifetime_revenue')
      .gte('created_on', startDate)
      .lte('created_on', endDate),

    // Google reviews in date range
    supabase
      .from('google_reviews')
      .select('star_rating, create_time')
      .gte('create_time', `${startDate}T00:00:00`)
      .lte('create_time', `${endDate}T23:59:59`),

    // Total completed jobs from campaign reports (for % of jobs with review)
    supabase
      .from('st_campaign_reports')
      .select('booked_jobs_completed')
      .gte('report_date_start', startDate)
      .lte('report_date_end', endDate),
  ]);

  // Aggregate campaign report data
  const campaigns = campaignResult.data || [];
  const totalLeads = campaigns.reduce((sum, c) => sum + (c.inbound_calls || 0), 0);
  const totalJobsBooked = campaigns.reduce((sum, c) => sum + (c.total_jobs_booked || 0), 0);
  const totalCompleted = campaigns.reduce((sum, c) => sum + (c.booked_jobs_completed || 0), 0);
  const totalCompletedRevenue = campaigns.reduce((sum, c) => sum + (c.completed_revenue || 0), 0);
  const totalSales = campaigns.reduce((sum, c) => sum + (c.total_sales || 0), 0);
  const totalNewCustomersBooked = campaigns.reduce((sum, c) => sum + (c.jobs_booked_new_customers || 0), 0);

  // New customers from new_customers table
  const newCustomers = newCustomersResult.data || [];
  const newCustomerCount = newCustomers.length;
  const newCustomerRevenue = newCustomers.reduce((sum, c) => sum + (c.completed_revenue || 0), 0);
  const newCustomerSales = newCustomers.reduce((sum, c) => sum + (c.total_sales || 0), 0);

  // Total revenue (completed + sales)
  const totalRevenue = totalCompletedRevenue + totalSales;

  // Growth metrics
  const growth = {
    totalLeads,
    newNamesInST: newCustomerCount,
    totalNewCustomers: totalNewCustomersBooked || newCustomerCount,
    leadsToCustomerPercent: totalLeads > 0 ? Math.round((totalNewCustomersBooked / totalLeads) * 100) : 0,
    newCustomerRevenue,
    revenuePercentOfTotal: totalRevenue > 0 ? Math.round((newCustomerRevenue / totalRevenue) * 100) : 0,
    avgRevenuePerNewCustomer: totalNewCustomersBooked > 0 ? Math.round(newCustomerRevenue / totalNewCustomersBooked) : 0,
    revenuePerLead: totalLeads > 0 ? Math.round(totalRevenue / totalLeads) : 0,
    totalJobsBooked,
    totalCompleted,
    totalCompletedRevenue,
    totalSales,
    totalRevenue,
  };

  // Reviews metrics
  const reviews = reviewsResult.data || [];
  const reviewCount = reviews.length;
  const grossRating = reviews.reduce((sum, r) => sum + (r.star_rating || 0), 0);
  const avgRating = reviewCount > 0 ? grossRating / reviewCount : 0;
  const totalCompletedJobs = (completedJobsResult.data || []).reduce((sum, c) => sum + (c.booked_jobs_completed || 0), 0);
  const jobsWithReviewPercent = totalCompletedJobs > 0 ? Math.round((reviewCount / totalCompletedJobs) * 100) : 0;

  const reviewMetrics = {
    count: reviewCount,
    jobsWithReviewPercent,
    grossRating,
    avgRating: Math.round(avgRating * 100) / 100,
    totalCompletedJobs,
  };

  return NextResponse.json({
    dateRange: { start: startDate, end: endDate },
    growth,
    reviews: reviewMetrics,
  });
}
