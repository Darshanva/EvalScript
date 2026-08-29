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
          'Section A': {},
          'Section B': {},
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

export async function loadExamTree(): Promise<Record<string, any>> {
  // 1) Supabase shared
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
        return tree;
      }
    }
  } catch (e) {
    console.warn('loadExamTree cloud', e);
  }

  // 2) Local cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }

  return clone(DEFAULT_EXAM_TREE);
}

export async function saveExamTree(tree: Record<string, any>): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  notify();
  try {
    const { error } = await supabase.from('app_settings').upsert({
      key: SETTINGS_KEY,
      value: tree,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error('saveExamTree cloud', error);
  } catch (e) {
    console.warn('saveExamTree cloud failed', e);
  }
}

export function getItemsAtLevel(
  tree: Record<string, any>,
  level: TreeLevel,
  path: TreePath
): string[] {
  if (!tree) return [];
  if (level === 'vertical') return Object.keys(tree);

  let node: any = tree;
  if (level === 'org') {
    node = tree[path.vertical];
  } else if (level === 'batch') {
    node = tree[path.vertical]?.[path.org];
  } else if (level === 'term') {
    node = tree[path.vertical]?.[path.org]?.[path.batch];
  } else if (level === 'section') {
    node = tree[path.vertical]?.[path.org]?.[path.batch]?.[path.term];
  } else if (level === 'subject') {
    node =
      tree[path.vertical]?.[path.org]?.[path.batch]?.[path.term]?.[
        path.section
      ];
  }
  if (!node || typeof node !== 'object' || Array.isArray(node)) return [];
  return Object.keys(node);
}

export function addTreeItem(
  tree: Record<string, any>,
  level: TreeLevel,
  path: TreePath,
  name: string
): Record<string, any> {
  const next = clone(tree);
  const n = name.trim();
  if (!n) return next;

  if (level === 'vertical') {
    if (!next[n]) next[n] = {};
    return next;
  }
  if (level === 'org') {
    if (!next[path.vertical]) next[path.vertical] = {};
    if (!next[path.vertical][n]) next[path.vertical][n] = {};
    return next;
  }
  if (level === 'batch') {
    const org = next[path.vertical]?.[path.org];
    if (!org) return next;
    if (!org[n]) org[n] = {};
    return next;
  }
  if (level === 'term') {
    const batch = next[path.vertical]?.[path.org]?.[path.batch];
    if (!batch) return next;
    if (!batch[n]) batch[n] = {};
    return next;
  }
  if (level === 'section') {
    const term = next[path.vertical]?.[path.org]?.[path.batch]?.[path.term];
    if (!term) return next;
    if (!term[n]) term[n] = {};
    return next;
  }
  if (level === 'subject') {
    const sec =
      next[path.vertical]?.[path.org]?.[path.batch]?.[path.term]?.[
        path.section
      ];
    if (!sec) return next;
    if (!sec[n]) sec[n] = {};
    return next;
  }
  return next;
}

export function deleteTreeItem(
  tree: Record<string, any>,
  level: TreeLevel,
  path: TreePath,
  name: string
): Record<string, any> {
  const next = clone(tree);
  if (level === 'vertical') {
    delete next[name];
    return next;
  }
  if (level === 'org') {
    delete next[path.vertical]?.[name];
    return next;
  }
  if (level === 'batch') {
    delete next[path.vertical]?.[path.org]?.[name];
    return next;
  }
  if (level === 'term') {
    delete next[path.vertical]?.[path.org]?.[path.batch]?.[name];
    return next;
  }
  if (level === 'section') {
    delete next[path.vertical]?.[path.org]?.[path.batch]?.[path.term]?.[name];
    return next;
  }
  if (level === 'subject') {
    delete next[path.vertical]?.[path.org]?.[path.batch]?.[path.term]?.[
      path.section
    ]?.[name];
    return next;
  }
  return next;
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
    if (key === 'vertical') path.vertical = crumbs[i];
    if (key === 'org') path.org = crumbs[i];
    if (key === 'batch') path.batch = crumbs[i];
    if (key === 'term') path.term = crumbs[i];
    if (key === 'section') path.section = crumbs[i];
    if (key === 'subject') path.subject = crumbs[i];
  }
  const nextLevel = levels[Math.min(index + 1, levels.length - 1)];
  return { path, level: nextLevel };
}

/** Canonical path string for exams / publish / student match */
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