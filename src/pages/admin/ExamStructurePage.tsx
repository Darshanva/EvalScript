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
  pathFromCrumbs,
  type TreeLevel,
  type TreePath,
} from '../../lib/exam-tree';

export default function ExamStructurePage() {
  const { showToast } = useApp();
  const navigate = useNavigate();

  const [tree, setTree] = useState<Record<string, any>>({});
  const [level, setLevel] = useState<TreeLevel>('vertical');
  const [path, setPath] = useState<TreePath>({ ...EMPTY_PATH });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const t = await loadExamTree();
    setTree(t && typeof t === 'object' ? t : {});
    setLoading(false);
  }, []);

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

  const items = getItemsAtLevel(tree, level, path);

  const crumbs = [
    path.vertical,
    path.org,
    path.batch,
    path.term,
    path.section,
  ].filter(Boolean);

  function openItem(name: string) {
    if (level === 'vertical') {
      setPath({ ...EMPTY_PATH, vertical: name });
      setLevel('org');
    } else if (level === 'org') {
      setPath((p) => ({ ...p, org: name, batch: '', term: '', section: '', subject: '' }));
      setLevel('batch');
    } else if (level === 'batch') {
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

  function jumpCrumb(index: number) {
    if (index < 0) {
      setPath({ ...EMPTY_PATH });
      setLevel('vertical');
      return;
    }
    const { path: p, level: lv } = pathFromCrumbs(crumbs, index);
    setPath(p);
    setLevel(lv);
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
    } else if (level === 'batch') {
      setPath((p) => ({ ...p, org: '' }));
      setLevel('org');
    } else if (level === 'org') {
      setPath({ ...EMPTY_PATH });
      setLevel('vertical');
    } else {
      navigate('/admin');
    }
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) {
      showToast('Enter a name', 'error');
      return;
    }

    // Support both return shapes
    const raw: any = addTreeItem(tree, level, path, name);
    const ok = raw?.ok !== false;
    const nextTree = raw?.tree ?? raw;
    const errMsg = raw?.error;

    if (!ok || !nextTree || typeof nextTree !== 'object') {
      showToast(errMsg || 'Could not add — check you opened the right folder', 'error');
      return;
    }

    // Verify item actually present
    const check = getItemsAtLevel(nextTree, level, path);
    if (!check.includes(name)) {
      console.error('addTreeItem did not insert', { level, path, name, nextTree });
      showToast(
        'Add failed internally. Open Section again, then + Add Subject.',
        'error'
      );
      return;
    }

    setSaving(true);
    try {
      setTree(nextTree);
      await saveExamTree(nextTree);
      setNewName('');
      setAdding(false);
      showToast(`Added “${name}” — visible to Faculty`, 'success');
      // Re-load from cloud to confirm persist
      const confirmed = await loadExamTree();
      setTree(confirmed);
      const after = getItemsAtLevel(confirmed, level, path);
      if (!after.includes(name)) {
        showToast(
          'Saved locally but cloud may have failed — check app_settings table',
          'error'
        );
      }
    } catch (e: any) {
      showToast(e?.message || 'Cloud save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(name: string) {
    if (!window.confirm(`Delete “${name}”?`)) return;
    const raw: any = deleteTreeItem(tree, level, path, name);
    const nextTree = raw?.tree ?? raw;
    if (!nextTree) {
      showToast('Delete failed', 'error');
      return;
    }
    try {
      setTree(nextTree);
      await saveExamTree(nextTree);
      showToast('Deleted', 'success');
      const confirmed = await loadExamTree();
      setTree(confirmed);
    } catch (e: any) {
      showToast(e?.message || 'Delete save failed', 'error');
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Exam Structure"
        subtitle="Add / delete folders. Faculty only browses this tree when creating exams."
        breadcrumb="Admin"
        showBack
        backTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <button
          type="button"
          className="text-navy-600 hover:underline"
          onClick={() => jumpCrumb(-1)}
        >
          Root
        </button>
        {crumbs.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-slate-300">›</span>
            <button
              type="button"
              className="font-medium text-navy-700 hover:underline"
              onClick={() => jumpCrumb(i)}
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={goBack}>
          ← Back
        </Button>
        <Badge variant="navy">{LEVEL_TITLES[level]}</Badge>
        <Badge variant="muted">{items.length}</Badge>
        <div className="flex-1" />
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          + Add {LEVEL_TITLES[level]}
        </Button>
      </div>

      {adding && (
        <Card className="mb-4 flex flex-wrap gap-2 items-end">
          <Input
            label={`New ${LEVEL_TITLES[level]}`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Subject 1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
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
        <Card>
          <p className="text-sm text-slate-400 text-center py-10">Loading…</p>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400 text-center py-10">
            Empty. Click + Add {LEVEL_TITLES[level]}.
          </p>
          {level === 'subject' && !path.section && (
            <p className="text-xs text-amber-600 text-center pb-4">
              Open a Section first, then add subjects.
            </p>
          )}
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