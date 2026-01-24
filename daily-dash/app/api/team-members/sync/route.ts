import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';

/**
 * POST /api/team-members/sync
 * Sync technicians and employees from ServiceTitan to team_members table
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is owner or manager
  const { role } = session.user as { role?: string };
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const supabase = getServerSupabase();
  const stClient = getServiceTitanClient();

  if (!stClient.isConfigured()) {
    return NextResponse.json(
      { error: 'ServiceTitan not configured' },
      { status: 500 }
    );
  }

  try {
    // Parse options from request body
    const body = await request.json().catch(() => ({}));
    const includeInactive = body.includeInactive === true;

    // Fetch technicians from ServiceTitan
    const technicians = await stClient.getTechnicians(!includeInactive);

    // Fetch employees from ServiceTitan
    const employees = await stClient.getEmployees(!includeInactive);

    // Combine and dedupe by ServiceTitan ID (technicians take priority)
    const peopleMap = new Map<number, {
      servicetitan_id: number;
      name: string;
      email?: string;
      is_active: boolean;
      department: string;
    }>();

    // Add technicians first (they're the primary focus for review mentions)
    for (const tech of technicians) {
      peopleMap.set(tech.id, {
        servicetitan_id: tech.id,
        name: tech.name,
        email: tech.email || undefined,
        is_active: tech.active,
        department: 'Technician',
      });
    }

    // Add employees that aren't already in the map
    for (const emp of employees) {
      if (!peopleMap.has(emp.id)) {
        peopleMap.set(emp.id, {
          servicetitan_id: emp.id,
          name: emp.name,
          email: emp.email || undefined,
          is_active: emp.active,
          department: emp.role || 'Employee',
        });
      }
    }

    const people = Array.from(peopleMap.values());

    // Get existing team members with ServiceTitan IDs
    const { data: existingMembers } = await supabase
      .from('team_members')
      .select('id, servicetitan_id, name')
      .not('servicetitan_id', 'is', null);

    const existingStIds = new Set(
      (existingMembers || []).map(m => m.servicetitan_id)
    );

    // Separate into inserts and updates
    const toInsert = people.filter(p => !existingStIds.has(p.servicetitan_id));
    const toUpdate = people.filter(p => existingStIds.has(p.servicetitan_id));

    let inserted = 0;
    let updated = 0;
    let errors: string[] = [];

    // Insert new team members
    if (toInsert.length > 0) {
      const { error: insertError, data: insertedData } = await supabase
        .from('team_members')
        .insert(
          toInsert.map(p => ({
            name: p.name,
            email: p.email,
            servicetitan_id: p.servicetitan_id,
            is_active: p.is_active,
            department: p.department,
            aliases: generateAliases(p.name),
          }))
        )
        .select();

      if (insertError) {
        errors.push(`Insert error: ${insertError.message}`);
      } else {
        inserted = insertedData?.length || 0;
      }
    }

    // Update existing team members
    for (const person of toUpdate) {
      const { error: updateError } = await supabase
        .from('team_members')
        .update({
          name: person.name,
          email: person.email,
          is_active: person.is_active,
          department: person.department,
        })
        .eq('servicetitan_id', person.servicetitan_id);

      if (updateError) {
        errors.push(`Update error for ${person.name}: ${updateError.message}`);
      } else {
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        techniciansFound: technicians.length,
        employeesFound: employees.length,
        totalUnique: people.length,
        inserted,
        updated,
        skipped: people.length - inserted - updated,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Team member sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/team-members/sync
 * Get sync status / preview what would be synced
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const stClient = getServiceTitanClient();

  try {
    // Get current team member count
    const { count: teamMemberCount } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true });

    // Get count with ServiceTitan IDs
    const { count: syncedCount } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .not('servicetitan_id', 'is', null);

    // Check if ServiceTitan is configured
    const stConfigured = stClient.isConfigured();

    return NextResponse.json({
      teamMemberCount: teamMemberCount || 0,
      syncedFromServiceTitan: syncedCount || 0,
      manuallyAdded: (teamMemberCount || 0) - (syncedCount || 0),
      serviceTitanConfigured: stConfigured,
    });
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}

/**
 * Generate common aliases from a full name
 * e.g., "Robert Smith" -> ["Robert", "Rob", "Bob", "Bobby"]
 */
