import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const STATUS = ['Bestätigt', 'Wahrscheinlich', 'Hinweis', 'Organisator', 'Offen'];
const STORE = 'r10a-local-edits-v4';

function imagePath(path) {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('http')) return path;
  return `/${path.replace(/^\//, '')}`;
}

function loadLocal(fallback) {
  try {
    const saved = localStorage.getItem(STORE);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [people, setPeople] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Alle');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    fetch('/data/classmates.json')
      .then(r => {
        if (!r.ok) throw new Error('Daten konnten nicht geladen werden.');
        return r.json();
      })
      .then(data => setPeople(loadLocal(data)))
      .catch(err => console.error(err));
  }, []);

  const visible = useMemo(() => people.filter(p => {
    const text = [p.name, p.role, p.today, p.location, p.network].join(' ').toLowerCase();
    return text.includes(query.toLowerCase()) && (filter === 'Alle' || p.status === filter);
  }), [people, query, filter]);

  const stats = useMemo(() => ({
    total: people.length,
    confirmed: people.filter(p => ['Bestätigt', 'Organisator'].includes(p.status)).length,
    hints: people.filter(p => ['Hinweis', 'Wahrscheinlich'].includes(p.status)).length,
    photos: people.filter(p => p.currentImg).length,
  }), [people]);

  function openPerson(person) {
    setSelected(person);
    setEditing(false);
  }

  function beginEdit(person) {
    setSelected(person);
    setDraft({ ...person });
    setEditing(true);
  }

  function saveDraft() {
    const next = people.map(p => p.nr === draft.nr ? draft : p);
    setPeople(next);
    localStorage.setItem(STORE, JSON.stringify(next));
    setSelected(draft);
    setEditing(false);
  }

  function uploadPhoto(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft(d => ({ ...d, currentImg: reader.result }));
    reader.readAsDataURL(file);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(people, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'classmates.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function importJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported)) throw new Error();
        setPeople(imported);
        localStorage.setItem(STORE, JSON.stringify(imported));
      } catch {
        alert('Die Datei ist keine gültige classmates.json.');
      }
    };
    reader.readAsText(file);
  }

  function resetLocal() {
    localStorage.removeItem(STORE);
    location.reload();
  }

  return <>
    <header className="topbar">
      <div className="brand">R10A <span>1994</span></div>
      <button className="admin-toggle" onClick={() => setAdminMode(v => !v)}>
        {adminMode ? 'Bearbeiten beenden' : '✎ Adminmodus'}
      </button>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">ALUMNI · HEINRICH-HEINE-SCHULE DREIEICH</div>
          <h1>Damals.<br/>Heute.<br/>Wiedersehen.</h1>
          <p>R10A, Abschlussjahrgang 1994 · Klassenlehrer Herr Laane</p>
        </div>
        <img src="/assets/class-photo-1994.png" alt="Klassenfoto R10A 1994" />
      </section>

      <section className="stats">
        <Stat number={stats.total} label="Personen erfasst" />
        <Stat number={stats.confirmed} label="bestätigt" />
        <Stat number={stats.hints} label="konkrete Hinweise" />
        <Stat number={stats.photos} label="aktuelle Bilder" />
      </section>

      {adminMode && <section className="admin-panel">
        <strong>Lokaler Adminmodus</strong>
        <span>Änderungen werden zunächst nur in diesem Browser gespeichert.</span>
        <button onClick={exportJson}>classmates.json exportieren</button>
        <label className="file-button">JSON importieren<input type="file" accept="application/json,.json" onChange={e => importJson(e.target.files[0])}/></label>
        <button onClick={resetLocal}>Lokale Änderungen löschen</button>
      </section>}

      <section className="section-head">
        <div><h2>Klassenübersicht</h2><p>Karte anklicken, um Details zu öffnen.</p></div>
        <div className="controls">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, Ort oder Hinweis suchen …" />
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option>Alle</option>{STATUS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </section>

      <section className="grid">
        {visible.map(person => <PersonCard key={person.nr} person={person} adminMode={adminMode} onOpen={openPerson} onEdit={beginEdit}/>) }
      </section>
    </main>

    {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}>
      <section className="modal" onMouseDown={e => e.stopPropagation()}>
        <button className="close" onClick={() => setSelected(null)}>×</button>
        {!editing ? <PersonDetails person={selected} adminMode={adminMode} onEdit={() => beginEdit(selected)} /> :
          <Editor draft={draft} setDraft={setDraft} onSave={saveDraft} onCancel={() => setEditing(false)} onPhoto={uploadPhoto}/>
        }
      </section>
    </div>}

    <footer>Aktuelle Bilder und persönliche Angaben sollten nur mit Zustimmung der Betroffenen öffentlich gezeigt werden.</footer>
  </>;
}

