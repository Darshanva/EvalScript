import { supabase } from './supabase';

export type TreeLevel =
  | 'vertical'
  | 'org'
  | 'batch'
  | 'term'
  | 'section'
  | 'subject';

export interface TreePath {
  vertical: string;
  org: string;
  batch: string;
  term: string;
  section: string;
  subject: string;
}

export const EMPTY_PATH: TreePath = {
  vertical: '',
  org: '',
  batch: '',
  term: '',
  section: '',
  subject: '',
};

export const LEVEL_TITLES: Record<TreeLevel, string> = {
  vertical: 'Vertical / Client',
  org: 'Organisation',
  batch: 'Batch',
  term: 'Term',
  section: 'Section',
  subject: 'Subject',
};

const STORAGE_KEY = 'evalscript_exam_tree';
const SETTINGS_KEY = 'exam_tree';

export const DEFAULT_EXAM_TREE: Record<string, any> = {
  'Select Vertical / Client': {
    'HDFC Bank': {
      Batch1: {
        'Term 1': {
          'Section A': {
            Subject1: {},
          },
        },
      },
    },
  },
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function notify() {
  try {
    window.dispatchEvent(new Event('exam-tree-updated'));
  } catch {
    /* ignore */
  }
}

/** Ensure nested object path exists */
function ensurePath(
  tree: Record<string, any>,
  path: TreePath,
  upTo: TreeLevel
): Record<string, any> | null {
  const order: TreeLevel[] = [
    'vertical',
    'org',
    'batch',
    'term',
    'section',
    'subject',
  ];
  const need = order.indexOf(upTo);
  let node: any = tree;

  for (let i = 0; i < need; i++) {
    const key = order[i];
    const name = path[key];
    if (!name) return null;
    if (!node[name] || typeof node[name] !== 'object') {
      node[name] = {};
    }
    node = node[name];
  }
  return node;
}

export async function loadExamTree(): Promise<Record<string, any>> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (!error && data?.value && typeof data.value === 'object') {
      const tree = data.value as Record<string, any>;
      if (Object.keys(tree).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
        return clone(tree);
      }
    }
  } catch (e) {
    console.warn('loadExamTree cloud', e);
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) {
        return clone(parsed);
      }
    }
  } catch {
    /* ignore */
  }

  return clone(DEFAULT_EXAM_TREE);
}

