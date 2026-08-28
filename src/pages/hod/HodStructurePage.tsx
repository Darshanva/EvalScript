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
import { findVerticalForOrg } from '../../lib/hod-scope';

export default function HodStructurePage() {
  const { state, showToast } = useApp();
  const navigate = useNavigate();
  const orgName = state.currentUser?.client || state.currentUser?.organisation || '';

  const [tree, setTree] = useState<Record<string, any>>({});
  const [vertical, setVertical] = useState('');
  const [level, setLevel] = useState<TreeLevel>('batch');
  const [path, setPath] = useState<TreePath>({ ...EMPTY_PATH });
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = await loadExamTree();
    const v = findVerticalForOrg(t, orgName) || '';
    setTree(t);
    setVertical(v);
    setPath((prev) => ({
      ...EMPTY_PATH,
      vertical: v,
      org: orgName,
      batch: prev.org === orgName ? prev.batch : '',
      term: prev.org === orgName ? prev.term : '',
      section: prev.org === orgName ? prev.section : '',
      subject: prev.org === orgName ? prev.subject : '',
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
    org: orgName,
  };

  const items =
    vertical && orgName
      ? getItemsAtLevel(tree, level, workingPath)
      : [];

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
    if (!name || !vertical || !orgName) {
      showToast('Organisation not linked in structure', 'error');
      return;
    }
    try {
      const next = addTreeItem(tree, level, workingPath, name);
      setTree(next);
      await saveExamTree(next);
      setNewName('');
      setAdding(false);
      showToast(`Added “${name}” — visible to Admin & Faculty`, 'success');
      await refresh();
    } catch (e: any) {
      showToast(e.message || 'Add failed', 'error');
    }
  }

  async function handleDelete(name: string) {
    if (!window.confirm(`Delete “${name}”? This updates Admin/Faculty tree too.`)) {
      return;
    }
    try {
      const next = deleteTreeItem(tree, level, workingPath, name);
      setTree(next);
      await saveExamTree(next);
      showToast('Deleted', 'success');
      await refresh();
    } catch (e: any) {
      showToast(e.message || 'Delete failed', 'error');
    }
  }

  if (!orgName) {
    return (
      <PageContainer>
        <p className="text-sm text-red-600">
          HOD profile has no organisation. Re-register or set organisation on profile.
        </p>
      </PageContainer>
    );
  }

  if (!loading && !vertical) {
    return (
      <PageContainer>
        <PageHeader title="Structure" subtitle={orgName} breadcrumb="HOD" showBack backTo="/hod" />
        <Card>
          <p className="text-sm text-amber-700">
            Organisation <strong>{orgName}</strong> not found under any Vertical in
            Admin Exam Structure. Admin must create Vertical → <strong>{orgName}</strong>.
          </p>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Structure"
        subtitle={`${orgName} · Batch → Term → Section → Subject`}
        breadcrumb="HOD"
        showBack
        backTo="/hod"
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={goBack}>
          ← Back
        </Button>
        <Badge variant="navy">{LEVEL_TITLES[level] || level}</Badge>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          + Add
        </Button>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        {vertical} › {orgName}
        {path.batch ? ` › ${path.batch}` : ''}
        {path.term ? ` › ${path.term}` : ''}
        {path.section ? ` › ${path.section}` : ''}
      </p>

      {adding && (
        <Card className="mb-4 flex flex-wrap gap-2 items-end">
          <Input
            label={`New ${LEVEL_TITLES[level] || level}`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
          />
          <Button onClick={handleAdd}>Add</Button>
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
            Empty. Click + Add to create a {LEVEL_TITLES[level] || level}.
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((name) => (
            <div
              key={name}
              className="p-4 border-2 border-slate-200 rounded-xl bg-white hover:border-navy-300"
            >
              <p className="font-semibold text-slate-900">{name}</p>
              <div className="flex gap-2 mt-3">
                {level !== 'subject' && (
                  <Button size="sm" variant="secondary" onClick={() => openItem(name)}>
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