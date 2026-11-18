import {useEffect,useState} from 'react';
import {apiUrl,groupServiceReady,siteUrl} from './config';
type Student={id:string;name:string;groupNumber:number;seat:number;joinedAt:string};
function csvCell(value:unknown){const raw=String(value??'');const safe=/^[=+\-@\t\r]/.test(raw)?"'"+raw:raw;return '"'+safe.replaceAll('"','""')+'"'}
function downloadRoster(roster:Student[]){
 const lines=[['Group','Seat','Student name','Joined at'],...roster.map(s=>[s.groupNumber,s.seat,s.name,s.joinedAt])];
 const blob=new Blob(['\ufeff'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='sveab-group-roster.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function Teacher(){
 const [token,setToken]=useState(''),[draft,setDraft]=useState('');
 const [roster,setRoster]=useState<Student[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(false);
 const [busyId,setBusyId]=useState(''),[confirmId,setConfirmId]=useState(''),[targets,setTargets]=useState<Record<string,number>>({});
 async function reload(secret=token){
  if(!secret)return;
  setLoading(true);setError('');
  try{const response=await fetch(apiUrl('/api/teacher'),{headers:{Authorization:'Bearer '+secret},cache:'no-store'});
   const data=await response.json() as {roster?:Student[];error?:string};
   if(!response.ok)throw Error(data.error||'Unable to load the roster.');setRoster(data.roster||[]);
  }catch(e){setError(e instanceof Error?e.message:'Unable to load the roster.')}finally{setLoading(false)}
 }
 useEffect(()=>{if(token)void reload(token)},[]);
 function signIn(){const secret=draft.trim();if(!secret){setError('Enter the TA access code.');return}setToken(secret);setDraft('');void reload(secret)}
 async function change(action:'move'|'remove',student:Student){
  setBusyId(student.id);setError('');setNotice('');
  try{const response=await fetch(apiUrl('/api/teacher'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,id:student.id,groupNumber:targets[student.id]??student.groupNumber})});
   const data=await response.json() as {roster?:Student[];message?:string;error?:string};
   if(!response.ok)throw Error(data.error||'Could not update the roster.');setRoster(data.roster||[]);setNotice(data.message||'Roster updated.');setConfirmId('');
   setTargets(old=>{const next={...old};delete next[student.id];return next});
  }catch(e){setError(e instanceof Error?e.message:'Could not update the roster.')}finally{setBusyId('')}
 }
 const groupMax=Math.max(12,...roster.map(r=>r.groupNumber));
 const groups=Array.from({length:groupMax},(_,i)=>i+1),choices=Array.from({length:Math.min(50,groupMax+1)},(_,i)=>i+1);
 return <main className="teacher-page"><header><a href={siteUrl('')}>← STUDENT GAME</a><b>SVEAB · TA VIEW</b><span>FREIGHT SEMINAR</span></header><section>
  <div className="eyebrow">SEMINAR ROSTER</div><h1>Groups and students</h1>
  {!groupServiceReady&&<p className="game-error-inline">Set the group service URL in config.js before using the roster.</p>}
  {!token?<div className="panel teacher-login"><h3>TA access</h3><p>Enter the access code you set for the group service.</p><input type="password" autoComplete="off" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')signIn()}} placeholder="TA access code"/><button className="primary" onClick={signIn}>OPEN ROSTER</button></div>:<>
   <p>The game forms groups of four first, then adds fifth members. You can move or remove a student here; their game updates automatically. A group number appears once at least three students have joined.</p>
   <div className="teacher-actions"><button className="primary" onClick={()=>void reload()}>REFRESH ↻</button><button className="primary" disabled={!roster.length} onClick={()=>downloadRoster(roster)}>DOWNLOAD ROSTER ↓</button><a className="primary" href={siteUrl('teacher/test/')}>TEST GAME AS TA →</a><button className="primary" onClick={()=>{setToken('');setRoster([])}}>SIGN OUT</button></div>
   {loading?<p>Loading…</p>:!error&&<><div className="teacher-stats"><div><b>{roster.length}</b><span>STUDENTS JOINED</span></div><div><b>{groups.filter(group=>roster.filter(r=>r.groupNumber===group).length>=3).length}</b><span>GROUPS READY</span></div><div><b>{roster.filter(r=>roster.filter(p=>p.groupNumber===r.groupNumber).length<3).length}</b><span>WAITING FOR GROUP</span></div></div>
    <div className="roster-grid">{groups.map(group=>{const members=roster.filter(r=>r.groupNumber===group);return <div className="roster-card" key={group}><h3>GROUP {group} <small>{members.length} students</small></h3>
      {members.length>0&&members.length<3&&<small>Forming: students are waiting for a third member</small>}
      {members.map(student=><div className="roster-student" key={student.id}><b>{student.name}</b><div className="roster-controls"><select aria-label={'Move '+student.name+' to group'} value={targets[student.id]??student.groupNumber} onChange={e=>setTargets(old=>({...old,[student.id]:Number(e.target.value)}))}>{choices.map(n=><option value={n} key={n}>Group {n}</option>)}</select><button disabled={busyId===student.id||(targets[student.id]??student.groupNumber)===student.groupNumber} onClick={()=>void change('move',student)}>Move</button>{confirmId===student.id?<><button className="danger" disabled={busyId===student.id} onClick={()=>void change('remove',student)}>Confirm remove</button><button onClick={()=>setConfirmId('')}>Cancel</button></>:<button className="danger-outline" onClick={()=>setConfirmId(student.id)}>Remove</button>}</div></div>)}
    </div>})}</div><p className="micro">Moving a student to an empty group leaves that group forming until it has three members.</p></>}
  </>}
  {error&&<div className="teacher-access" role="alert"><p>{error}</p></div>}{notice&&<p className="teacher-notice" role="status">{notice}</p>}
 </section></main>;
}