function Stat({ number, label }) {
  return <div className="stat"><strong>{number}</strong><span>{label}</span></div>;
}

function PersonCard({ person, adminMode, onOpen, onEdit }) {
  return <article className="card" onClick={() => onOpen(person)}>
    {adminMode && <button className="pencil" title="Bearbeiten" onClick={e => { e.stopPropagation(); onEdit(person); }}>✎</button>}
    <div className="photos">
      <Portrait src={imagePath(person.oldImg)} label={person.nr <= 24 ? '1994' : 'Ohne Foto'} />
      <div className="arrow">↔</div>
      <Portrait src={imagePath(person.currentImg)} label="Heute" />
    </div>
    <div className="card-body">
      <div className="meta"><b>#{String(person.nr).padStart(2, '0')}</b><span className={`badge status-${person.status}`}>{person.status}</span></div>
      <h3>{person.name}</h3>
      <p>{person.today || 'Weitere Informationen noch offen.'}</p>
      <div className="chips">{person.role && <span>{person.role}</span>}{person.location && <span>{person.location}</span>}</div>
    </div>
  </article>;
}

function Portrait({ src, label }) {
  return <div className="portrait">
    {src ? <img src={src} alt="" /> : <div className="placeholder">Noch kein Bild</div>}
    <span>{label}</span>
  </div>;
}

function PersonDetails({ person, adminMode, onEdit }) {
  return <div>
    <div className="detail-photos"><Portrait src={imagePath(person.oldImg)} label="1994"/><Portrait src={imagePath(person.currentImg)} label="Heute"/></div>
    <span className={`badge status-${person.status}`}>{person.status}</span>
    <h2>{person.name}</h2>
    <p className="lead-text">{person.today || 'Noch keine aktuellen Informationen.'}</p>
    <dl>
      <div><dt>Bereich</dt><dd>{person.role || 'offen'}</dd></div>
      <div><dt>Ort</dt><dd>{person.location || 'offen'}</dd></div>
      <div><dt>Hinweise</dt><dd>{person.network || 'offen'}</dd></div>
    </dl>
    {adminMode && <button className="primary" onClick={onEdit}>✎ Bearbeiten</button>}
  </div>;
}

function Editor({ draft, setDraft, onSave, onCancel, onPhoto }) {
  return <div className="editor">
    <h2>Person bearbeiten</h2>
    <label>Name<input value={draft.name} onChange={e => setDraft({...draft, name:e.target.value})}/></label>
    <label>Status<select value={draft.status} onChange={e => setDraft({...draft, status:e.target.value})}>{STATUS.map(s => <option key={s}>{s}</option>)}</select></label>
    <label>Bereich / Rolle<input value={draft.role || ''} onChange={e => setDraft({...draft, role:e.target.value})}/></label>
    <label>Aktuelle Informationen<textarea value={draft.today || ''} onChange={e => setDraft({...draft, today:e.target.value})}/></label>
    <label>Ort / Region<input value={draft.location || ''} onChange={e => setDraft({...draft, location:e.target.value})}/></label>
    <label>Hinweise / Verbindungen<textarea value={draft.network || ''} onChange={e => setDraft({...draft, network:e.target.value})}/></label>
    <label>Aktuelles Foto<input type="file" accept="image/*" onChange={e => onPhoto(e.target.files[0])}/></label>
    {draft.currentImg && <img className="preview" src={imagePath(draft.currentImg)} alt="Vorschau"/>}
    <div className="actions"><button onClick={onCancel}>Abbrechen</button><button className="primary" onClick={onSave}>Speichern</button></div>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
