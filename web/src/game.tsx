"use client";

import { useEffect, useState } from "react";
import {apiUrl,groupServiceReady,siteUrl} from "./config";
import { ASEK, BASE_INPUTS, CASE, CASE_CONTROLS, SCENARIOS, baseline, criticalDistance, evaluate, kg, money, scenarioInputs, type Inputs, type Route } from "./model";
import { CostPlot, Field, RailPlot, Scene, Sensitivity, Slider } from "./parts";

type Stage = "start" | "calculate" | "case";
type Paper = { slope:string; intercept:string; railFixed:string; truckRate:string; critical:string };
type CallRecord = {index:number;before:Inputs;after:Inputs};
type GroupMember = {name:string;seat:number};
type State = {
  catalogVersion:number;
  stage:Stage; maxStage:number; participantId:string; name:string; groupNumber:number|null;
  pending:boolean; waitingFor:number; groupMembers:GroupMember[]; points:number[]; paper:Paper; calculated:boolean;
  caseIndex:number|null; inputs:Inputs; anchorInputs:Inputs; activeVariable:keyof Inputs|null;
  callLogs:CallRecord[]; rangeBounds:[number,number]; outcomeIndex:number; beforeReveal:Inputs|null; revealed:boolean;
  route:Route|null; dispatched:boolean; actionBooked:boolean; beforeAction:Inputs|null; prediction:string|null; showCaseAnswer:boolean;
};
const stages:Stage[]=["start","calculate","case"];
const labels=["Start","Task 2 · Calculate","Disruption case"];
const initial:State={
  catalogVersion:4,
  stage:"start",maxStage:0,participantId:"",name:"",groupNumber:null,pending:false,waitingFor:0,groupMembers:[],
  points:[],paper:{slope:"",intercept:"",railFixed:"",truckRate:"",critical:""},calculated:false,
  caseIndex:null,inputs:BASE_INPUTS,anchorInputs:BASE_INPUTS,activeVariable:null,callLogs:[],rangeBounds:[0,0],outcomeIndex:1,beforeReveal:null,revealed:false,
  route:null,dispatched:false,actionBooked:false,beforeAction:null,prediction:null,showCaseAnswer:false
};
const DISTANCE=350;
const ASEK_URL="https://bransch.trafikverket.se/contentassets/0e5777a6301e4134a6e8365fc20c0e0e/asek-8.1-kalkylbilaga-4-maj-2026.xlsx";
function num(v:string){return Number(v.replace(",","."))}
function close(v:string,n:number,tolerance:number){return v.trim()!==""&&Math.abs(num(v)-n)<=tolerance}
function criticalLabel(value:number|null){return value===null?"No positive crossing":value.toFixed(1)+" km"}
function timeLabel(value:number){const minutes=Math.round(value*1440),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;return [days&&`${days} ${days===1?"day":"days"}`,hours&&`${hours} h`,rest&&`${rest} min`].filter(Boolean).join(" ")||"0 min"}
type Assignment={groupNumber:number|null;pending:boolean;waitingFor:number;members:GroupMember[];error?:string};

