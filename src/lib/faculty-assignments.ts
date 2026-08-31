import { supabase } from './supabase';

export interface FacultyAssignment {
  id: string;
  facultyId?: string;
  facultyEmail: string;
  facultyName?: string;
  organisation: string;
  batch?: string;
  term?: string;
  section: string;
  createdAt: string;
}

function mapRow(row: any): FacultyAssignment {
  return {
    id: row.id,
    facultyId: row.faculty_id || undefined,
    facultyEmail: (row.faculty_email || '').toLowerCase().trim(),
    facultyName: row.faculty_name || undefined,
    organisation: row.organisation || '',
    batch: row.batch || undefined,
    term: row.term || undefined,
    section: row.section || '',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export async function fetchFacultyAssignments(
  organisation?: string
): Promise<FacultyAssignment[]> {
  let q = supabase.from('faculty_assignments').select('*').order('created_at', {
    ascending: false,
  });
  if (organisation) {
    q = q.eq('organisation', organisation);
  }
  const { data, error } = await q;
  if (error) {
    console.error('fetchFacultyAssignments', error);
    return [];
  }
  return (data || []).map(mapRow);
}

export async function fetchAssignmentsForFaculty(
  email: string
): Promise<FacultyAssignment[]> {
  const em = (email || '').toLowerCase().trim();
  if (!em) return [];
  const { data, error } = await supabase
    .from('faculty_assignments')
    .select('*')
    .ilike('faculty_email', em);
  if (error) {
    console.error('fetchAssignmentsForFaculty', error);
    return [];
  }
  return (data || []).map(mapRow);
}

export async function saveFacultyAssignment(
  a: FacultyAssignment
): Promise<void> {
  const row = {
    id: a.id,
    faculty_id: a.facultyId || null,
    faculty_email: a.facultyEmail.toLowerCase().trim(),
    faculty_name: a.facultyName || null,
    organisation: a.organisation,
    batch: a.batch || null,
    term: a.term || null,
    section: a.section,
    created_at: a.createdAt || new Date().toISOString(),
  };
  const { error } = await supabase.from('faculty_assignments').upsert(row);
  if (error) {
    console.error('saveFacultyAssignment', error);
    throw error;
  }
}

export async function deleteFacultyAssignment(id: string): Promise<void> {
  const { error } = await supabase
    .from('faculty_assignments')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('deleteFacultyAssignment', error);
    throw error;
  }
}

/** Faculty can create exam under this section path? */
export function facultyCanAccessPath(
  assignments: FacultyAssignment[],
  path: {
    org?: string;
    batch?: string;
    term?: string;
    section?: string;
  }
): boolean {
  if (!assignments.length) return false;
  const org = (path.org || '').toLowerCase();
  const batch = (path.batch || '').toLowerCase();
  const term = (path.term || '').toLowerCase();
  const section = (path.section || '').toLowerCase();

  return assignments.some((a) => {
    if ((a.organisation || '').toLowerCase() !== org && org) {
      // if org known on path, must match
      if (org) return false;
    }
    if (section && (a.section || '').toLowerCase() !== section) return false;
    if (batch && a.batch && (a.batch || '').toLowerCase() !== batch)
      return false;
    if (term && a.term && (a.term || '').toLowerCase() !== term) return false;
    return true;
  });
}