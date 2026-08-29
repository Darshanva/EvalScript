import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Button, Card, Input, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import {
  loadExamTree,
  saveExamTree,
  getItemsAtLevel,
  addTreeItem,
  deleteTreeItem,
  EMPTY_PATH,
  LEVEL_TITLES,
  type TreeLevel,
  type TreePath,
} from '../../lib/exam-tree';
import { findVerticalForOrg, resolveOrgKey } from '../../lib/hod-scope';

export default function HodStructurePage() {
  const { state, showToast } = useApp();
  const navigate = useNavigate();
  const orgName = (
    state.currentUser?.organisation ||
    state.currentUser?.client ||
    ''
  ).trim();

  const [tree, setTree] = useState<Record<string, any>>({});
  const [vertical, setVertical] = useState('');
  const [orgKey, setOrgKey] = useState('');
  const [level, setLevel] = useState<TreeLevel>('batch');
  const [path, setPath] = useState<TreePath>({ ...EMPTY_PATH });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const t = await loadExamTree();
    const v = findVerticalForOrg(t, orgName) || '';
    const o = resolveOrgKey(t, orgName) || '';
    setTree(t);
    setVertical(v);
    setOrgKey(o);
    setPath((prev) => ({
      ...EMPTY_PATH,
      vertical: v,
      org: o,
      batch: prev.vertical === v && prev.org === o ? prev.batch : '',
      term: prev.vertical === v && prev.org === o ? prev.term : '',
      section: prev.vertical === v && prev.org === o ? prev.section : '',
    }));
    setLoading(false);
  }, [orgName]);

  useEffect(() => {
    refresh();
    const onUpd = () => refresh();
    window.addEventListener('exam-tree-updated', onUpd);
    window.addEventListener('storage', onUpd);
    return () => {
      window.removeEventListener('exam-tree-updated', onUpd);
      window.removeEventListener('storage', onUpd);
    };
  }, [refresh]);

  const workingPath: TreePath = {
    ...path,
    vertical,
    org: orgKey,
  };

  const items =
    vertical && orgKey ? getItemsAtLevel(tree, level, workingPath) : [];

  function openItem(name: string) {
    if (level === 'batch') {
      setPath((p) => ({ ...p, batch: name, term: '', section: '', subject: '' }));
      setLevel('term');
    } else if (level === 'term') {
      setPath((p) => ({ ...p, term: name, section: '', subject: '' }));
      setLevel('section');
    } else if (level === 'section') {
      setPath((p) => ({ ...p, section: name, subject: '' }));
      setLevel('subject');
    }
  }

  function goBack() {
    if (level === 'subject') {
      setPath((p) => ({ ...p, section: '' }));
      setLevel('section');
    } else if (level === 'section') {
      setPath((p) => ({ ...p, term: '' }));
      setLevel('term');
    } else if (level === 'term') {
      setPath((p) => ({ ...p, batch: '' }));
      setLevel('batch');
    } else {
      navigate('/hod');
    }
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) {
      showToast('Enter a name', 'error');
      return;
    }
    if (!vertical || !orgKey) {
      showToast(
        'Admin must create your organisation under a Vertical first',
        'error'
      );
      return;
    }

    const result = addTreeItem(tree, level, workingPath, name);
    if (!result.ok) {
      showToast(result.error || 'Add failed', 'error');
      return;
    }

    setSaving(true);
    try {
      setTree(result.tree);
      await saveExamTree(result.tree);
      setNewName('');
      setAdding(false);
      showToast(`Added “${name}” — Admin & Faculty updated`, 'success');
      await refresh();
    } catch (e: any) {
      showToast(e?.message || 'Cloud save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(name: string) {
    if (!window.confirm(`Delete “${name}”?`)) return;
    const result = deleteTreeItem(tree, level, workingPath, name);
    if (!result.ok) {
      showToast(result.error || 'Delete failed', 'error');
      return;
    }
    try {
      setTree(result.tree);
      await saveExamTree(result.tree);
      showToast('Deleted — Admin & Faculty updated', 'success');
      await refresh();
    } catch (e: any) {
      showToast(e?.message || 'Save failed', 'error');
    }
  }

  if (!orgName) {
    return (
      <PageContainer>
        <PageHeader title="Structure" breadcrumb="HOD" showBack backTo="/hod" />
        <Card>
          <p className="text-sm text-red-600">
            HOD profile has no organisation. Register again and select Organisation.
          </p>
        </Card>
      </PageContainer>
    );
  }

  if (!loading && (!vertical || !orgKey)) {
    return (
      <PageContainer>
        <PageHeader
          title="Structure"
          subtitle={orgName}
          breadcrumb="HOD"
          showBack
          backTo="/hod"
        />
        <Card>
          <p className="text-sm text-amber-800">
            Organisation <strong>{orgName}</strong> is not in Admin Exam Structure
            yet.
          </p>
          <p className="text-xs text-slate-600 mt-2">
            Admin must open <strong>Exam Structure</strong> → create/select a
            Vertical → add organisation named exactly <strong>{orgName}</strong>{' '}
            (e.g. HDFC Bank) → then Batches / Terms / Sections.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            After Admin saves, refresh this page. You will only see that org’s
            folders — no separate tree.
          </p>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Structure"
        subtitle={`${orgName} · Admin tree · Batch → Term → Section → Subject`}
        breadcrumb="HOD"
        showBack
        backTo="/hod"
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={goBack}>
          ← Back
        </Button>
        <Badge variant="navy">{LEVEL_TITLES[level]}</Badge>
        <Badge variant="muted">{items.length}</Badge>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          + Add {LEVEL_TITLES[level]}
        </Button>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        {vertical} › {orgKey}
        {path.batch ? ` › ${path.batch}` : ''}
        {path.term ? ` › ${path.term}` : ''}
        {path.section ? ` › ${path.section}` : ''}
      </p>

      {adding && (
        <Card className="mb-4 flex flex-wrap gap-2 items-end">
          <Input
            label={`New ${LEVEL_TITLES[level]}`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button loading={saving} onClick={handleAdd}>
            Add
          </Button>
          <Button variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400 text-center py-8">
            No {LEVEL_TITLES[level].toLowerCase()}s yet. Admin may add them, or
            click + Add here.
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((name) => (
            <div
              key={name}
              className="p-4 border-2 border-slate-200 rounded-xl bg-white"
            >
              <p className="font-semibold text-slate-900">{name}</p>
              <div className="flex gap-2 mt-3">
                {level !== 'subject' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openItem(name)}
                  >
                    Open
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => handleDelete(name)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}