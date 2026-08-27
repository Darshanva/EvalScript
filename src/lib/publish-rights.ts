import { supabase } from './supabase';

const KEY = 'evalscript_publish_rights';

export interface PublishRight {
  id: string;
  facultyId: string;
  facultyName: string;
  client: string;
  batch: string;
  term: string;
  section: string;
  enabled: boolean;
  createdAt: string;
}

function loadLocal(): PublishRight[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function saveLocal(list: PublishRight[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('publish-rights-updated'));
}

export async function loadPublishRights(): Promise<PublishRight[]> {
  try {
    const { data, error } = await supabase.from('publish_rights').select('*');
    if (!error && data) {
      const mapped = data.map((r: any) => ({
        id: r.id,
        facultyId: r.faculty_id,
        facultyName: r.faculty_name || '',
        client: r.client || '',
        batch: r.batch || '',
        term: r.term || '',
        section: r.section || '',
        enabled: !!r.enabled,
        createdAt: r.created_at || new Date().toISOString(),
      }));
      saveLocal(mapped);
      return mapped;
    }
  } catch (e) {
    console.warn('publish_rights cloud', e);
  }
  return loadLocal();
}

export async function savePublishRight(right: PublishRight) {
  const list = loadLocal().filter((x) => x.id !== right.id);
  list.push(right);
  saveLocal(list);
  try {
    await supabase.from('publish_rights').upsert({
      id: right.id,
      faculty_id: right.facultyId,
      faculty_name: right.facultyName,
      client: right.client,
      batch: right.batch,
      term: right.term,
      section: right.section,
      enabled: right.enabled,
      created_at: right.createdAt,
    });
  } catch (e) {
    console.warn(e);
  }
}

export async function removePublishRight(id: string) {
  saveLocal(loadLocal().filter((x) => x.id !== id));
  try {
    await supabase.from('publish_rights').delete().eq('id', id);
  } catch (e) {
    console.warn(e);
  }
}

/** Faculty can publish for this exam path? */
export function canFacultyPublish(
  rights: PublishRight[],
  facultyId: string,
  pathText: string
): boolean {
  const blob = pathText.toLowerCase();
  return rights.some((r) => {
    if (!r.enabled || r.facultyId !== facultyId) return false;
    const parts = [r.client, r.batch, r.term, r.section]
      .filter(Boolean)
      .map((p) => p.toLowerCase());
    if (!parts.length) return true;
    return parts.every((p) => blob.includes(p));
  });
}

export function resultGroupKey(examCode: string, sectionHint: string): string {
  const sec = sectionHint.replace(/section\s*/i, '').trim().toUpperCase() || '';
  if (sec && /^[A-F]$/.test(sec)) return `${examCode}${sec}`;
  return examCode || 'EXAM';
}