export default function Game({testMode=false,emergencyMode=false}:{testMode?:boolean;emergencyMode?:boolean}){
  const [s,setS]=useState<State>(testMode?{...initial,participantId:"ta-test",name:"TA",groupNumber:-1,maxStage:2}:emergencyMode?{...initial,maxStage:1}:initial);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    try{
      const saved=localStorage.getItem(testMode?"sveab-ta-test-v2":emergencyMode?"sveab-emergency-v1":"sveab-game-v4");
      if(saved){
        const parsed=JSON.parse(saved) as Partial<State>;
        const validCase=parsed.catalogVersion===4&&typeof parsed.caseIndex==="number"&&parsed.caseIndex>=0&&parsed.caseIndex<SCENARIOS.length?parsed.caseIndex:null;
        setS({...initial,...parsed,catalogVersion:4,caseIndex:validCase,actionBooked:validCase!==null&&!!parsed.actionBooked,prediction:validCase!==null?parsed.prediction??null:null,participantId:testMode?"ta-test":emergencyMode?"":parsed.participantId||"",name:testMode?"TA":emergencyMode?"":parsed.name||"",groupNumber:testMode?-1:emergencyMode?null:parsed.groupNumber??null,groupMembers:emergencyMode?[]:parsed.groupMembers??[],maxStage:testMode?2:emergencyMode?Math.max(1,parsed.maxStage??1):parsed.maxStage??0,inputs:{...BASE_INPUTS,...(validCase===null?{}:parsed.inputs),scenario:validCase??0,distance:DISTANCE},anchorInputs:{...BASE_INPUTS,...(validCase===null?{}:parsed.anchorInputs),scenario:validCase??0,distance:DISTANCE}});
      }else if(!testMode&&!emergencyMode){
        const old=localStorage.getItem("sveab-game-v3")||localStorage.getItem("sveab-game-v2");
        if(old){
          const prior=JSON.parse(old) as {participantId?:string;name?:string};
          if(prior.participantId)setS({...initial,participantId:prior.participantId,name:prior.name||"",pending:true});
        }
      }
    }catch{}
    setReady(true);
  },[testMode,emergencyMode]);
  useEffect(()=>{if(ready)localStorage.setItem(testMode?"sveab-ta-test-v2":emergencyMode?"sveab-emergency-v1":"sveab-game-v4",JSON.stringify(s))},[s,ready,testMode,emergencyMode]);
  useEffect(()=>{
    if(!ready||testMode||emergencyMode||!s.participantId)return;
    let alive=true;
    async function check(){
      try{
        const response=await fetch(apiUrl("/api/join?id="+encodeURIComponent(s.participantId)),{cache:"no-store"});
        if(response.status===404){if(alive)setS(old=>({...initial,name:old.name}));return}
        if(!response.ok)return;
        const data=await response.json() as Assignment;
        if(alive)setS(old=>{
          const members=data.members??[];
          if(old.groupNumber===data.groupNumber&&old.pending===data.pending&&old.waitingFor===data.waitingFor&&old.groupMembers.length===members.length&&old.groupMembers.every((m,i)=>m.name===members[i].name&&m.seat===members[i].seat))return old;
          return {...old,groupNumber:data.groupNumber,pending:data.pending,waitingFor:data.waitingFor,groupMembers:members,stage:data.groupNumber?old.stage:"start",maxStage:data.groupNumber?Math.max(old.maxStage,1):0};
        });
      }catch{}
    }
    void check();
    const timer=setInterval(()=>void check(),4000);
    return ()=>{alive=false;clearInterval(timer)};
  },[ready,s.participantId,testMode,emergencyMode]);
  const patch=(p:Partial<State>)=>setS(old=>({...old,...p}));
  const event=s.caseIndex===null?null:SCENARIOS[s.caseIndex];
  const base=baseline(DISTANCE);
  const rail=event?evaluate(s.inputs,"rail"):null,road=event?evaluate(s.inputs,"road"):null;
  const chosen=s.route&&event?evaluate(s.inputs,s.route):null;
  const feasible=[rail,road].filter((o):o is NonNullable<typeof o>=>!!o&&o.withinDeadline).sort((a,b)=>a.decisionCost-b.decisionCost);
  const controls=s.caseIndex===null?[]:CASE_CONTROLS[s.caseIndex];
  const workingBase=event?.action&&s.actionBooked?{...s.anchorInputs,...event.action.update}:s.anchorInputs;
  const unresolved=event?event.unknowns.filter((_,index)=>!s.callLogs.some(log=>event.inquiries[log.index].resolves===index)):[];
  const rangeBounds:[number,number]=event?.range&&s.actionBooked&&event.action?.update[event.range.key]!==undefined?[event.action.update[event.range.key] as number,event.action.update[event.range.key] as number]:s.rangeBounds;
  const criticalRange=event?rangeBounds.map(value=>criticalDistance({...s.inputs,[event.range.key]:value})):[];
  const checks=[
    {label:"Rail quote slope",your:s.paper.slope,correct:base.railSlope+" SEK/km",good:close(s.paper.slope,base.railSlope,0.05)},
    {label:"Rail quote intercept",your:s.paper.intercept,correct:"550 SEK",good:close(s.paper.intercept,550,1)},
    {label:"Complete intermodal fixed charge",your:s.paper.railFixed,correct:money(base.railIntercept),good:close(s.paper.railFixed,base.railIntercept,2)},
    {label:"Direct truck cost per km",your:s.paper.truckRate,correct:base.roadSlope.toFixed(1)+" SEK/km",good:close(s.paper.truckRate,base.roadSlope,0.05)},
    {label:"Critical distance where rail becomes cheaper",your:s.paper.critical,correct:base.critical.toFixed(1)+" km",good:close(s.paper.critical,base.critical,2)}
  ];
  const hints=[!checks[2].good&&"Add two local hauls and two transhipments to the Rail Combi intercept, not to direct truck.",!checks[3].good&&"Apply the 20% repositioning allowance to the whole direct truck journey, including the two road connections.",!checks[4].good&&"Set the complete intermodal and direct-truck formulas equal, then solve for the distance between rail terminals."].filter(Boolean);

  function go(target:Stage){
    if(testMode){patch({stage:target});setError("");return}
    if(target==="calculate"&&!s.groupNumber&&!emergencyMode){setError("Wait until your group has at least three members.");return}
    if(target==="case"&&!s.calculated){setError(s.points.length!==2?"Click two different quote points before continuing.":"Check your Task 2 answers before continuing.");return}
    if(stages.indexOf(target)>s.maxStage){setError("Finish this step before moving on.");return}
    patch({stage:target});setError("");
  }
  async function join(){
    const name=s.name.trim().replace(/\s+/g," ");
    if(!name){setError("Enter a first name or nickname to join the seminar.");return}
    setBusy(true);setError("");
    try{
      const id=s.participantId||crypto.randomUUID();
      const response=await fetch(apiUrl("/api/join"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,name})});
      const data=await response.json() as Assignment;
      if(!response.ok)throw Error(data.error||"Could not join the seminar.");
      patch({participantId:id,name,groupNumber:data.groupNumber,pending:data.pending,waitingFor:data.waitingFor,groupMembers:data.members??[],maxStage:data.groupNumber?1:0});
    }catch(e){setError(e instanceof Error?e.message:"Could not join the seminar.")}
    finally{setBusy(false)}
  }
  function selectPoint(index:number){
    const points=s.points.includes(index)?s.points.filter(n=>n!==index):s.points.length<2?[...s.points,index]:[s.points[1],index];
    patch({points,calculated:false});setError("");
  }
  function setPaper(key:keyof Paper,value:string){patch({paper:{...s.paper,[key]:value},calculated:false})}
  function submitCalculation(){
    if(s.points.length!==2){setError("Click two different dots on the rail quote line. Their prices will appear below the graph.");return}
    const p=s.paper;
    if(![p.slope,p.intercept,p.railFixed,p.truckRate,p.critical].every(v=>v.trim()!==""&&Number.isFinite(num(v)))){
      setError("Enter all five numerical answers.");return;
    }
    patch({calculated:true,showCaseAnswer:false,maxStage:2});setError("");
  }
  function chooseCase(index:number){
    const inputs=scenarioInputs(index,DISTANCE);
    const range=SCENARIOS[index].range;
    patch({caseIndex:index,inputs,anchorInputs:inputs,activeVariable:null,callLogs:[],rangeBounds:[range.low,range.high],outcomeIndex:testMode?1:emergencyMode?Math.floor(Math.random()*3):((s.groupNumber||1)+index*2)%3,beforeReveal:null,revealed:false,route:null,dispatched:false,actionBooked:false,beforeAction:null,prediction:null});
    setError("");
  }
  function call(index:number){
    if(!event||s.callLogs.length>=2||s.callLogs.some(log=>log.index===index)||s.actionBooked||s.revealed)return;
    const response=event.inquiries[index].responses[s.outcomeIndex];
    const before=s.anchorInputs,after={...before,...response.update};
    patch({inputs:after,anchorInputs:after,activeVariable:null,callLogs:[...s.callLogs,{index,before,after}],rangeBounds:response.bounds??s.rangeBounds,route:null,dispatched:false});
  }
  function testVariable(key:keyof Inputs,value:number){
    patch({activeVariable:key,inputs:{...workingBase,carbonPrice:s.inputs.carbonPrice,deadline:s.inputs.deadline,[key]:value},dispatched:false});
  }
  function bookAction(){if(!event?.action||s.revealed)return;const inputs={...s.anchorInputs,...event.action.update,carbonPrice:s.inputs.carbonPrice,deadline:s.inputs.deadline};patch({inputs,actionBooked:true,beforeAction:s.anchorInputs,activeVariable:null,route:event.action.route,dispatched:false})}
  function undoAction(){patch({inputs:{...s.anchorInputs,carbonPrice:s.inputs.carbonPrice,deadline:s.inputs.deadline},actionBooked:false,beforeAction:null,activeVariable:null,route:null,dispatched:false})}
  function chooseRoute(route:Route){if(s.actionBooked&&event&&event.action?.route!==route){const inputs=s.revealed?{...(s.beforeAction||s.anchorInputs),...event.reveals[s.outcomeIndex].update,carbonPrice:s.inputs.carbonPrice,deadline:s.inputs.deadline}:{...s.anchorInputs,carbonPrice:s.inputs.carbonPrice,deadline:s.inputs.deadline};patch({inputs,anchorInputs:inputs,actionBooked:false,beforeAction:null,activeVariable:null,route,dispatched:false})}else patch({route,dispatched:false})}
  function policyChange(update:Partial<Inputs>){patch({inputs:{...s.inputs,...update},dispatched:false})}
  function dispatch(){
    if(!s.route){setError("Choose rail or truck.");return}
    if(!event)return;
    if(!s.revealed){
      const update=event.reveals[s.outcomeIndex].update;
      const realized={...s.inputs,...update,...(s.actionBooked?event.action?.update:{})};
      patch({dispatched:true,revealed:true,beforeReveal:s.inputs,inputs:realized,anchorInputs:realized,rangeBounds:[realized[event.range.key],realized[event.range.key]]});
    }else patch({dispatched:true});
    setError("");
  }
  if(!ready)return <main className="shell"><div className="loading-game">Loading SVEAB case…</div></main>;
  return <main className="shell">
    <header className="topbar"><div className="mark"><span className="mark-symbol">↗</span><span><b>SVEAB: RAIL OR ROAD?</b><small>FREIGHT SEMINAR GAME</small></span></div><div className="top-right"><i className="live-dot"/>{testMode?"TA TEST MODE":emergencyMode?"EMERGENCY ACCESS":s.groupNumber?"GROUP "+s.groupNumber:s.pending?"GROUP FORMING":"GROUP ASSIGNMENT"}</div></header>
    <div className="game-layout">
      <aside className="side"><div className="side-label">THE SEMINAR</div>{stages.map((stage,i)=><button key={stage} className={"nav-item "+(s.stage===stage?"active":"")} onClick={()=>go(stage)}><span>0{i+1}</span>{labels[i]}</button>)}<div className="side-bottom"><strong>SVEAB · DATA SET 1</strong><small>Everyone uses the same case figures. {emergencyMode?"Ask your TA which group to work with.":"Work with your assigned group."}</small><a className="teacher-link" href={siteUrl("teacher/")}>TA roster ↗</a></div></aside>
      <div className="main-area">
        {!testMode&&!emergencyMode&&s.participantId&&<div className="group-roster" aria-live="polite"><b>{s.groupNumber?`Group ${s.groupNumber}`:"Group forming"}</b><span>{s.groupMembers.length?`Members: ${s.groupMembers.map(member=>member.name).join(", ")}`:"Waiting for members to join"}</span></div>}
        {s.stage==="start"&&<section className="hero-grid"><div className="hero-copy">
          <div className="eyebrow">STEP 1 · SET UP THE SVEAB CASE</div><h1>Rail or <em>road?</em></h1>
          <p>SVEAB buys goods from suppliers across Sweden. First calculate the critical distance in the original exercise. Then test what happens when a real disruption changes the conditions.</p>
          <div className="brief-box"><b>Your first task</b><span>Draw the truck and intermodal networks on paper. Mark the supplier, rail terminals, Norrköping and Finspång. Add kilometres and costs to each leg.</span></div>
          <div className="case-facts"><div><b>50 km</b><span>Supplier to rail terminal by road</span></div><div><b>42 km</b><span>Norrköping to Finspång by road</span></div><div><b>20%</b><span>Extra lorry travel for repositioning</span></div></div>
          <div className="panel join-panel">{testMode?<><h3>TA test mode</h3><p>Explore the exercise without joining a student group or changing the roster. You can jump between the three sections.</p><a className="teacher-link dark-link" href={siteUrl("teacher/")}>Back to the TA roster ↗</a><button className="primary next-button" onClick={()=>go("calculate")}>START TASK 2 →</button></>:emergencyMode?<><h3>Start without joining a group</h3><p>This link skips the name and group assignment. Ask your TA which group to work with, then use the same SVEAB case and disruption game.</p><button className="primary next-button" onClick={()=>go("calculate")}>START TASK 2 →</button></>:<><h3>Find your seminar group</h3><p>Enter your first name or a nickname. The game forms one group at a time. Your group number appears once at least three students have joined; you can see the group members above.</p>{!groupServiceReady&&<p className="game-error-inline">Group assignment needs the group service. <a href={siteUrl("emergency/")}>Open the emergency game</a> until your TA has set it up.</p>}
            <label className="field"><span>First name or nickname</span><input type="text" maxLength={60} disabled={!!s.participantId} value={s.name} onChange={e=>patch({name:e.target.value})} placeholder="e.g. Alex"/></label>
            {s.groupNumber?<div className="group-ticket"><b>GROUP {s.groupNumber}</b><span>Meet your group in class. Use one device for the group's final presentation.</span></div>:s.pending?<div className="group-ticket forming"><b>GROUP FORMING</b><span>{s.waitingFor===1?"Waiting for one more student.":"Waiting for "+s.waitingFor+" more students."} Your group number will appear automatically.</span></div>:<button className="primary" onClick={join} disabled={busy}>{busy?"JOINING…":"JOIN THE SEMINAR →"}</button>}
            {s.groupNumber&&<button className="primary next-button" onClick={()=>go("calculate")}>START TASK 2 →</button>}<a className="ta-test-link" href={siteUrl("emergency/")}>Group joining not working? Use the emergency game ↗</a></>}
          </div>
        </div><div className="hero-visual"><Scene route={null} dispatched={false}/><div className="visual-sticker"><b>ONE CONTAINER</b><small>Two routes. One group decision.</small></div></div></section>}
        {s.stage==="calculate"&&<section>
          <div className="section-head"><div><div className="eyebrow">STEP 2 · ORIGINAL SVEAB EXERCISE</div><h1>Task 2: Critical distance for intermodal transport</h1><p>Use the case sheet to draw the routes on paper. Then click two points on the Rail Combi quote line to calculate its slope and intercept.</p></div></div>
          <div className="calc-grid">
            <div className="panel"><div className="panel-top"><span>RAIL COMBI QUOTE LINE</span><span>CLICK TWO POINTS</span></div><RailPlot chosen={s.points} onChoose={selectPoint}/><div className="data-strip"><span>Truck: {CASE.truckRate} SEK/km</span><span>Local haulage: {money(CASE.haulage)} per haul</span><span>Transhipment: {money(CASE.lift)} per unit</span></div></div>
            <div className="panel"><div className="panel-top"><span>YOUR CALCULATION</span><span>DATA SET 1</span></div>
              <div className="entry-grid"><Field label="Rail quote slope" value={s.paper.slope} unit="SEK/km" onChange={v=>setPaper("slope",v)}/><Field label="Rail quote intercept" value={s.paper.intercept} unit="SEK" onChange={v=>setPaper("intercept",v)}/><Field label="Complete intermodal fixed charge" value={s.paper.railFixed} unit="SEK" onChange={v=>setPaper("railFixed",v)}/><Field label="Direct truck cost per km" value={s.paper.truckRate} unit="SEK/km" onChange={v=>setPaper("truckRate",v)}/><Field label="Critical distance where rail becomes cheaper" value={s.paper.critical} unit="km" onChange={v=>setPaper("critical",v)}/></div>
              <div className="ppt-question"><b>For your group PPT</b><p>Which assumption or cost did you check most carefully?</p></div>
              <button className="primary full" onClick={submitCalculation}>COMPARE WITH CASE ANSWER →</button>
              {s.calculated&&<div className="calculation-feedback"><h3>Check your calculation</h3><div className="answer-head"><span>Item</span><span>Your answer</span><span>Check</span></div>{checks.map(c=><div className={"answer-row "+(c.good?"right":"review")} key={c.label}><span>{c.good?"✓ ":"Check "}{c.label}</span><span>{c.your}</span><b>{s.showCaseAnswer?c.correct:c.good?"Looks right":"Review"}</b></div>)}{hints.length>0&&!s.showCaseAnswer&&<div className="hint-box"><b>Hints</b>{hints.map(h=><p key={String(h)}>{h}</p>)}</div>}{!s.showCaseAnswer?<button className="text-button" onClick={()=>patch({showCaseAnswer:true})}>SHOW CASE ANSWERS →</button>:<p>Rail Combi quote: 6.5x + 550. Complete intermodal charge: 6.5x + 550 + 2(650) + 2(240). Direct truck: 9 × 1.2 × (x + 50 + 42). The charges are equal at x = {base.critical.toFixed(1)} km.</p>}<div className="bridge-note"><b>Next: test the same SVEAB network under a disruption</b><span>A tariff or detour can move the freight critical distance. Waiting may change the bill or delivery feasibility without moving that distance.</span></div><button className="primary full" onClick={()=>go("case")}>CHOOSE A DISRUPTION →</button></div>}
              <p className="micro source-foot">Source: SVEAB seminar case handout, Task 2 and data set 1.</p>
            </div>
          </div>
        </section>}
        {s.stage==="case"&&<section>
          <div className="section-head"><div><div className="eyebrow">STEP 3 · DISRUPTION CASE</div><h1>{event?event.title:"Choose a disruption"}</h1><p>Use the SVEAB network from Task 2 for a hypothetical shipment whose Rail Combi terminals are 350 km apart, just above the original 310.8 km critical distance. Each reported event illustrates a disruption mechanism; it did not occur on this SVEAB shipment. Decide what to ask, test assumptions, choose rail or truck, then see what remained uncertain.</p></div></div>
          {!event?<div className="event-grid">{SCENARIOS.map((c,i)=><article className="panel event-card" key={c.title}><div className="panel-top"><span>CASE 0{i+1}</span><span>{c.short}</span></div><h3>{c.title}</h3><p><b>Reported event:</b> {c.reported}</p><p className="source-note">{c.sourceNote}</p><p><b>Conditions applied to SVEAB:</b> {c.transfer}</p><p><b>Group question:</b> {c.question}</p><div className="case-links"><a href={c.source} target="_blank" rel="noopener noreferrer">{c.sourceLabel} ↗</a>{c.additionalSource&&<a href={c.additionalSource} target="_blank" rel="noopener noreferrer">{c.additionalLabel} ↗</a>}</div><button className="primary full" onClick={()=>chooseCase(i)}>WORK ON THIS CASE →</button></article>)}</div>:<>
            <div className="case-intro panel"><div className="panel-top"><span>{event.short}</span><button className="text-button" onClick={()=>patch({caseIndex:null,route:null,dispatched:false})}>CHANGE CASE</button></div><p><b>Reported event:</b> {event.reported}</p><p className="source-note">{event.sourceNote}</p><div className="case-links"><a href={event.source} target="_blank" rel="noopener noreferrer">{event.sourceLabel} ↗</a>{event.additionalSource&&<a href={event.additionalSource} target="_blank" rel="noopener noreferrer">{event.additionalLabel} ↗</a>}</div><p><b>Conditions applied to SVEAB:</b> {event.transfer}</p><p><b>Group question:</b> {event.question}</p><div className="uncertainty"><b>{s.revealed?"Unresolved when your group decided":"What is still uncertain?"}</b>{unresolved.map(u=><span key={u}>{u}</span>)}<p className="micro">{s.revealed?"The outcome was fixed before your decision. Compare it with what your calls could tell you.":"Calls give estimates or quotes. Your group’s final conditions are fixed now but stay hidden until you commit; the game does not change them to suit your choice."}</p></div>{testMode&&<div className="ta-outcome"><b>TA preview: choose a hidden outcome</b>{[0,1,2].map(i=><button key={i} className={s.outcomeIndex===i?"selected":""} disabled={!!s.callLogs.length||s.revealed} onClick={()=>patch({outcomeIndex:i})}>{["Mild","Middle","Severe"][i]}</button>)}</div>}</div>
            <div className="case-workspace">
              <div>
                <div className="panel"><div className="panel-top"><span>ASK FOR INFORMATION</span><span>{2-s.callLogs.length} OF 2 QUESTIONS LEFT</span></div><p>Choose the two questions most useful to your group. A response updates your planning estimate; a range or departure estimate can still be wrong. Calling does not book transport.</p><div className="inquiry-grid">{event.inquiries.map((q,index)=><button key={q.label} disabled={s.callLogs.length>=2||s.callLogs.some(log=>log.index===index)||s.actionBooked||s.revealed} onClick={()=>call(index)}><b>{q.label}</b><small>{q.purpose}</small></button>)}</div>{s.callLogs.map(log=>{const q=event.inquiries[log.index],response=q.responses[s.outcomeIndex],beforeRail=evaluate(log.before,"rail"),afterRail=evaluate(log.after,"rail"),beforeRoad=evaluate(log.before,"road"),afterRoad=evaluate(log.after,"road");return <div className="call-result" key={log.index}><b>{q.label}: information received</b><p>{response.text}</p><div className="call-impact"><div><span>Rail bill</span><b>{money(beforeRail.invoice)} → {money(afterRail.invoice)}</b></div><div><span>Truck bill</span><b>{money(beforeRoad.invoice)} → {money(afterRoad.invoice)}</b></div><div><span>Freight critical distance</span><b>{criticalLabel(criticalDistance(log.before))} → {criticalLabel(criticalDistance(log.after))}</b></div></div></div>})}<p className="micro">Changing an estimate with a slider is a sensitivity test; it does not turn that number into confirmed information.</p></div>
                {!s.revealed&&<div className="panel range-panel"><div className="panel-top"><span>PLAN WITH A RANGE</span><span>BEFORE DECIDING</span></div><p><b>{event.range.label}:</b> {rangeBounds[0]}–{rangeBounds[1]}{event.range.unit}. The current graph uses a planning estimate, while these bounds show what is still plausible.</p><p><b>Freight critical distance across those bounds:</b> {criticalRange.every(v=>v!==null)?[...criticalRange].sort((a,b)=>(a??0)-(b??0)).map(v=>criticalLabel(v)).join(" to "):criticalRange.map(v=>criticalLabel(v)).join(" to ")}.</p><p className="micro">This varies one uncertain input while holding the other current estimates fixed. It is a range of possible freight crossings, not a probability forecast. Waiting may change your route choice without moving the crossing.</p></div>}
                <div className="panel"><div className="panel-top"><span>TEST AN ASSUMPTION</span><span>ONE AT A TIME</span></div><p>Before moving a slider, discuss: will this change the freight cost line, the final bill, delivery feasibility, or several of these?</p><div className="prediction-buttons">{["Freight line","Final bill","Delivery feasibility","Several effects"].map(label=><button className={s.prediction===label?"selected":""} key={label} onClick={()=>patch({prediction:label})}>{label}</button>)}</div><div className="case-sliders">{controls.map(c=><div className={"case-slider "+(s.activeVariable===c.key?"selected":"")} key={c.key}><Slider label={c.label} value={s.inputs[c.key]*(c.scale??1)} min={c.min} max={c.max} step={c.step} unit={c.unit} disabled={!s.prediction||s.revealed} onChange={v=>testVariable(c.key,v/(c.scale??1))}/><small>{s.actionBooked?"Booked package value":"Case estimate"}: {c.unit===" min"&&workingBase[c.key]>=120/1440?timeLabel(workingBase[c.key]):c.unit===" days"?timeLabel(workingBase[c.key]):`${Math.round(workingBase[c.key]*(c.scale??1)*10)/10}${c.unit}`}</small></div>)}</div>{!s.prediction&&<p className="micro">Choose a prediction above to unlock the sliders.</p>}<p className="micro">Moving a second slider resets the first. A booked action stays in place until you undo it.</p><button className="text-button" disabled={s.revealed} onClick={()=>patch({activeVariable:null,inputs:{...workingBase,carbonPrice:s.inputs.carbonPrice,deadline:s.inputs.deadline},dispatched:false})}>RESET SINGLE-VARIABLE TEST</button>{s.prediction&&<details className="mechanism-guide"><summary>Which changes can move the freight critical distance?</summary><p>Tariffs, handling charges and charged kilometres move a freight line. Waiting, storage, a deadline and carbon valuation do not move this freight-only graph, but can change the preferred route.</p></details>}</div>
                {event.action&&<div className="panel action-panel"><div className="panel-top"><span>OPERATIONAL CHOICE</span><span>LINKED CONSEQUENCES</span></div><p>{event.action.explanation} These figures are hypothetical. A call supplies information; booking changes several variables together.</p>{!s.actionBooked?<button className="primary full" disabled={!s.callLogs.length||s.revealed} onClick={bookAction}>{s.callLogs.length?event.action.label.toUpperCase():"ASK ONE QUESTION BEFORE BOOKING"} →</button>:<><p><b>Booked for this exercise:</b> {event.action.label}. The group is now comparing this package with the original options.</p><div className="action-ledger">{(()=>{const basis=s.beforeAction||s.anchorInputs;const before=evaluate(basis,event.action!.route),after=evaluate({...basis,...event.action!.update},event.action!.route);return <><div><span>Freight charge</span><b>{money(before.freightInvoice)} → {money(after.freightInvoice)}</b></div><div><span>Final bill</span><b>{money(before.invoice)} → {money(after.invoice)}</b></div><div><span>Storage charge</span><b>{money(before.waitingCharge)} → {money(after.waitingCharge)}</b></div><div><span>Freight critical distance</span><b>{criticalLabel(criticalDistance(basis))} → {criticalLabel(criticalDistance({...basis,...event.action!.update}))}</b></div><div><span>Extra road kilometres</span><b>{event.action!.route==="rail"?basis.railExtraKm:basis.roadExtraKm} → {event.action!.route==="rail"?event.action!.update.railExtraKm??basis.railExtraKm:event.action!.update.roadExtraKm??basis.roadExtraKm} km</b></div><div><span>Additional time</span><b>{timeLabel(before.additionalDays)} → {timeLabel(after.additionalDays)}</b></div><div><span>Total delivery time</span><b>{timeLabel(before.days)} → {timeLabel(after.days)}</b></div><div><span>Emissions</span><b>{kg(before.co2kg)} → {kg(after.co2kg)}</b></div></>})()}</div><p className="micro">The freight charge may move its graph line; changes in waiting time only affect the bill or delivery feasibility.</p><button className="text-button" disabled={s.revealed} onClick={undoAction}>UNDO BOOKING</button></>}</div>}
                <div className="panel"><div className="panel-top"><span>DELIVERY AND CARBON</span><span>COMPANY ASSUMPTIONS</span></div><Slider label="Delivery deadline from dispatch" value={s.inputs.deadline} min={0} max={80} step={0.5} unit=" days" onChange={v=>policyChange({deadline:v})}/><Slider label="Internal carbon charge" value={s.inputs.carbonPrice} min={0} max={5000} step={100} unit=" SEK/t CO₂e" onChange={v=>policyChange({carbonPrice:v})}/><p className="micro">Teaching assumptions: 18 tonnes per container; normal time is 2 days by rail or 1 by truck. Electric rail is modelled at 4 g CO₂e/tonne-km and road at 70 g. Rail emissions include the two local road legs and any added road haul; truck includes the case's 20% repositioning. These are illustrative factors, not measured SVEAB emissions. Planning cargo value is {money(s.inputs.cargoValue)} (it may still be uncertain in this case). The illustrative capital rate is {s.inputs.holdingRate}%/year: cargo capital cost = cargo value × rate × total transit days ÷ 365. It is outside the carrier bill and recommendation.</p></div>
              </div>
              <div>
                <div className="panel"><div className="panel-top"><span>FREIGHT CRITICAL DISTANCE</span><span>RAIL VS TRUCK</span></div><CostPlot inputs={s.inputs}/>
                  <div className="route-score">{([rail,road] as NonNullable<typeof rail>[]).map(o=><div key={o.route}><h3>{o.route==="rail"?"Rail":"Truck"}</h3><div className="bill-lines"><span>Freight charge <b>{money(o.freightInvoice)}</b></span><span>Storage while waiting <b>{money(o.waitingCharge)}</b></span><span>Final carrier bill <b>{money(o.invoice)}</b></span><span>Internal carbon charge <b>{money(o.carbonCost)}</b></span></div><b>{money(o.decisionCost)} with carbon charge</b><span>Normal {timeLabel(o.normalDays)} + additional {timeLabel(o.additionalDays)} = total {timeLabel(o.days)}</span><span><strong>Emissions:</strong> {kg(o.co2kg)} CO₂e/container</span><span><strong>Illustrative cargo capital cost:</strong> {money(o.cargoHoldingCost)} during total transit (outside carrier bill)</span><small className={o.withinDeadline?"met":"missed"}>{o.withinDeadline?"Meets delivery deadline":"Misses delivery deadline"}</small></div>)}</div>
                  <div className="cost-breakdown"><b>The graph answers a freight-price question.</b><span>The carrier bill adds storage. Delivery time determines whether the route meets the deadline. Carbon and cargo capital cost are separate company assumptions. Waiting and carbon do not move the freight critical distance.</span></div>
                </div>
                <div className="panel"><Sensitivity inputs={s.inputs}/></div>
              </div>
            </div>
            <div className="panel decision-panel"><div className="panel-top"><span>YOUR GROUP DECISION</span><span>RAIL OR TRUCK</span></div><div className="decision-inner"><div>
              <h3>Choose the route</h3><p>Compare the carrier bill, total delivery time, deadline and emissions. Decide as a group before the final conditions are revealed. What would make you switch?</p>
              <div className="route-buttons">{([rail,road] as NonNullable<typeof rail>[]).map(o=><button key={o.route} className={s.route===o.route?"selected":""} disabled={s.dispatched} onClick={()=>chooseRoute(o.route)}><b>{o.route==="rail"?"Rail":"Truck"}</b><span>{money(o.invoice)} carrier bill</span><small>{timeLabel(o.days)} total · {kg(o.co2kg)} CO₂e/container</small></button>)}</div>
              <div className="ppt-question"><b>For your group PPT</b><p>Why choose this route? Which remaining uncertainty matters most? What result would make you switch, and what is your backup?</p></div>
              {!s.dispatched?<button className="primary" onClick={dispatch}>{s.revealed?"CONFIRM REVISED DECISION":"COMMIT AND REVEAL CONDITIONS"} →</button>:<div className="outcome"><h3>Conditions revealed</h3><p>{event.reveals[s.outcomeIndex].text}</p>
                {s.beforeReveal&&<div className="action-ledger reveal-ledger">{(()=>{const before=evaluate(s.beforeReveal!,s.route!),after=evaluate(s.inputs,s.route!);return <><div><span>Your route: carrier bill</span><b>{money(before.invoice)} → {money(after.invoice)}</b></div><div><span>Your route: total time</span><b>{timeLabel(before.days)} → {timeLabel(after.days)}</b></div><div><span>Your route: emissions</span><b>{kg(before.co2kg)} → {kg(after.co2kg)}</b></div><div><span>Freight critical distance</span><b>{criticalLabel(criticalDistance(s.beforeReveal!))} → {criticalLabel(criticalDistance(s.inputs))}</b></div><div><span>Rail bill after reveal</span><b>{money(evaluate(s.inputs,"rail").invoice)}</b></div><div><span>Truck bill after reveal</span><b>{money(evaluate(s.inputs,"road").invoice)}</b></div><div><span>Cargo capital cost on your route</span><b>{money(after.cargoHoldingCost)} outside bill</b></div></>})()}</div>}
                <div className="recommendation">{feasible.length?<><b>Lowest carrier bill plus optional carbon charge among routes meeting the deadline: {feasible[0].route==="rail"?"rail":"truck"}.</b><p>The model's cost check is {money(feasible[0].decisionCost)}. Compare it with your group's reason and the information available when you chose.</p></>:<><b>Neither route meets the deadline.</b><p>What delivery promise or contingency would your group negotiate?</p></>}</div>
                <details className="mechanism-guide"><summary>Optional: ASEK value of additional delay</summary><p>For this sensitivity only, use transport equipment in every case: {ASEK.equipment.rate.toFixed(4)} SEK per tonne-hour × 18 tonnes × 24 hours = {money(rail?.delayValue||0)} per extra day (2019 SEK, excluding VAT). These values are excluded from the bill and recommendation. SVEAB tariffs and ASEK values have different price years. <a href={ASEK_URL} target="_blank" rel="noopener noreferrer">Trafikverket ASEK table ↗</a></p></details>
                <button className="text-button" onClick={()=>patch({dispatched:false})}>RECONSIDER ROUTE</button></div>}
            </div><Scene route={s.route} dispatched={s.dispatched}/></div></div>
            {s.dispatched&&<div className="panel presentation-panel"><div className="panel-top"><span>CLASS DISCUSSION</span><span>{testMode?"TA TEST":emergencyMode?"EMERGENCY SESSION":"GROUP "+s.groupNumber}</span></div><h3>Present your group's case</h3><p>Explain the real event's mechanism, your hypothetical SVEAB conditions, the information you asked for, and how the reveal affected your decision.</p><div className="presentation-card"><div><b>Original critical distance</b><span>{base.critical.toFixed(1)} km</span></div><div><b>Your route</b><span>{s.route==="rail"?"Rail":"Truck"}{s.actionBooked&&event.action&&s.route===event.action.route?" with "+event.action.label.toLowerCase():""}</span></div><div><b>Your questions</b><span>{s.callLogs.map(log=>event.inquiries[log.index].label).join("; ")||"None"}</span></div><div><b>Unresolved at decision</b><span>{unresolved.join("; ")||"None listed"}</span></div></div><div className="ppt-question"><b>For your group PPT</b><p>Which estimate proved wrong? Would you change route after learning the outcome? What contingency could you arrange before the next shipment?</p></div></div>}
            <div className="panel sources-panel"><div className="panel-top"><span>SOURCES AND MODEL ASSUMPTIONS</span><span>CHECK THE NUMBERS</span></div><p><b>Reported event:</b> <a href={event.source} target="_blank" rel="noopener noreferrer">{event.sourceLabel} ↗</a>{event.additionalSource&&<> · <a href={event.additionalSource} target="_blank" rel="noopener noreferrer">{event.additionalLabel} ↗</a></>}. The SVEAB scenario figures, calls and post-decision outcomes are classroom assumptions.</p><p><b>Carrier charges:</b> Rail freight = (6.5 × (x + extra rail km) + 550) × (1 + rail premium) + two SEK 650 hauls + two SEK 240 lifts + any alternative-terminal fee. Truck freight = 9 × 1.2 × (x + 92 + road detour km) × (1 + booking premium + diesel rise × fuel share × share charged to SVEAB). Write percentages as fractions. Rail storage = extra waiting days × storage charge per day. The original SVEAB handout supplies the first rail and truck terms; all disruption terms are teaching assumptions.</p><p><b>Emissions:</b> 18 tonnes × distance × illustrative factor. Electric rail: 0.004 kg CO₂e/tonne-km; road: 0.070 kg. Rail adds the two road hauls; truck adds 20% repositioning. The <a href="https://www.eea.europa.eu/en/analysis/publications/rail-and-waterborne-best-for-low-carbon-motorised-transport" target="_blank" rel="noopener noreferrer">EEA comparison ↗</a> supports the modal direction; the <a href="https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025" target="_blank" rel="noopener noreferrer">UK government factors ↗</a> show how reported factors depend on vehicle and service. The exact game factors are simplified teaching values.</p><p><b>Cargo capital cost:</b> value × 12% annual rate × total transport days ÷ 365. The cargo value and 12% rate are exercise assumptions. <a href="https://bransch.trafikverket.se/contentassets/0e5777a6301e4134a6e8365fc20c0e0e/asek-8.0-2-april-2024.pdf" target="_blank" rel="noopener noreferrer">Trafikverket ASEK 8.0, §10.1 ↗</a> explains the capital-binding rationale for goods time. This cost is not a carrier charge.</p></div>
          </>}
        </section>}
        {error&&<div className="game-error" role="alert">{error}</div>}
        <footer className="footer"><span>SVEAB · RAIL OR ROAD?</span><span>Reported case facts are linked; SVEAB scenario outcomes are classroom assumptions.</span></footer>
      </div>
    </div>
  </main>;
}