function generateAliases(fullName: string): string[] {
  const aliases: string[] = [];
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 0) return aliases;

  const firstName = parts[0];
  aliases.push(firstName);

  // Common nickname mappings
  const nicknames: Record<string, string[]> = {
    'Robert': ['Rob', 'Bob', 'Bobby', 'Robbie'],
    'William': ['Will', 'Bill', 'Billy', 'Willy'],
    'Richard': ['Rich', 'Rick', 'Dick', 'Ricky'],
    'Michael': ['Mike', 'Mikey'],
    'James': ['Jim', 'Jimmy', 'Jamie'],
    'Joseph': ['Joe', 'Joey'],
    'Thomas': ['Tom', 'Tommy'],
    'Christopher': ['Chris'],
    'Daniel': ['Dan', 'Danny'],
    'Matthew': ['Matt', 'Matty'],
    'Anthony': ['Tony'],
    'Andrew': ['Andy', 'Drew'],
    'Nicholas': ['Nick', 'Nicky'],
    'Jonathan': ['Jon', 'John'],
    'Benjamin': ['Ben', 'Benny'],
    'Samuel': ['Sam', 'Sammy'],
    'Timothy': ['Tim', 'Timmy'],
    'Alexander': ['Alex'],
    'Patrick': ['Pat', 'Paddy'],
    'Stephen': ['Steve', 'Stevie'],
    'Steven': ['Steve', 'Stevie'],
    'Edward': ['Ed', 'Eddie', 'Ted', 'Teddy'],
    'David': ['Dave', 'Davy'],
    'Kenneth': ['Ken', 'Kenny'],
    'Ronald': ['Ron', 'Ronnie'],
    'Donald': ['Don', 'Donnie'],
    'Charles': ['Charlie', 'Chuck'],
    'Elizabeth': ['Liz', 'Beth', 'Betty', 'Lizzy'],
    'Jennifer': ['Jen', 'Jenny'],
    'Katherine': ['Kate', 'Katie', 'Kathy'],
    'Catherine': ['Kate', 'Katie', 'Cathy'],
    'Rebecca': ['Becca', 'Becky'],
    'Jessica': ['Jess', 'Jessie'],
    'Christina': ['Chris', 'Tina'],
    'Christine': ['Chris', 'Christy'],
    'Margaret': ['Maggie', 'Peggy', 'Meg'],
    'Patricia': ['Pat', 'Patty', 'Trish'],
    'Victoria': ['Vicky', 'Tori'],
    'Samantha': ['Sam', 'Sammy'],
    'Alexandra': ['Alex', 'Lexi'],
    'Abigail': ['Abby'],
    'Jacqueline': ['Jackie'],
  };

  // Add nicknames if firstName matches
  const normalizedFirst = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  if (nicknames[normalizedFirst]) {
    aliases.push(...nicknames[normalizedFirst]);
  }

  // Check if any nickname maps to this first name (reverse lookup)
  for (const [formal, nicks] of Object.entries(nicknames)) {
    if (nicks.some(n => n.toLowerCase() === firstName.toLowerCase())) {
      aliases.push(formal);
      // Add other nicknames too
      aliases.push(...nicks.filter(n => n.toLowerCase() !== firstName.toLowerCase()));
    }
  }

  // Add last name if present
  if (parts.length > 1) {
    aliases.push(parts[parts.length - 1]); // Last name
  }

  // Remove duplicates and return
  return [...new Set(aliases.map(a => a.trim()).filter(a => a.length > 0))];
}
