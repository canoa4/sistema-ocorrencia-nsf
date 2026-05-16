import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import './style.css';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const turmas = ['6º A','6º B','6º C','6º D','6º E','7º A','7º B','7º C','7º D','8º A','8º B','8º C','9º A','9º B','9º C','9º D'];
const tipos = ['Indisciplina','Agressão verbal','Agressão física','Desrespeito ao professor','Conflito entre alunos','Uso inadequado de celular','Dano ao patrimônio','Falta de material','Atraso ou ausência recorrente','Outro'];
const gravidades = ['Leve','Moderada','Grave'];
const statusList = ['Registrada','Em acompanhamento','Resolvida'];

const initialForm = () => ({
  data: new Date().toISOString().slice(0, 10),
  professor: '',
  turma: '',
  aluno: '',
  tipo: '',
  gravidade: '',
  descricao: '',
  encaminhamento: '',
  responsavelAvisado: 'Não',
  status: 'Registrada',
});

function formatDate(dateISO) {
  if (!dateISO) return '';
  const date = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateISO;
  return date.toLocaleDateString('pt-BR');
}

function createProtocol(total) {
  return `OC-${String(total + 1).padStart(4, '0')}`;
}

function validateForm(form) {
  return ['data','professor','turma','aluno','tipo','gravidade','descricao'].every((field) => String(form[field] || '').trim());
}

function escapeCSV(value) {
  return `"${String(value || '').replaceAll('"', '""')}"`;
}

function makeCSV(records) {
  const header = ['Protocolo','Data','Professor','Turma','Aluno','Tipo','Gravidade','Descrição','Encaminhamento','Responsável avisado','Status'];
  const rows = records.map((item) => [item.protocolo, item.data, item.professor, item.turma, item.aluno, item.tipo, item.gravidade, item.descricao, item.encaminhamento, item.responsavelAvisado, item.status]);
  return [header, ...rows].map((row) => row.map(escapeCSV).join(';')).join('\n');
}

