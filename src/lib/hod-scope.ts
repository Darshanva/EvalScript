import { loadExamTree, EMPTY_PATH, type TreePath } from './exam-tree';

function norm(s: string) {
  return (s || '').trim().toLowerCase();
}

/** Find vertical that contains this organisation (case-insensitive) */
export function findVerticalForOrg(
  tree: Record<string, any>,
  orgName: string
): string | null {
  if (!orgName || !tree) return null;
  const target = norm(orgName);

  for (const vertical of Object.keys(tree)) {
    const node = tree[vertical];
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
    for (const org of Object.keys(node)) {
      if (norm(org) === target) return vertical;
    }
  }
  return null;
}

/** Actual org key as stored in tree */
export function resolveOrgKey(
  tree: Record<string, any>,
  orgName: string
): string | null {
  if (!orgName || !tree) return null;
  const target = norm(orgName);

  for (const vertical of Object.keys(tree)) {
    const node = tree[vertical];
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
    for (const org of Object.keys(node)) {
      if (norm(org) === target) return org;
    }
  }
  return null;
}

export function hodBasePath(
  tree: Record<string, any>,
  orgName: string
): TreePath {
  const vertical = findVerticalForOrg(tree, orgName) || '';
  const org = resolveOrgKey(tree, orgName) || '';
  return { ...EMPTY_PATH, vertical, org };
}

/** Org node = batches live here */
export function getOrgNode(
  tree: Record<string, any>,
  orgName: string
): Record<string, any> {
  const vertical = findVerticalForOrg(tree, orgName);
  const orgKey = resolveOrgKey(tree, orgName);
  if (!vertical || !orgKey) return {};
  const node = tree[vertical]?.[orgKey];
  if (!node || typeof node !== 'object' || Array.isArray(node)) return {};
  return node;
}

export async function loadTreeAndScope(orgName: string) {
  const tree = await loadExamTree();
  const vertical = findVerticalForOrg(tree, orgName);
  const orgKey = resolveOrgKey(tree, orgName);
  return { tree, vertical, org: orgName, orgKey };
}