import {
  loadExamTree,
  EMPTY_PATH,
  type TreePath,
} from './exam-tree';

/** Find vertical key that contains this organisation name */
export function findVerticalForOrg(
  tree: Record<string, any>,
  orgName: string
): string | null {
  if (!orgName || !tree) return null;
  const target = orgName.trim().toLowerCase();

  for (const vertical of Object.keys(tree)) {
    const node = tree[vertical];
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;

    for (const org of Object.keys(node)) {
      if (org.trim().toLowerCase() === target) {
        return vertical;
      }
    }
  }
  return null;
}

/** Exact org key as stored in tree (preserve casing) */
export function resolveOrgKey(
  tree: Record<string, any>,
  orgName: string
): string | null {
  if (!orgName || !tree) return null;
  const target = orgName.trim().toLowerCase();

  for (const vertical of Object.keys(tree)) {
    const node = tree[vertical];
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;

    for (const org of Object.keys(node)) {
      if (org.trim().toLowerCase() === target) {
        return org;
      }
    }
  }
  return null;
}

/** Base path for HOD: vertical + organisation fixed */
export function hodBasePath(
  tree: Record<string, any>,
  orgName: string
): TreePath {
  const vertical = findVerticalForOrg(tree, orgName) || '';
  const org = resolveOrgKey(tree, orgName) || orgName || '';
  return {
    ...EMPTY_PATH,
    vertical,
    org,
  };
}

export async function loadTreeAndScope(orgName: string): Promise<{
  tree: Record<string, any>;
  vertical: string | null;
  org: string;
  orgKey: string | null;
}> {
  const tree = await loadExamTree();
  const vertical = findVerticalForOrg(tree, orgName);
  const orgKey = resolveOrgKey(tree, orgName);
  return {
    tree,
    vertical,
    org: orgName,
    orgKey,
  };
}

/** Org node: tree[vertical][org] → batches */
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

export function listBatchesForOrg(
  tree: Record<string, any>,
  orgName: string
): string[] {
  return Object.keys(getOrgNode(tree, orgName));
}

export function listTermsForOrg(
  tree: Record<string, any>,
  orgName: string,
  batch: string
): string[] {
  const orgNode = getOrgNode(tree, orgName);
  const batchNode = orgNode[batch];
  if (!batchNode || typeof batchNode !== 'object') return [];
  return Object.keys(batchNode);
}

export function listSectionsForOrg(
  tree: Record<string, any>,
  orgName: string,
  batch: string,
  term: string
): string[] {
  const orgNode = getOrgNode(tree, orgName);
  const termNode = orgNode[batch]?.[term];
  if (!termNode || typeof termNode !== 'object') return [];
  return Object.keys(termNode);
}

/** All section names under organisation */
export function listAllSectionsForOrg(
  tree: Record<string, any>,
  orgName: string
): string[] {
  const set = new Set<string>();
  const orgNode = getOrgNode(tree, orgName);
  for (const b of Object.keys(orgNode)) {
    const batchNode = orgNode[b];
    if (!batchNode || typeof batchNode !== 'object') continue;
    for (const t of Object.keys(batchNode)) {
      const termNode = batchNode[t];
      if (!termNode || typeof termNode !== 'object') continue;
      for (const s of Object.keys(termNode)) set.add(s);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}