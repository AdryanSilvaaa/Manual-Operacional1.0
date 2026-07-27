import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function CadastroSistemas() {
 const {apiUrl,token}=useAuth(); const [systems,setSystems]=useState([]); const [form,setForm]=useState({nome:'',resumo:''}); const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 async function load(){const r=await fetch(`${apiUrl}/api/systems`,{headers});setSystems(await r.json());} useEffect(()=>{load()},[]);
 async function submit(e){e.preventDefault();await fetch(`${apiUrl}/api/systems`,{method:'POST',headers,body:JSON.stringify(form)});setForm({nome:'',resumo:''});load();}
 async function remove(id){if(window.confirm('Remover este sistema?')){await fetch(`${apiUrl}/api/systems/${id}`,{method:'DELETE',headers});load();}}
 return <section className="admin-page"><div className="page-heading"><p className="eyebrow">Configurações</p><h1>Cadastrar Sistemas</h1></div><div className="admin-grid"><form className="admin-panel" onSubmit={submit}><h2>Novo sistema</h2><label>Nome<input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} required/></label><label>Resumo<textarea value={form.resumo} onChange={e=>setForm({...form,resumo:e.target.value})}/></label><button className="primary-button"><Plus size={18}/>Cadastrar sistema</button></form><div className="admin-panel"><h2>Sistemas disponíveis para todos os setores</h2><div className="table-list">{systems.map(s=><div className="table-row" key={s.id}><span>{s.nome}</span><button onClick={()=>remove(s.id)}><Trash2 size={16}/></button></div>)}</div></div></div></section>;
}
