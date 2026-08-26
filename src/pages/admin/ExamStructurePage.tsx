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
  type TreeLevel,
  type TreePath,
} from '../../lib/exam-tree';
import { useApp } from '../../context/AppContext';

export default function ExamStructurePage() {
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [tree, setTree] = useState(loadExamTree);
  const [level, setLevel] = useState<TreeLevel>('vertical');
  const [path, setPath] = useState<TreePath>({ ...EMPTY_PATH });
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    saveExamTree(tree);
  }, [tree]);

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

  function goBack() {
    setAdding(false);
    setNewName('');
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

  function handleAdd() {
    const name = newName.trim();
    if (!name) {
      showToast('Enter a name', 'error');
      return;
    }
    setTree((prev) => addTreeItem(prev, level, path, name));
    setNewName('');
    setAdding(false);
    showToast(`Added "${name}"`, 'success');
  }

  function handleDelete(name: string) {
    const ok = window.confirm(
      `Delete "${name}" and everything under it? This cannot be undone.`
    );
    if (!ok) return;
    setTree((prev) => deleteTreeItem(prev, level, path, name));
    showToast(`Deleted "${name}"`, 'success');
  }

  return (
    <PageContainer>
      <PageHeader
        title="Exam Structure"
        subtitle="Manage Vertical → Org → Batch → Term → Section → Subject. Same tree faculty uses when creating exams."
        breadcrumb="Admin"
        showBack
        backTo="/admin"
      />

      {crumbs.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-500">
          <button
            type="button"
            className="text-navy-600 hover:underline"
            onClick={() => {
              setPath({ ...EMPTY_PATH });
              setLevel('vertical');
            }}
          >
            Root
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-slate-300">›</span>
              <span className="font-medium text-slate-700">{c}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goBack}>
            ← Back
          </Button>
          <Badge variant="muted">{LEVEL_TITLES[level]}</Badge>
          <Badge variant="navy">{items.length} items</Badge>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
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
            Empty. Click <strong>+ Add {LEVEL_TITLES[level]}</strong>.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((name) => (
            <div
              key={name}
              className="p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-navy-300 transition-all flex flex-col gap-3"
            >
              <button
                type="button"
                className="text-left flex-1"
                onClick={() => {
                  if (level !== 'subject') openItem(name);
                }}
                disabled={level === 'subject'}
              >
                <p className="font-semibold text-slate-900">{name}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {level === 'subject' ? 'Subject leaf' : 'Open →'}
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

      <Card className="mt-6 bg-slate-50 border-slate-200">
        <p className="text-xs text-slate-500">
          This structure is stored in the browser (localStorage) and shared with
          Faculty → Create Exam hierarchy. Faculty sees the same folders when
          creating exams.
        </p>
      </Card>
    </PageContainer>
  );
}