import {
  loadExamTree,
  saveExamTree,
  EMPTY_PATH,
  type TreePath,
} from './exam-tree';

function norm(s: string) {
  return (s || '').trim().toLowerCase();
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function findVerticalForOrg(
  tree: Record<string, any>,
  orgName: string
): string | null {
  if (!orgName || !tree) return null;
  const target = norm(orgName);
  for (const vertical of Object.keys(tree)) {
    const node = tree[vertical];
    if (!node || typeof node !== 'object') continue;
    for (const org of Object.keys(node)) {
      if (norm(org) === target) return vertical;
    }
  }
  return null;
}

export function resolveOrgKey(
  tree: Record<string, any>,
  orgName: string
): string | null {
  if (!orgName || !tree) return null;
  const target = norm(orgName);
  for (const vertical of Object.keys(tree)) {
    const node = tree[vertical];
    if (!node || typeof node !== 'object') continue;
    for (const org of Object.keys(node)) {
      if (norm(org) === target) return org;
    }
  }
  return null;
}

/**
 * If HOD org missing in tree, create Vertical → Org.
 * Default vertical name: first existing OR "Clients"
 */
export function ensureOrgInTree(
  tree: Record<string, any>,
  orgName: string
): {
  tree: Record<string, any>;
  vertical: string;
  orgKey: string;
  created: boolean;
} {
  const existingV = findVerticalForOrg(tree, orgName);
  const existingO = resolveOrgKey(tree, orgName);
  if (existingV && existingO) {
    return {
      tree,
      vertical: existingV,
      orgKey: existingO,
      created: false,
    };
  }

  const next = clone(tree || {});
  const verticals = Object.keys(next);
  const vertical =
    verticals.find((v) => norm(v).includes('client') || norm(v).includes('vertical')) ||
    verticals[0] ||
    'Clients';

  if (!next[vertical] || typeof next[vertical] !== 'object') {
    next[vertical] = {};
  }
  // use exact orgName from HOD profile
  if (!resolveOrgKey({ [vertical]: next[vertical] }, orgName)) {
    next[vertical][orgName] = next[vertical][orgName] || {};
  }

  const orgKey = resolveOrgKey(next, orgName) || orgName;
  return { tree: next, vertical, orgKey, created: true };
}

export function hodBasePath(tree: Record<string, any>, orgName: string): TreePath {
  const { vertical, orgKey } = ensureOrgInTree(tree, orgName);
  return { ...EMPTY_PATH, vertical, org: orgKey };
}

export function getOrgNode(
  tree: Record<string, any>,
  orgName: string
): Record<string, any> {
  const vertical = findVerticalForOrg(tree, orgName);
  const orgKey = resolveOrgKey(tree, orgName);
  if (!vertical || !orgKey) return {};
  const node = tree[vertical]?.[orgKey];
  if (!node || typeof node !== 'object') return {};
  return node;
}

export async function loadTreeAndScope(orgName: string) {
  let tree = await loadExamTree();
  const ensured = ensureOrgInTree(tree, orgName);
  if (ensured.created) {
    tree = ensured.tree;
    try {
      await saveExamTree(tree);
    } catch (e) {
      console.warn('auto-create org save', e);
    }
  }
  return {
    tree,
    vertical: ensured.vertical,
    org: orgName,
    orgKey: ensured.orgKey,
  };
}