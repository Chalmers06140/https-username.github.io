const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(data,status=200)=>Response.json(data,{status});
function cors(request,env){
 const origin=request.headers.get('Origin');
 return origin&&(origin===env.ALLOWED_ORIGIN||origin===env.LOCAL_ORIGIN)?origin:null;
}
function withCors(response,origin){
 if(origin){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');response.headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');response.headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');}
 return response;
}
async function assignment(db,person){
 const rows=await db.prepare('SELECT name, seat FROM participants WHERE group_number = ? ORDER BY seat').bind(person.group_number).all();
 const members=rows.results??[],count=members.length;
 return {id:person.id,name:person.name,groupNumber:count>=3?person.group_number:null,pending:count<3,waitingFor:Math.max(0,3-count),members};
}
async function joinGet(request,db){
 const id=new URL(request.url).searchParams.get('id')??'';
 if(!uuid.test(id))return json({error:'Unknown student.'},400);
 const person=await db.prepare('SELECT id,name,group_number,seat FROM participants WHERE id = ?').bind(id).first();
 return person?json(await assignment(db,person)):json({error:'Join the seminar first.'},404);
}
async function joinPost(request,db){
 try{
  const body=await request.json(),id=String(body.id??''),name=String(body.name??'').trim().replace(/\s+/g,' ');
  if(!uuid.test(id)||name.length<1||name.length>60)return json({error:'Enter a first name or nickname to join.'},400);
  const existing=await db.prepare('SELECT id,name,group_number,seat FROM participants WHERE id = ?').bind(id).first();
  if(existing){await db.prepare('UPDATE participants SET name = ? WHERE id = ?').bind(name,id).run();return json(await assignment(db,{...existing,name}));}
  for(let attempt=0;attempt<30;attempt++){
   const rows=await db.prepare('SELECT group_number AS groupNumber, COUNT(*) AS count FROM participants GROUP BY group_number').all();
   const counts=new Map((rows.results??[]).map(r=>[r.groupNumber,r.count]));
   const forming=[...counts].filter(([,count])=>count<4).sort((a,b)=>b[1]-a[1]);
   const fifth=[...counts].filter(([,count])=>count<5).sort((a,b)=>a[1]-b[1]);
   const sixth=[...counts].filter(([,count])=>count<6).sort((a,b)=>a[1]-b[1]);
   const groupNumber=forming.length?forming[0][0]:counts.size<12?Array.from({length:12},(_,k)=>k+1).find(n=>!counts.has(n)):fifth.length?fifth[0][0]:sixth.length?sixth[0][0]:Math.max(...counts.keys())+1;
   const occupied=await db.prepare('SELECT seat FROM participants WHERE group_number = ?').bind(groupNumber).all();
   const used=new Set((occupied.results??[]).map(r=>r.seat));
   const count=counts.get(groupNumber)??0,seats=Array.from({length:count<4?4:count<5?5:6},(_,k)=>k+1).filter(n=>!used.has(n));
   if(!seats.length)continue;
   const seat=seats[Math.floor(Math.random()*seats.length)];
   const saved=await db.prepare('INSERT OR IGNORE INTO participants (id,name,group_number,seat,joined_at) VALUES (?,?,?,?,?)').bind(id,name,groupNumber,seat,new Date().toISOString()).run();
   if(saved.meta.changes===1)return json(await assignment(db,{id,name,group_number:groupNumber,seat}));
   const raced=await db.prepare('SELECT id,name,group_number,seat FROM participants WHERE id = ?').bind(id).first();
   if(raced)return json(await assignment(db,raced));
  }
  return json({error:'Groups are busy assigning. Please try again.'},503);
 }catch{return json({error:'Could not assign a group. Please try again.'},500)}
}
async function roster(db){const result=await db.prepare('SELECT id, name, group_number AS groupNumber, seat, joined_at AS joinedAt FROM participants ORDER BY group_number, seat').all();return result.results??[];}
async function teacher(request,env){
 const secret=env.TA_TOKEN,provided=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
 if(!secret||!provided||provided!==secret)return json({error:'Invalid TA access code.'},403);
 if(request.method==='GET')return json({roster:await roster(env.DB)});
 if(request.method!=='POST'||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Invalid request.'},400);
 try{
  const body=await request.json(),id=String(body.id??'');
  if(!uuid.test(id))return json({error:'Unknown student.'},400);
  const student=await env.DB.prepare('SELECT id, name, group_number AS groupNumber FROM participants WHERE id = ?').bind(id).first();
  if(!student)return json({error:'Student is no longer on the roster.'},404);
  if(body.action==='remove'){await env.DB.prepare('DELETE FROM participants WHERE id = ?').bind(id).run();return json({message:student.name+' removed from the roster.',roster:await roster(env.DB)});}
  if(body.action!=='move')return json({error:'Choose move or remove.'},400);
  const groupNumber=Number(body.groupNumber);
  if(!Number.isInteger(groupNumber)||groupNumber<1||groupNumber>50)return json({error:'Choose a valid group.'},400);
  if(groupNumber===student.groupNumber)return json({message:'Student is already in that group.',roster:await roster(env.DB)});
  const occupied=await env.DB.prepare('SELECT seat FROM participants WHERE group_number = ?').bind(groupNumber).all();
  const used=new Set((occupied.results??[]).map(r=>r.seat)),seat=[1,2,3,4,5,6].find(n=>!used.has(n));
  if(!seat)return json({error:'That group already has six students.'},409);
  const changed=await env.DB.prepare('UPDATE OR IGNORE participants SET group_number = ?, seat = ? WHERE id = ?').bind(groupNumber,seat,id).run();
  if(changed.meta.changes!==1)return json({error:'Group changed while you were editing. Refresh and try again.'},409);
  return json({message:student.name+' moved to Group '+groupNumber+'.',roster:await roster(env.DB)});
 }catch{return json({error:'Could not update the roster.'},500)}
}
export default {async fetch(request,env){
 const origin=cors(request,env),path=new URL(request.url).pathname;
 if(request.headers.get('Origin')&&!origin)return json({error:'This site is not allowed to use the group service.'},403);
 if(request.method==='OPTIONS')return withCors(new Response(null,{status:204}),origin);
 let response;
 if(path==='/api/join')response=request.method==='GET'?await joinGet(request,env.DB):request.method==='POST'?await joinPost(request,env.DB):json({error:'Method not allowed.'},405);
 else if(path==='/api/teacher')response=await teacher(request,env);
 else response=json({service:'SVEAB group assignment',status:'ok'});
 return withCors(response,origin);
}};