function Badge({ children, type }) {
  return <span className={`badge ${type || ''}`}>{children}</span>;
}

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialForm());
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [studentSelected, setStudentSelected] = useState('');
  const [printReport, setPrintReport] = useState(null);

  const canManage = profile?.role === 'Secretaria' || profile?.role === 'Coordenação';

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      try {
        if (!firebaseUser) {
          setUser(null);
          setProfile(null);
          setRecords([]);
          return;
        }
        const profileSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!profileSnap.exists() || profileSnap.data().active !== true) {
          await signOut(auth);
          setMessage('Acesso negado. Seu usuário não está liberado pela escola.');
          return;
        }
        setUser(firebaseUser);
        setProfile(profileSnap.data());
        await loadRecords();
      } catch (error) {
        console.error(error);
        setMessage('Erro ao verificar o acesso. Confira a configuração do Firebase.');
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function login(event) {
    event.preventDefault();
    setMessage('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      console.error(error);
      setMessage('E-mail ou senha inválidos. O acesso é restrito aos usuários cadastrados pela escola.');
    }
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  }

  async function loadRecords() {
    const q = query(collection(db, 'occurrences'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveOccurrence(event) {
    event.preventDefault();
    if (!validateForm(form)) {
      setMessage('Preencha todos os campos obrigatórios antes de salvar.');
      return;
    }
    const newRecord = {
      ...form,
      professor: form.professor.trim(),
      aluno: form.aluno.trim(),
      descricao: form.descricao.trim(),
      encaminhamento: form.encaminhamento.trim(),
      protocolo: createProtocol(records.length),
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      createdByName: profile?.name || user.email,
      createdByRole: profile?.role || 'Professor',
    };
    await addDoc(collection(db, 'occurrences'), newRecord);
    setForm(initialForm());
    setMessage(`Ocorrência ${newRecord.protocolo} registrada com sucesso.`);
    await loadRecords();
  }

  async function changeStatus(id, status) {
    if (!canManage) {
      setMessage('Somente Secretaria ou Coordenação podem alterar o status.');
      return;
    }
    await updateDoc(doc(db, 'occurrences', id), { status });
    await loadRecords();
  }

  async function removeRecord(id) {
    if (!canManage) {
      setMessage('Somente Secretaria ou Coordenação podem excluir ocorrências.');
      return;
    }
    if (!confirm('Deseja realmente excluir esta ocorrência?')) return;
    await deleteDoc(doc(db, 'occurrences', id));
    await loadRecords();
  }

  const filteredRecords = useMemo(() => {
    const term = search.toLowerCase().trim();
    return records.filter((item) => {
      const text = [item.protocolo, item.professor, item.turma, item.aluno, item.tipo, item.gravidade, item.status, item.descricao].join(' ').toLowerCase();
      return (!term || text.includes(term)) && (classFilter === 'Todas' || item.turma === classFilter) && (statusFilter === 'Todos' || item.status === statusFilter);
    });
  }, [records, search, classFilter, statusFilter]);

  const students = useMemo(() => {
    return [...new Set(records.map((r) => r.aluno).filter(Boolean).map((name) => name.trim()))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [records]);

  const studentRecords = useMemo(() => {
    if (!studentSelected) return [];
    return records.filter((r) => r.aluno === studentSelected).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }, [records, studentSelected]);

  function exportRecords() {
    if (!records.length) {
      setMessage('Não há registros para exportar.');
      return;
    }
    const blob = new Blob(['\ufeff' + makeCSV(records)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ocorrencias-escolares-nsf.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function preparePrint() {
    if (!studentSelected || !studentRecords.length) {
      setMessage('Selecione um aluno com ocorrência registrada.');
      return;
    }
    setPrintReport({ aluno: studentSelected, registros: studentRecords, emissor: profile?.name || user.email, perfil: profile?.role || '', data: new Date().toLocaleDateString('pt-BR') });
    setTimeout(() => window.print(), 250);
  }

  if (loading) return <div className="loading">Carregando sistema...</div>;

  if (!user || !profile) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand-row">
            <img src="/logo-nsf.png" alt="Brasão EMEF Nossa Senhora de Fátima" className="login-logo" />
            <div>
              <p className="school-name">EMEF NOSSA SENHORA DE FÁTIMA</p>
              <h1>Sistema Integrado de Ocorrência Escolar</h1>
              <p>Acesso restrito a professores, secretaria e coordenação.</p>
            </div>
          </div>
          {message && <div className="message">{message}</div>}
          <form onSubmit={login} className="login-form">
            <label>E-mail institucional<input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@escola.com" /></label>
            <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" /></label>
            <button>Entrar no sistema</button>
          </form>
          <p className="small-note">Este projeto usa Firebase Authentication e Firestore. Apenas usuários cadastrados e liberados pela escola acessam o sistema.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <style>{`@media print { body * { visibility: hidden !important; } .print-area, .print-area * { visibility: visible !important; } .print-area { display:block !important; position:absolute !important; left:0; top:0; width:100%; } .app-area { display:none !important; } @page { margin: 12mm; } }`}</style>
      <section className="print-area">
        {printReport && (
          <div className="report">
            <div className="report-header"><img src="/logo-nsf.png" /><div><h1>EMEF NOSSA SENHORA DE FÁTIMA</h1><h2>Histórico Individual de Ocorrências Escolares</h2></div></div>
            <p className="family-message"><b>Comunicado à família:</b> Este documento apresenta o histórico de ocorrências escolares registradas no sistema institucional referente ao(à) aluno(a) abaixo identificado(a). As informações têm finalidade pedagógica, administrativa e de acompanhamento familiar, servindo para ciência do pai, mãe ou responsável e para o fortalecimento da parceria entre escola e família.</p>
            <div className="report-info"><p><b>Aluno(a):</b> {printReport.aluno}</p><p><b>Total de ocorrências:</b> {printReport.registros.length}</p><p><b>Emitido em:</b> {printReport.data}</p><p><b>Emitido por:</b> {printReport.emissor} — {printReport.perfil}</p></div>
            <table><thead><tr><th>Protocolo</th><th>Data</th><th>Turma</th><th>Tipo</th><th>Gravidade</th><th>Status</th></tr></thead><tbody>{printReport.registros.map((item) => <React.Fragment key={item.id}><tr><td>{item.protocolo}</td><td>{formatDate(item.data)}</td><td>{item.turma}</td><td>{item.tipo}</td><td>{item.gravidade}</td><td>{item.status}</td></tr><tr><td colSpan="6"><b>Descrição:</b> {item.descricao}<br/><b>Encaminhamento:</b> {item.encaminhamento || 'Não informado'}<br/><b>Professor(a)/servidor(a):</b> {item.professor}<br/><b>Responsável avisado:</b> {item.responsavelAvisado}</td></tr></React.Fragment>)}</tbody></table>
            <p className="science">Declaro que tomei ciência das informações registradas neste documento e estou ciente da necessidade de acompanhamento da vida escolar do(a) estudante.</p>
            <div className="signatures"><div>Assinatura do pai, mãe ou responsável</div><div>Assinatura da coordenação/secretaria</div></div>
          </div>
        )}
      </section>
      <section className="app-area container">
        <header className="topbar">
          <div className="brand-row"><img src="/logo-nsf.png" alt="Brasão" className="logo" /><div><p className="school-name">EMEF NOSSA SENHORA DE FÁTIMA</p><h1>Sistema Integrado de Ocorrência Escolar</h1><p>Plataforma institucional para registro, acompanhamento e organização das ocorrências escolares.</p></div></div>
          <div className="user-box"><b>{profile.name}</b><span>{profile.role}</span><button onClick={exportRecords}>Exportar</button><button className="exit" onClick={logout}>Sair</button></div>
        </header>
        {message && <div className="message">{message}</div>}
        <div className="cards"><Card title="Total de ocorrências" value={records.length}/><Card title="Em acompanhamento" value={records.filter((r) => r.status === 'Em acompanhamento').length}/><Card title="Ocorrências graves" value={records.filter((r) => r.gravidade === 'Grave').length}/></div>
        <div className="grid">
          <section className="panel"><h2>Nova ocorrência</h2><form onSubmit={saveOccurrence} className="form"><input type="date" value={form.data} onChange={(e) => updateField('data', e.target.value)}/><input value={form.professor} onChange={(e) => updateField('professor', e.target.value)} placeholder="Professor(a)/servidor(a)"/><div className="two"><select value={form.turma} onChange={(e) => updateField('turma', e.target.value)}><option value="">Turma</option>{turmas.map((t) => <option key={t}>{t}</option>)}</select><select value={form.gravidade} onChange={(e) => updateField('gravidade', e.target.value)}><option value="">Gravidade</option>{gravidades.map((g) => <option key={g}>{g}</option>)}</select></div><input value={form.aluno} onChange={(e) => updateField('aluno', e.target.value)} placeholder="Nome completo do aluno"/><select value={form.tipo} onChange={(e) => updateField('tipo', e.target.value)}><option value="">Tipo de ocorrência</option>{tipos.map((t) => <option key={t}>{t}</option>)}</select><textarea value={form.descricao} onChange={(e) => updateField('descricao', e.target.value)} placeholder="Descrição da ocorrência"/><textarea value={form.encaminhamento} onChange={(e) => updateField('encaminhamento', e.target.value)} placeholder="Encaminhamento realizado"/><select value={form.responsavelAvisado} onChange={(e) => updateField('responsavelAvisado', e.target.value)}><option>Não</option><option>Sim</option></select><button>Salvar ocorrência</button></form></section>
          <section className="panel"><h2>Painel de ocorrências</h2><div className="filters"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar"/><select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}><option>Todas</option>{turmas.map((t) => <option key={t}>{t}</option>)}</select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>Todos</option>{statusList.map((s) => <option key={s}>{s}</option>)}</select></div><div className="student-print"><h3>Ocorrências por aluno</h3><p>Selecione o aluno para imprimir o histórico completo e entregar aos pais.</p><div className="two"><select value={studentSelected} onChange={(e) => setStudentSelected(e.target.value)}><option value="">Selecione um aluno</option>{students.map((s) => <option key={s}>{s}</option>)}</select><button onClick={preparePrint}>Imprimir histórico</button></div></div><div className="list">{filteredRecords.map((item) => <article className="record" key={item.id}><div><Badge>{item.protocolo}</Badge><Badge type={item.gravidade.toLowerCase()}>{item.gravidade}</Badge><Badge>{item.status}</Badge></div><h3>{item.aluno}</h3><p>{item.turma} • {item.tipo} • {formatDate(item.data)}</p><p><b>Descrição:</b> {item.descricao}</p>{item.encaminhamento && <p><b>Encaminhamento:</b> {item.encaminhamento}</p>}<div className="actions"><select value={item.status} onChange={(e) => changeStatus(item.id, e.target.value)} disabled={!canManage}>{statusList.map((s) => <option key={s}>{s}</option>)}</select><button onClick={() => removeRecord(item.id)} disabled={!canManage}>Excluir</button></div></article>)}</div></section>
        </div>
      </section>
    </main>
  );
}

function Card({ title, value }) { return <div className="summary"><span>{title}</span><b>{value}</b></div>; }

createRoot(document.getElementById('root')).render(<App />);
