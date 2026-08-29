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
  'select vertical/client': {
    'HDFC Bank': {
      Batch1: {
        'Term 1': {
          'Section 1': {},
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

/** Find actual key in object ignoring case/spaces */
function findKey(obj: Record<string, any> | null | undefined, want: string): string | null {
  if (!obj || !want) return null;
  if (want in obj) return want;
  const w = want.trim().toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.trim().toLowerCase() === w) return k;
  }
  return null;
}

/**
 * Walk tree following path segments for levels before `level`.
 * Returns { parent, keyUsed } where parent is the object that should hold children at `level`.
 */
function getParentNode(
  tree: Record<string, any>,
  level: TreeLevel,
  path: TreePath
): { parent: Record<string, any> | null; resolved: TreePath } {
  const resolved: TreePath = { ...EMPTY_PATH };
  let node: any = tree;

  const chain: { level: TreeLevel; pathKey: keyof TreePath }[] = [
    { level: 'vertical', pathKey: 'vertical' },
    { level: 'org', pathKey: 'org' },
    { level: 'batch', pathKey: 'batch' },
    { level: 'term', pathKey: 'term' },
    { level: 'section', pathKey: 'section' },
    { level: 'subject', pathKey: 'subject' },
  ];

  const targetIdx = chain.findIndex((c) => c.level === level);
  if (targetIdx < 0) return { parent: null, resolved };

  // For vertical level, parent is the root tree itself
  if (level === 'vertical') {
    return { parent: tree, resolved };
  }

  // Walk all segments BEFORE this level
  for (let i = 0; i < targetIdx; i++) {
    const { pathKey } = chain[i];
    const want = path[pathKey];
    if (!want || !node || typeof node !== 'object') {
      return { parent: null, resolved };
    }
    const actual = findKey(node, want);
    if (!actual) return { parent: null, resolved };
    resolved[pathKey] = actual;
    node = node[actual];
  }

  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return { parent: null, resolved };
  }
  return { parent: node, resolved };
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
    console.error('saveExamTree', error);
    throw new Error(error.message || 'Cloud save failed — check app_settings RLS');
  }
}

export function getItemsAtLevel(
  tree: Record<string, any>,
  level: TreeLevel,
  path: TreePath
): string[] {
  if (!tree) return [];
  const { parent } = getParentNode(tree, level, path);
  if (!parent) return [];
  return Object.keys(parent);
}

export function addTreeItem(
  tree: Record<string, any>,
  level: TreeLevel,
  path: TreePath,
  name: string
): { tree: Record<string, any>; ok: boolean; error?: string } {
  const n = (name || '').trim();
  if (!n) return { tree, ok: false, error: 'Name required' };

  const next = clone(tree);
  const { parent } = getParentNode(next, level, path);

  if (!parent) {
    return {
      tree,
      ok: false,
      error: `Path incomplete for ${level}. Open the parent folder again.`,
    };
  }

  // already exists (case-insensitive)
  const existing = findKey(parent, n);
  if (existing) {
    return { tree: next, ok: true }; // treat as success
  }

  parent[n] = {};
  return { tree: next, ok: true };
}

export function deleteTreeItem(
  tree: Record<string, any>,
  level: TreeLevel,
  path: TreePath,
  name: string
): { tree: Record<string, any>; ok: boolean; error?: string } {
  const next = clone(tree);
  const { parent } = getParentNode(next, level, path);
  if (!parent) return { tree, ok: false, error: 'Path not found' };

  const actual = findKey(parent, name);
  if (!actual) return { tree, ok: false, error: 'Item not found' };
  delete parent[actual];
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
    (path as any)[levels[i]] = crumbs[i];
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