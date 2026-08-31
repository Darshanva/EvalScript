import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useApp } from '../../context/AppContext';

export default function ExamStructurePage() {
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [tree, setTree] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<TreeLevel>('vertical');
  const [path, setPath] = useState<TreePath>({ ...EMPTY_PATH });
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadExamTree().then((t) => {
      setTree(t);
      setLoading(false);
    });
  }, []);

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
      setPath((p) => ({ ...p, org: name }));
      setLevel('batch');
    } else if (level === 'batch') {
      setPath((p) => ({ ...p, batch: name }));
      setLevel('term');
    } else if (level === 'term') {
      setPath((p) => ({ ...p, term: name }));
      setLevel('section');
    } else if (level === 'section') {
      setPath((p) => ({ ...p, section: name }));
      setLevel('subject');
    }
  }

  function jumpCrumb(index: number) {
    // index -1 = root
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
    setAdding(false);
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
    } else navigate('/admin');
  }

async function handleAdd() {
  const name = newName.trim();
  if (!name) {
    showToast('Enter a name', 'error');
    return;
  }

  const result = addTreeItem(tree, level, path, name);
  if (!result.ok) {
    showToast(result.error || 'Could not add', 'error');
    return;
  }

  try {
    setTree(result.tree);
    await saveExamTree(result.tree);
    setNewName('');
    setAdding(false);
    showToast(`Added “${name}” — visible to Faculty`, 'success');
  } catch (e: any) {
    showToast(e.message || 'Cloud save failed', 'error');
  }
}

async function handleDelete(name: string) {
  if (!window.confirm(`Delete “${name}”?`)) return;
  const result = deleteTreeItem(tree, level, path, name);
  if (!result.ok) {
    showToast(result.error || 'Delete failed', 'error');
    return;
  }
  try {
    setTree(result.tree);
    await saveExamTree(result.tree);
    showToast('Deleted', 'success');
  } catch (e: any) {
    showToast(e.message || 'Cloud save failed', 'error');
  }
}

  if (loading) {
    return (
      <PageContainer>
        <p className="text-sm text-slate-500">Loading structure…</p>
      </PageContainer>
    );
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
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-slate-300">›</span>
            <button
              type="button"
              className="font-medium text-navy-700 hover:underline"
              onClick={() => jumpCrumb(i)}
            >
              {c}
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goBack}>
            ← Back
          </Button>
          <Badge variant="muted">{LEVEL_TITLES[level]}</Badge>
          <Badge variant="navy">{items.length}</Badge>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setAdding(true);
            setNewName('');
          }}
        >
          + Add {LEVEL_TITLES[level]}
        </Button>
      </div>

      {adding && (
        <Card className="mb-4 flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <Input
              label="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`New ${LEVEL_TITLES[level]}…`}
            />
          </div>
          <Button onClick={handleAdd}>Add</Button>
          <Button variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500 text-center py-10">
            Empty. Click + Add.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((name) => (
            <div
              key={name}
              className="p-4 rounded-xl border-2 border-slate-200 bg-white flex flex-col gap-3"
            >
              <button
                type="button"
                className="text-left flex-1"
                onClick={() => level !== 'subject' && openItem(name)}
                disabled={level === 'subject'}
              >
                <p className="font-semibold text-slate-900">{name}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {level === 'subject' ? 'Leaf' : 'Open →'}
                </p>
              </button>
              <div className="flex gap-2">
                {level !== 'subject' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => openItem(name)}
                  >
                    Open
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
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