export async function saveExamTree(tree: Record<string, any>): Promise<void> {
  const payload = clone(tree);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  notify();

  const { error } = await supabase.from('app_settings').upsert({
    key: SETTINGS_KEY,
    value: payload,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('saveExamTree cloud', error);
    throw new Error(
      error.message ||
        'Could not save structure to cloud. Check app_settings table + RLS.'
    );
  }
}

export function getItemsAtLevel(
  tree: Record<string, any>,
  level: TreeLevel,
  path: TreePath
): string[] {
  if (!tree) return [];

  if (level === 'vertical') {
    return Object.keys(tree);
  }

  const parentLevel: Record<TreeLevel, TreeLevel | null> = {
    vertical: null,
    org: 'vertical',
    batch: 'org',
    term: 'batch',
    section: 'term',
    subject: 'section',
  };

  const parent = parentLevel[level];
  if (!parent) return [];

  // Walk to parent container
  let node: any = tree;
  const walk: TreeLevel[] = ['vertical', 'org', 'batch', 'term', 'section'];
  const stop = walk.indexOf(parent);

  for (let i = 0; i <= stop; i++) {
    const k = walk[i];
    const name = path[k];
    if (!name || !node || typeof node !== 'object') return [];
    node = node[name];
  }

  if (!node || typeof node !== 'object' || Array.isArray(node)) return [];
  return Object.keys(node);
}

/**
 * Add item. Creates missing parents if possible.
 * Returns { tree, ok, error }
 */
export function addTreeItem(
  tree: Record<string, any>,
  level: TreeLevel,
  path: TreePath,
  name: string
): { tree: Record<string, any>; ok: boolean; error?: string } {
  const n = (name || '').trim();
  if (!n) return { tree, ok: false, error: 'Name required' };

  const next = clone(tree);

  if (level === 'vertical') {
    if (!next[n]) next[n] = {};
    return { tree: next, ok: true };
  }

  if (level === 'org') {
    if (!path.vertical) {
      return { tree, ok: false, error: 'Select vertical first' };
    }
    if (!next[path.vertical]) next[path.vertical] = {};
    if (!next[path.vertical][n]) next[path.vertical][n] = {};
    return { tree: next, ok: true };
  }

  if (level === 'batch') {
    if (!path.vertical || !path.org) {
      return { tree, ok: false, error: 'Select vertical + organisation first' };
    }
    const parent = ensurePath(next, path, 'batch');
    if (!parent) return { tree, ok: false, error: 'Invalid path' };
    if (!parent[n]) parent[n] = {};
    return { tree: next, ok: true };
  }

  if (level === 'term') {
    if (!path.batch) {
      return { tree, ok: false, error: 'Select batch first' };
    }
    const parent = ensurePath(next, path, 'term');
    if (!parent) return { tree, ok: false, error: 'Invalid path' };
    if (!parent[n]) parent[n] = {};
    return { tree: next, ok: true };
  }

  if (level === 'section') {
    if (!path.term) {
      return { tree, ok: false, error: 'Select term first' };
    }
    const parent = ensurePath(next, path, 'section');
    if (!parent) return { tree, ok: false, error: 'Invalid path' };
    if (!parent[n]) parent[n] = {};
    return { tree: next, ok: true };
  }

  if (level === 'subject') {
    if (!path.section) {
      return {
        tree,
        ok: false,
        error: 'Open a Section first, then add Subject',
      };
    }
    const parent = ensurePath(next, path, 'subject');
    if (!parent) {
      return {
        tree,
        ok: false,
        error: 'Path incomplete — go Section level and retry',
      };
    }
    if (!parent[n]) parent[n] = {};
    return { tree: next, ok: true };
  }

  return { tree, ok: false, error: 'Unknown level' };
}

export function deleteTreeItem(
  tree: Record<string, any>,
  level: TreeLevel,
  path: TreePath,
  name: string
): { tree: Record<string, any>; ok: boolean; error?: string } {
  const next = clone(tree);

  try {
    if (level === 'vertical') {
      delete next[name];
      return { tree: next, ok: true };
    }
    if (level === 'org') {
      if (next[path.vertical]) delete next[path.vertical][name];
      return { tree: next, ok: true };
    }
    if (level === 'batch') {
      const o = next[path.vertical]?.[path.org];
      if (o) delete o[name];
      return { tree: next, ok: true };
    }
    if (level === 'term') {
      const b = next[path.vertical]?.[path.org]?.[path.batch];
      if (b) delete b[name];
      return { tree: next, ok: true };
    }
    if (level === 'section') {
      const t = next[path.vertical]?.[path.org]?.[path.batch]?.[path.term];
      if (t) delete t[name];
      return { tree: next, ok: true };
    }
    if (level === 'subject') {
      const s =
        next[path.vertical]?.[path.org]?.[path.batch]?.[path.term]?.[
          path.section
        ];
      if (s) delete s[name];
      return { tree: next, ok: true };
    }
  } catch (e: any) {
    return { tree, ok: false, error: e?.message || 'Delete failed' };
  }

  return { tree: next, ok: true };
}

export function pathFromCrumbs(
  crumbs: string[],
  index: number
): { path: TreePath; level: TreeLevel } {
  const path = { ...EMPTY_PATH };
  const levels: TreeLevel[] = [
    'vertical',
    'org',
    'batch',
    'term',
    'section',
    'subject',
  ];
  for (let i = 0; i <= index && i < crumbs.length; i++) {
    const key = levels[i];
    (path as any)[key] = crumbs[i];
  }
  const nextLevel = levels[Math.min(index + 1, levels.length - 1)];
  return { path, level: nextLevel };
}

export function formatHierarchyPath(path: Partial<TreePath>): string {
  return [
    path.vertical,
    path.org,
    path.batch,
    path.term,
    path.section,
    path.subject,
  ]
    .filter(Boolean)
    .join(' › ');
}