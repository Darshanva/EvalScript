import { supabase } from './supabase';

const STORAGE_KEY = 'evalscript_exam_tree';
const CLOUD_ID = 'default';

export const DEFAULT_EXAM_TREE: Record<string, any> = {
  'Select Vertical / Client': {
    'HDFC long term': {
      'Batch 1': {
        'Term 1': { 'Section A': ['Subject 1'], 'Section B': ['Subject 1'] },
        'Term 2': {
          'Section A': ['Subject Name'],
          'Section B': ['Subject Name'],
          'Section C': ['Subject Name'],
        },
        'Term 3': { 'Section A': ['Subject 1'] },
      },
      'Batch 2': {
        'Term 1': { 'Section A': ['Subject 1'] },
        'Term 2': {
          'Section A': ['Subject Name'],
          'Section B': ['Subject Name'],
          'Section C': ['Subject Name'],
        },
        'Term 3': { 'Section A': ['Subject 1'] },
      },
      'Batch 3': {
        'Term 1': { 'Section A': ['Subject 1'] },
      },
    },
    'ICICI MT': {
      'Batch 1': { 'Term 1': { 'Section A': ['Subject 1'] } },
    },
    'Federal Bank': {
      'Batch 1': { 'Term 1': { 'Section A': ['Subject 1'] } },
    },
    Kotak: {
      'Batch 1': { 'Term 1': { 'Section A': ['Subject 1'] } },
    },
  },
};

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

export function loadExamTreeLocal(): Record<string, any> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return structuredClone(DEFAULT_EXAM_TREE);
}

export function saveExamTreeLocal(tree: Record<string, any>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  // notify other tabs / faculty page
  window.dispatchEvent(new Event('exam-tree-updated'));
}

/** Cloud + local. Admin save → faculty same browser + cloud. */
export async function loadExamTree(): Promise<Record<string, any>> {
  try {
    const { data, error } = await supabase
      .from('exam_structure')
      .select('tree')
      .eq('id', CLOUD_ID)
      .maybeSingle();

    if (!error && data?.tree) {
      saveExamTreeLocal(data.tree);
      return data.tree;
    }
  } catch (e) {
    console.warn('exam_structure cloud load failed', e);
  }
  return loadExamTreeLocal();
}

export async function saveExamTree(tree: Record<string, any>) {
  saveExamTreeLocal(tree);
  try {
    await supabase.from('exam_structure').upsert({
      id: CLOUD_ID,
      tree,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('exam_structure cloud save failed', e);
  }
}

export function getItemsAtLevel(
  tree: Record<string, any>,
  level: TreeLevel,
  path: TreePath
): string[] {
  try {
    if (level === 'vertical') return Object.keys(tree);
    if (level === 'org') return Object.keys(tree[path.vertical] || {});
    if (level === 'batch')
      return Object.keys(tree[path.vertical]?.[path.org] || {});
    if (level === 'term')
      return Object.keys(tree[path.vertical]?.[path.org]?.[path.batch] || {});
    if (level === 'section')
      return Object.keys(
        tree[path.vertical]?.[path.org]?.[path.batch]?.[path.term] || {}
      );
    if (level === 'subject') {
      const node =
        tree[path.vertical]?.[path.org]?.[path.batch]?.[path.term]?.[
          path.section
        ];
      return Array.isArray(node) ? node : Object.keys(node || {});
    }
  } catch {
    return [];
  }
  return [];
}

export function addTreeItem(
  tree: Record<string, any>,
  level: TreeLevel,
  path: TreePath,
  name: string
): Record<string, any> {
  const next = structuredClone(tree);
  if (level === 'vertical') {
    if (!next[name]) next[name] = {};
  } else if (level === 'org') {
    if (!next[path.vertical][name]) next[path.vertical][name] = {};
  } else if (level === 'batch') {
    if (!next[path.vertical][path.org][name])
      next[path.vertical][path.org][name] = {};
  } else if (level === 'term') {
    if (!next[path.vertical][path.org][path.batch][name])
      next[path.vertical][path.org][path.batch][name] = {};
  } else if (level === 'section') {
    if (!next[path.vertical][path.org][path.batch][path.term][name])
      next[path.vertical][path.org][path.batch][path.term][name] = [
        'Subject 1',
      ];
  } else if (level === 'subject') {
    const arr =
      next[path.vertical][path.org][path.batch][path.term][path.section];
    if (Array.isArray(arr) && !arr.includes(name)) arr.push(name);
  }
  return next;
}

export function deleteTreeItem(
  tree: Record<string, any>,
  level: TreeLevel,
  path: TreePath,
  name: string
): Record<string, any> {
  const next = structuredClone(tree);
  if (level === 'vertical') delete next[name];
  else if (level === 'org') delete next[path.vertical][name];
  else if (level === 'batch') delete next[path.vertical][path.org][name];
  else if (level === 'term')
    delete next[path.vertical][path.org][path.batch][name];
  else if (level === 'section')
    delete next[path.vertical][path.org][path.batch][path.term][name];
  else if (level === 'subject') {
    const arr =
      next[path.vertical][path.org][path.batch][path.term][path.section];
    if (Array.isArray(arr)) {
      next[path.vertical][path.org][path.batch][path.term][path.section] =
        arr.filter((x: string) => x !== name);
    }
  }
  return next;
}

/** Jump breadcrumb to index (0 = vertical root item level after pick) */
export function pathFromCrumbs(
  parts: string[],
  upto: number
): { path: TreePath; level: TreeLevel } {
  const p: TreePath = { ...EMPTY_PATH };
  if (upto >= 0 && parts[0]) p.vertical = parts[0];
  if (upto >= 1 && parts[1]) p.org = parts[1];
  if (upto >= 2 && parts[2]) p.batch = parts[2];
  if (upto >= 3 && parts[3]) p.term = parts[3];
  if (upto >= 4 && parts[4]) p.section = parts[4];
  if (upto >= 5 && parts[5]) p.subject = parts[5];

  let level: TreeLevel = 'vertical';
  if (upto < 0) level = 'vertical';
  else if (upto === 0) level = 'org';
  else if (upto === 1) level = 'batch';
  else if (upto === 2) level = 'term';
  else if (upto === 3) level = 'section';
  else if (upto === 4) level = 'subject';
  else level = 'subject';

  return { path: p, level };
}