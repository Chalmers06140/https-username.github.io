"use client";

import { useEffect, useState } from "react";
import {apiUrl,groupServiceReady,siteUrl} from "./config";
import { ASEK, BASE_INPUTS, CASE, CASE_CONTROLS, SCENARIOS, baseline, pricedCriticalDistance, evaluate, kg, money, scenarioInputs, type Inputs, type Route } from "./model";
import { CostPlot, Field, RailPlot, Scene, Sensitivity, Slider } from "./parts";

type Stage = "start" | "calculate" | "case";
type Paper = { slope:string; intercept:string; railFixed:string; truckRate:string; critical:string };
type CallRecord = {index:number};
type GroupMember = {name:string;seat:number};
type State = {
  catalogVersion:number;
  stage:Stage; maxStage:number; participantId:string; name:string; groupNumber:number|null;
  pending:boolean; waitingFor:number; groupMembers:GroupMember[]; points:number[]; paper:Paper; calculated:boolean;
  caseIndex:number|null; inputs:Inputs; anchorInputs:Inputs; activeVariable:keyof Inputs|null;
  callLogs:CallRecord[]; outcomeIndex:number; beforeReveal:Inputs|null; revealed:boolean;
  route:Route|null; dispatched:boolean; comparisonMode:"single"|"combined"|null; showCaseAnswer:boolean;
};
const stages:Stage[]=["start","calculate","case"];
const labels=["Start","Task 2 · Calculate","Task 3 · Explore"];
const task2Questions=[
  "How did you draw the two SVEAB networks and calculate the critical distance?",
  "Which cost or assumption did you check most carefully, and which areas of Sweden are far enough from Finspång for intermodal transport to be worth considering?"
];
const scenarioQuestions=[
  "If you explored a scenario, what did you change and what happened to cost, delivery time, emissions or the break-even distance?",
  "What would make you switch between rail and truck?"
];
const initial:State={
  catalogVersion:9,
  stage:"start",maxStage:0,participantId:"",name:"",groupNumber:null,pending:false,waitingFor:0,groupMembers:[],
  points:[],paper:{slope:"",intercept:"",railFixed:"",truckRate:"",critical:""},calculated:false,
  caseIndex:null,inputs:BASE_INPUTS,anchorInputs:BASE_INPUTS,activeVariable:null,callLogs:[],outcomeIndex:1,beforeReveal:null,revealed:false,
  route:null,dispatched:false,comparisonMode:null,showCaseAnswer:false
};
function groupId(value:string|null){
  if(!value||!/^\d+$/.test(value))return null;
  const number=Number(value);
  return Number.isSafeInteger(number)&&number>0?number:null;
}
function workspaceUrl(group:number){
  const url=new URL(siteUrl(""));
  url.searchParams.set("group",String(group));
  return url.href;
}
const ASEK_URL="https://bransch.trafikverket.se/contentassets/0e5777a6301e4134a6e8365fc20c0e0e/asek-8.1-kalkylbilaga-4-maj-2026.xlsx";
function num(v:string){return Number(v.replace(",","."))}
function close(v:string,n:number,tolerance:number){return v.trim()!==""&&Math.abs(num(v)-n)<=tolerance}
function criticalLabel(value:number|null){return value===null?"No positive crossing":value.toFixed(1)+" km"}
function timeLabel(value:number){const minutes=Math.round(value*1440),hours=Math.floor(minutes/60),rest=minutes%60;return [hours&&`${hours} h`,rest&&`${rest} min`].filter(Boolean).join(" ")||"0 min"}
type Assignment={groupNumber:number|null;pending:boolean;waitingFor:number;members:GroupMember[];error?:string};
type InfoFact={key:keyof Inputs;label:string;unit:"time"|"money"|"percent"|"km"|"hourly"};
const INFO_FACTS:InfoFact[][][]=[
  [[{key:"railDelay",label:"Train wait",unit:"time"}],[{key:"truckPremium",label:"Truck premium",unit:"percent"},{key:"roadDelay",label:"Truck departure wait",unit:"time"}],[{key:"storage",label:"Storage rate",unit:"hourly"}]],
  [[{key:"truckPremium",label:"Truck quote increase for SVEAB",unit:"percent"}],[{key:"railDelay",label:"Rail wait",unit:"time"}]],
  [[{key:"roadExtraKm",label:"Road detour",unit:"km"},{key:"roadDelay",label:"Extra road time",unit:"time"}],[{key:"railDelay",label:"Rail terminal wait",unit:"time"},{key:"railExtraKm",label:"Extra local road haul",unit:"km"},{key:"railFee",label:"Terminal handling",unit:"money"}],[{key:"cargoValue",label:"Cargo value",unit:"money"}]],
  [[{key:"railDetourKm",label:"Rail diversion",unit:"km"}],[{key:"railDelay",label:"Rail slot wait",unit:"time"}],[{key:"truckPremium",label:"Truck premium",unit:"percent"}]]
];
function infoValue(fact:InfoFact,value:number){
  if(fact.unit==="time")return value*24<1?Math.round(value*1440)+" min":Math.round(value*24)+" h";
  if(fact.unit==="money")return money(value);
  if(fact.unit==="hourly")return `SEK ${value}/h`;
  return `${value}${fact.unit==="percent"?"%":" km"}`;
}

export default function Game({testMode=false,emergencyMode=false}:{testMode?:boolean;emergencyMode?:boolean}){
  const [workspaceGroup]=useState(()=>testMode||emergencyMode?null:groupId(new URLSearchParams(location.search).get("group")));
  const storageKey=testMode?"sveab-ta-test-v2":emergencyMode?"sveab-emergency-v1":workspaceGroup?`sveab-group-${workspaceGroup}`:"sveab-game-v4";
  const [s,setS]=useState<State>(()=>testMode?{...initial,participantId:"ta-test",name:"TA",groupNumber:-1,maxStage:2}:workspaceGroup?{...initial,stage:"calculate",groupNumber:workspaceGroup,maxStage:1}:emergencyMode?{...initial,maxStage:1}:initial);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [rosterNotice,setRosterNotice]=useState("");
  const [computerGroup,setComputerGroup]=useState("");
  const [copyStatus,setCopyStatus]=useState("");
  useEffect(()=>{
    try{
      const saved=localStorage.getItem(storageKey);
      if(saved){
        const parsed=JSON.parse(saved) as Partial<State>;
        const validCase=[4,5,6,7,8,9].includes(parsed.catalogVersion??0)&&typeof parsed.caseIndex==="number"&&parsed.caseIndex>=0&&parsed.caseIndex<SCENARIOS.length?parsed.caseIndex:null;
        const savedDistance=(parsed.catalogVersion??0)>=5&&Number.isFinite(parsed.inputs?.distance)&&Number(parsed.inputs?.distance)>=0&&Number(parsed.inputs?.distance)<=900?Number(parsed.inputs?.distance):BASE_INPUTS.distance;
        const keepCalculation=(parsed.catalogVersion??0)>=8;
        const resetScenario=!keepCalculation||(validCase===1&&parsed.catalogVersion!==9);
        const fresh=validCase===null?BASE_INPUTS:scenarioInputs(validCase,savedDistance);
        setS({
          ...initial,...parsed,catalogVersion:9,
          stage:!testMode&&!keepCalculation&&parsed.stage==="case"?"calculate":parsed.stage??(workspaceGroup?"calculate":"start"),
          calculated:keepCalculation&&!!parsed.calculated,
          showCaseAnswer:keepCalculation&&!!parsed.showCaseAnswer,
          caseIndex:validCase,
          comparisonMode:validCase===null?null:!resetScenario&&parsed.comparisonMode==="combined"?"combined":"single",
          participantId:testMode?"ta-test":emergencyMode||workspaceGroup?"":parsed.participantId||"",
          name:testMode?"TA":emergencyMode||workspaceGroup?"":parsed.name||"",
          groupNumber:testMode?-1:emergencyMode?null:workspaceGroup??parsed.groupNumber??null,
          groupMembers:emergencyMode||workspaceGroup?[]:parsed.groupMembers??[],
          maxStage:testMode?2:emergencyMode||workspaceGroup||parsed.groupNumber||(parsed.maxStage??0)>=1?1:0,
          inputs:resetScenario?fresh:{...BASE_INPUTS,...(validCase===null?{}:parsed.inputs),scenario:validCase??0,distance:savedDistance},
          anchorInputs:resetScenario?fresh:{...BASE_INPUTS,...(validCase===null?{}:parsed.anchorInputs),scenario:validCase??0,distance:savedDistance},
          activeVariable:resetScenario?null:parsed.activeVariable??null,
          beforeReveal:resetScenario?null:parsed.beforeReveal??null,
          callLogs:resetScenario?[]:parsed.callLogs??[],
          revealed:!resetScenario&&!!parsed.revealed,
          dispatched:!resetScenario&&!!parsed.dispatched,
          route:resetScenario?null:parsed.route??null,
          outcomeIndex:resetScenario?testMode?1:Math.floor(Math.random()*3):parsed.outcomeIndex??1
        });
      }else if(!testMode&&!emergencyMode&&!workspaceGroup){
        const old=localStorage.getItem("sveab-game-v3")||localStorage.getItem("sveab-game-v2");
        if(old){
          const prior=JSON.parse(old) as {participantId?:string;name?:string};
          if(prior.participantId)setS({...initial,participantId:prior.participantId,name:prior.name||"",pending:true});
        }
      }
    }catch{}
    setReady(true);
  },[testMode,emergencyMode,workspaceGroup,storageKey]);
  useEffect(()=>{if(ready)localStorage.setItem(storageKey,JSON.stringify(s))},[s,ready,storageKey]);
  useEffect(()=>{if(ready)window.scrollTo({top:0,behavior:"instant"})},[ready,s.stage]);
  useEffect(()=>{
    if(!ready||testMode||emergencyMode||!s.participantId)return;
    let alive=true;
    let timer:number|undefined;
    const controller=new AbortController();
    let previousGroup=s.groupNumber;
    let previouslyPending=s.pending;
    async function check(){
      try{
        const response=await fetch(apiUrl("/api/join?id="+encodeURIComponent(s.participantId)),{cache:"no-store",signal:controller.signal});
        if(response.status===404){
          if(alive){
            setRosterNotice("Your registration is no longer on the roster. Check with the TA before joining again.");
            setS(old=>({...old,participantId:"",groupNumber:null,pending:false,waitingFor:0,groupMembers:[]}));
          }
          return;
        }
        if(!response.ok)return;
        const data=await response.json() as Assignment;
        if(!alive)return;
        if(previousGroup!==null&&data.groupNumber!==null&&previousGroup!==data.groupNumber){
          setRosterNotice(`Your roster assignment changed from Group ${previousGroup} to Group ${data.groupNumber}. Check in with your new group or ask the TA.`);
        }else if(previousGroup!==null&&data.pending&&!previouslyPending){
          setRosterNotice("Your group is forming again. Your work on this device is still available. Check with the TA if you were already working together.");
        }else if(!data.pending&&previouslyPending){
          setRosterNotice("");
        }
        previousGroup=data.groupNumber??previousGroup;
        previouslyPending=data.pending;
        setS(old=>{
          const members=data.members??[];
          if(old.groupNumber===data.groupNumber&&old.pending===data.pending&&old.waitingFor===data.waitingFor&&old.groupMembers.length===members.length&&old.groupMembers.every((m,i)=>m.name===members[i].name&&m.seat===members[i].seat))return old;
          return {...old,groupNumber:data.groupNumber,pending:data.pending,waitingFor:data.waitingFor,groupMembers:members,maxStage:data.groupNumber?Math.max(old.maxStage,1):old.maxStage};
        });
      }catch{
        // Keep the last assignment while the roster service is temporarily unavailable.
      }finally{
        if(alive)timer=window.setTimeout(()=>void check(),4000);
      }
    }
    void check();
    return ()=>{alive=false;controller.abort();clearTimeout(timer)};
  },[ready,s.participantId,testMode,emergencyMode]);
  const patch=(p:Partial<State>)=>setS(old=>({...old,...p}));
  const event=s.caseIndex===null?null:SCENARIOS[s.caseIndex];
  const base=baseline(0);
  const rail=event?evaluate(s.inputs,"rail"):null,road=event?evaluate(s.inputs,"road"):null;
  const routes=[rail,road].filter((result):result is NonNullable<typeof result>=>result!==null);
  const feasible=routes.filter(result=>result.withinDeadline).sort((a,b)=>a.decisionCost-b.decisionCost);
  const callLimit=Math.max(1,(event?.inquiries.length??2)-1);
  const controls=s.caseIndex===null?[]:CASE_CONTROLS[s.caseIndex];
  const infoFacts=s.caseIndex===null?[]:INFO_FACTS[s.caseIndex];
  const workingBase=s.anchorInputs;
  const changedControls=controls.filter(control=>Math.abs(s.inputs[control.key]-workingBase[control.key])>1e-9);
  const observedEffects=(()=>{
    if(!s.activeVariable)return [] as string[];
    const before={...workingBase,distance:s.inputs.distance,carbonPrice:s.inputs.carbonPrice,deadline:s.inputs.deadline};
    const routes:Route[]=["rail","road"];
    const differs=(a:number,b:number)=>Math.abs(a-b)>0.01;
    const graph=routes.some(route=>[0,900].some(distance=>{
      const old=evaluate({...before,distance},route),now=evaluate({...s.inputs,distance},route);
      return differs(old.freightInvoice+old.carbonCost,now.freightInvoice+now.carbonCost);
    }));
    const bill=routes.some(route=>differs(evaluate(before,route).invoice,evaluate(s.inputs,route).invoice));
    const time=routes.some(route=>differs(evaluate(before,route).days,evaluate(s.inputs,route).days));
    const emissions=routes.some(route=>differs(evaluate(before,route).co2kg,evaluate(s.inputs,route).co2kg));
    return [graph&&"price graph",bill&&"carrier bill",time&&"delivery time",emissions&&"emissions"].filter((value):value is string=>!!value);
  })();
  const checks=[
    {label:"Rail quote per added kilometre",your:s.paper.slope,correct:base.railSlope+" SEK/km",good:close(s.paper.slope,base.railSlope,0.05)},
    {label:"Rail quote starting price",your:s.paper.intercept,correct:"550 SEK",good:close(s.paper.intercept,550,1)},
    {label:"Full intermodal starting price",your:s.paper.railFixed,correct:money(base.railIntercept),good:close(s.paper.railFixed,base.railIntercept,2)},
    {label:"Truck price per added kilometre",your:s.paper.truckRate,correct:base.roadSlope.toFixed(1)+" SEK/km",good:close(s.paper.truckRate,base.roadSlope,0.05)},
    {label:"Break-even distance",your:s.paper.critical,correct:base.critical.toFixed(1)+" km",good:close(s.paper.critical,base.critical,2)}
  ];
  const calculationPassed=s.calculated&&checks.every(check=>check.good);
  const canExplore=calculationPassed||(s.calculated&&s.showCaseAnswer);
  const hints=[
    !checks[0].good&&"Divide the change in price by the change in kilometres between your two quotes.",
    !checks[1].good&&"Take either rail quote and subtract the per-kilometre rate multiplied by that quote’s distance.",
    !checks[2].good&&"Add two local hauls and two transhipments to the rail quote starting price, not to direct truck.",!checks[3].good&&"Apply the 20% repositioning allowance to the whole direct truck journey, including the two road connections.",!checks[4].good&&"Set the complete intermodal and direct-truck formulas equal, then solve for the distance between rail terminals."].filter(Boolean);

  function go(target:Stage){
    if(testMode){patch({stage:target});setError("");return}
    if(target==="calculate"&&!s.groupNumber&&!emergencyMode&&s.maxStage<1){setError("Wait until your group has at least three members.");return}
    if(target==="case"&&!canExplore){setError("Check your Task 2 answers. You can continue when they pass or after reviewing the worked solution.");return}
    if(target!=="case"&&stages.indexOf(target)>s.maxStage){setError("Finish this step before moving on.");return}
    patch({stage:target});setError("");
  }
  async function join(){
    const name=s.name.trim().replace(/\s+/g," ");
    if(!name){setError("Enter a first name or nickname to join the seminar.");return}
    setBusy(true);setError("");setRosterNotice("");
    try{
      const id=s.participantId||crypto.randomUUID();
      const response=await fetch(apiUrl("/api/join"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,name})});
      const data=await response.json() as Assignment;
      if(!response.ok)throw Error(data.error||"Could not join the seminar.");
      patch({participantId:id,name,groupNumber:data.groupNumber,pending:data.pending,waitingFor:data.waitingFor,groupMembers:data.members??[],maxStage:data.groupNumber?1:0});
    }catch(e){setError(e instanceof Error?e.message:"Could not join the seminar.")}
    finally{setBusy(false)}
  }
  function openWorkspace(){
    const group=groupId(computerGroup.trim());
    if(group===null){setError("Enter the group number shown on a team member’s phone.");return}
    location.assign(workspaceUrl(group));
  }
  async function copyWorkspaceLink(group:number){
    try{
      await navigator.clipboard.writeText(workspaceUrl(group));
      setCopyStatus(`Group ${group} link copied.`);
    }catch{
      setCopyStatus("You can also enter the group number on your computer.");
    }
  }
  function selectPoint(index:number){
    const points=s.points.includes(index)?s.points.filter(n=>n!==index):s.points.length<2?[...s.points,index]:[s.points[1],index];
    patch({points,calculated:false,showCaseAnswer:false});setError("");
  }
  function setPaper(key:keyof Paper,value:string){patch({paper:{...s.paper,[key]:value},calculated:false,showCaseAnswer:false})}
  function submitCalculation(){
    if(s.points.length!==2){setError("Click two different dots on the rail quote line. Their prices will appear below the graph.");return}
    const p=s.paper;
    if(![p.slope,p.intercept,p.railFixed,p.truckRate,p.critical].every(v=>v.trim()!==""&&Number.isFinite(num(v)))){
      setError("Enter all five numerical answers.");return;
    }
    patch({calculated:true,showCaseAnswer:false});setError("");
  }
  function chooseCase(index:number,reset=false){
    const inputs=scenarioInputs(index,BASE_INPUTS.distance);
    patch({caseIndex:index,inputs,anchorInputs:inputs,activeVariable:null,callLogs:[],outcomeIndex:reset?s.outcomeIndex:testMode?1:Math.floor(Math.random()*3),beforeReveal:null,revealed:false,route:null,dispatched:false,comparisonMode:"single"});
    setError("");
    if(!reset)window.scrollTo({top:0,behavior:"instant"});
  }
  function confirmInformation(index:number){
    if(!event||s.callLogs.length>=callLimit||s.callLogs.some(log=>log.index===index)||s.revealed)return;
    const response=event.inquiries[index].responses[s.outcomeIndex];
    const before={...s.anchorInputs,distance:s.inputs.distance,carbonPrice:s.inputs.carbonPrice,deadline:s.inputs.deadline};
    const update=Object.fromEntries(infoFacts[index].map(fact=>[fact.key,response.update[fact.key]])) as Partial<Inputs>;
    const after={...before,...update};
    patch({inputs:after,anchorInputs:after,activeVariable:null,callLogs:[...s.callLogs,{index}],route:null,dispatched:false});
  }
  function testVariable(key:keyof Inputs,value:number){
    const inputs=s.comparisonMode==="combined"?{...s.inputs,[key]:value}:{...workingBase,distance:s.inputs.distance,carbonPrice:s.inputs.carbonPrice,deadline:s.inputs.deadline,[key]:value};
    patch({activeVariable:key,inputs,dispatched:false});
  }
  function switchComparisonMode(mode:"single"|"combined"){
    const inputs=mode==="single"?{...workingBase,distance:s.inputs.distance,carbonPrice:s.inputs.carbonPrice,deadline:s.inputs.deadline}:s.inputs;
    patch({comparisonMode:mode,inputs,activeVariable:mode==="single"?null:s.activeVariable,dispatched:false});
  }
  function setDistance(value:number){
    if(!Number.isFinite(value)||value<0||value>900||s.revealed)return;
    patch({inputs:{...s.inputs,distance:value},anchorInputs:{...s.anchorInputs,distance:value},dispatched:false});
  }
  function chooseRoute(route:Route){patch({route,dispatched:false})}
  function policyChange(update:Partial<Inputs>){patch({inputs:{...s.inputs,...update},dispatched:false})}
  function dispatch(){
    if(!s.route){setError("Choose rail or truck.");return}
    if(!s.revealed&&s.callLogs.length===0){setError("Confirm at least one information item before choosing your route.");return}
    if(!event)return;
    if(!s.revealed){
      const update=event.reveals[s.outcomeIndex].update;
      const realized={...s.inputs,...update};
      patch({dispatched:true,revealed:true,beforeReveal:s.inputs,inputs:realized,anchorInputs:realized});
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
        {workspaceGroup&&<div className="group-roster"><b>Group {workspaceGroup} worksheet</b><span>One person enters Task 2. Work is saved in this browser.</span></div>}
        {rosterNotice&&<div className="bridge-note" role="status">{rosterNotice}</div>}
        {s.stage==="start"&&<section className="hero-grid"><div className="hero-copy">
          <div className="eyebrow">STEP 1 · SET UP THE SVEAB CASE</div><h1>Rail or <em>road?</em></h1>
          <p>SVEAB buys goods from suppliers across Sweden. First calculate the critical distance from the CDIT handout. Then explore how a disruption might change the transport decision.</p>
          <div className="brief-box"><b>Your first task</b><span>Draw the truck and intermodal networks on paper. Mark the supplier, rail terminals, Norrköping and Finspång. Add kilometres and costs to each leg.</span></div>
          <div className="panel join-panel">{workspaceGroup?<><h3>Group {workspaceGroup} worksheet</h3><p>Choose one person to enter Task 2 on this computer. The group’s worksheet is saved in this browser.</p><button className="primary" onClick={()=>go("calculate")}>Open Task 2 →</button><a className="ta-test-link" href={siteUrl("")}>Return to seminar registration</a></>:testMode?<><h3>TA test mode</h3><p>Explore the exercise without joining a student group or changing the roster. You can jump between the three sections.</p><a className="teacher-link dark-link" href={siteUrl("teacher/")}>Back to the TA roster ↗</a><button className="primary next-button" onClick={()=>go("calculate")}>START TASK 2 →</button></>:emergencyMode?<><h3>Start without joining a group</h3><p>This link skips the name and group assignment. Ask your TA which group to work with, then use the same SVEAB case and disruption game.</p><button className="primary next-button" onClick={()=>go("calculate")}>START TASK 2 →</button></>:<><h3>Find your seminar group</h3><p>Enter your first name or a nickname. The game forms one group at a time. Your group number appears once at least three students have joined; you can see the group members above.</p>{!groupServiceReady&&<p className="game-error-inline">Group assignment needs the group service. <a href={siteUrl("emergency/")}>Open the emergency game</a> until your TA has set it up.</p>}
            <label className="field"><span>First name or nickname</span><input type="text" maxLength={60} disabled={!!s.participantId} value={s.name} onChange={e=>patch({name:e.target.value})} placeholder="e.g. Alex"/></label>
            {s.groupNumber?<div className="group-ticket"><b>GROUP {s.groupNumber}</b><span>Meet your group in class. Choose one person to enter and check Task 2 on your group’s computer.</span></div>:s.pending?<div className="group-ticket forming"><b>GROUP FORMING</b><span>{s.waitingFor===1?"Waiting for one more student.":"Waiting for "+s.waitingFor+" more students."} Your group number will appear automatically.</span></div>:<button className="primary" onClick={join} disabled={busy}>{busy?"JOINING…":"JOIN THE SEMINAR →"}</button>}
            {s.groupNumber&&<div className="handoff-actions">
              <a className="primary" href={workspaceUrl(s.groupNumber)}>Use this device for Task 2 →</a>
              <button className="text-button" onClick={()=>void copyWorkspaceLink(s.groupNumber!)}>Copy group link</button>
            </div>}
            {s.groupNumber&&<p className="micro">On your group’s computer, open the copied link or enter Group {s.groupNumber} on the same home page.</p>}
            {copyStatus&&<p role="status">{copyStatus}</p>}
            <details className="computer-entry">
              <summary>Already registered? Open your group worksheet</summary>
              <form onSubmit={e=>{e.preventDefault();openWorkspace()}}>
                <label className="field"><span>Group number</span><input type="text" inputMode="numeric" value={computerGroup} onChange={e=>setComputerGroup(e.target.value)} placeholder="e.g. 4" required/></label>
                <button className="primary">Open group worksheet →</button>
              </form>
              <p className="micro">Use the number shown on a group member’s phone. The worksheet is saved in the browser where you enter it.</p>
            </details>
            <a className="ta-test-link" href={siteUrl("emergency/")}>Group joining not working? Use the emergency game ↗</a></>}
          </div>
        </div><div className="hero-visual"><Scene route={null} dispatched={false}/><div className="visual-sticker"><b>ONE CONTAINER</b><small>Two routes. One group decision.</small></div></div></section>}
        {s.stage==="calculate"&&<section>
          <div className="section-head"><div><div className="eyebrow">STEP 2 · ORIGINAL SVEAB EXERCISE</div><h1>Task 2: Critical distance for intermodal transport</h1><p>Work out the routes and costs together. Choose one person to enter and check the group’s answers.</p></div></div>
          <div className="panel task-brief">
            <h2>Build your comparison</h2>
            <p>The CDIT handout gives you the SVEAB story. The distances and prices below are the shared Data Set 1 inputs for Task 2 and the class discussion.</p>
            <div className="task-brief-grid">
              <div>
                <h3>2a. Rail Combi and the full intermodal route</h3>
                <p>Choose two quotes on the graph to estimate the price per added kilometre and the starting price of the rail leg. Work out a price rule for the full route, including the local road hauls and transfers at both ends.</p>
                <ul>
                  <li>Local container haulage costs <b>SEK {CASE.haulage}</b> per haul.</li>
                  <li>Transhipment (moving the container between modes) costs <b>SEK {CASE.lift}</b> per transfer.</li>
                </ul>
              </div>
              <div>
                <h3>2b. Direct truck</h3>
                <p>Use the same distance between the terminals when you compare the two routes. Build a truck price rule that includes the actual distance driven.</p>
                <ul>
                  <li>Supplier to the departure terminal is <b>{CASE.supplierKm} km</b>. Norrköping terminal to Finspång is <b>{CASE.destinationKm} km</b>.</li>
                  <li>Direct truck costs <b>SEK {CASE.truckRate} per km driven</b>. Allow <b>{Math.round((CASE.reposition-1)*100)}% extra distance</b> for repositioning in the balanced truck flow.</li>
                </ul>
              </div>
              <div>
                <h3>2c. The break-even distance</h3>
                <p>Find the distance between terminals where your two full-route prices are equal. On a map of Sweden, identify areas far enough from Finspång for intermodal transport to be worth considering.</p>
              </div>
            </div>
            <details><summary>Before you calculate, sketch the two routes</summary><p>Mark the supplier, the rail terminals, Norrköping and Finspång. Trace the journey of the container by intermodal transport and by direct truck. Label where distance is driven and where a charge is added. Keep this sketch for your group slides.</p></details>
          </div>
          <div className="calc-grid">
            <div className="panel"><div className="panel-top"><span>RAIL COMBI QUOTE LINE</span><span>CLICK TWO POINTS</span></div><RailPlot chosen={s.points} onChoose={selectPoint}/></div>
            <div className="panel"><div className="panel-top"><span>YOUR CALCULATION</span><span>DATA SET 1</span></div>
              <div className="entry-grid">
                <Field label="2a. Rail quote per added kilometre" hint="Use the difference in price between your two quotes." value={s.paper.slope} unit="SEK/km" onChange={v=>setPaper("slope",v)}/>
                <Field label="2a. Rail quote starting price" hint="What would the rail leg alone cost at 0 km?" value={s.paper.intercept} unit="SEK" onChange={v=>setPaper("intercept",v)}/>
                <Field label="2a. Full intermodal starting price" hint="At 0 km by rail, what do the starting quote, local hauls and transfers add up to?" value={s.paper.railFixed} unit="SEK" onChange={v=>setPaper("railFixed",v)}/>
                <Field label="2b. Truck price per added kilometre" hint="Add the extra driving allowance to the price for each kilometre of the shared distance." value={s.paper.truckRate} unit="SEK/km" onChange={v=>setPaper("truckRate",v)}/>
                <Field label="2c. Break-even distance" hint="Enter the distance between terminals where both full routes cost the same." value={s.paper.critical} unit="km" onChange={v=>setPaper("critical",v)}/>
              </div>
              <button className="primary full" onClick={submitCalculation}>CHECK ANSWERS</button>
              {s.calculated&&<div className="calculation-feedback" aria-live="polite">
                <h3>{calculationPassed?"Your answers check out":"Review your calculation"}</h3>
                <div className="answer-head"><span>Item</span><span>Your answer</span><span>Check</span></div>
                {checks.map(c=><div className={"answer-row "+(c.good?"right":"review")} key={c.label}><span>{c.good?"✓ ":"Check "}{c.label}</span><span>{c.your}</span><b>{s.showCaseAnswer?c.correct:c.good?"Looks right":"Review"}</b></div>)}
                {!s.showCaseAnswer&&hints.length>0&&<div className="hint-box"><b>Hints</b>{hints.map(h=><p key={String(h)}>{h}</p>)}</div>}
                {!s.showCaseAnswer&&<button className="text-button" onClick={()=>patch({showCaseAnswer:true})}>REVIEW WORKED SOLUTION</button>}
                {s.showCaseAnswer&&<p>Rail Combi quote: 6.5x + 550. Complete intermodal charge: 6.5x + 550 + 2(650) + 2(240). Direct truck: 9 × 1.2 × (x + 50 + 42). The full routes cost the same at x = {base.critical.toFixed(1)} km.</p>}
                {canExplore&&<button className="primary full" onClick={()=>go("case")}>GO TO NEXT STEP →</button>}
              </div>}
              <div className="ppt-question"><b>Class discussion · Group PPT</b>{task2Questions.map(question=><p key={question}>{question}</p>)}</div>
              <p className="micro source-foot">Source: CDIT case handout, Data Set 1, and the Task 2 teaching guide.</p>
            </div>
          </div>
        </section>}
        {s.stage==="case"&&<section>
          <div className="section-head">
            <div>
              <div className="eyebrow">STEP 3 · OPTIONAL EXPLORATION</div>
              <h1>{event?event.title:"Explore a scenario"}</h1>
              <p>{event?"Try one change and see whether you would still choose the same route. You can also try a route decision with information still missing.":"Pick a question your group is curious about. Explore at your own pace. There is no score or result to submit."}</p>
            </div>
          </div>
          {!event?<>
            <details className="panel variable-glossary">
              <summary>Glossary of scenario variables</summary>
              <dl>
                <dt>Shipment distance</dt><dd>The distance between the rail terminals used to compare both routes. The two local road legs are added separately.</dd>
                <dt>Break-even distance</dt><dd>The distance where the two price lines cross. The dashed lines compare the original freight prices. The solid lines compare current freight prices plus any internal carbon charge.</dd>
                <dt>Truck quote increase for SVEAB</dt><dd>The percentage the truck carrier adds to the original trucking price charged to SVEAB. A 10% increase adds SEK 100 to a SEK 1,000 quote.</dd>
                <dt>Truck booking or capacity premium</dt><dd>An extra percentage charged when trucks are scarce.</dd>
                <dt>Detour and terminal wait</dt><dd>Extra kilometres on the journey and extra time before the train or truck can depart. Waiting for rail may also add storage charges.</dd>
                <dt>Delivery deadline</dt><dd>The time SVEAB allows from dispatch to delivery.</dd>
                <dt>Internal carbon charge</dt><dd>The cost SVEAB assigns to a tonne of CO₂e when comparing routes. The carrier bills SVEAB separately for transport and storage.</dd>
              </dl>
            </details>
            <div className="event-grid">
              {SCENARIOS.map((scenario,index)=><article className="panel event-card" key={scenario.title}>
                <div className="panel-top"><span>{scenario.short}</span></div>
                <h3>{scenario.title}</h3>
                <p>{scenario.question}</p>
                <button className="primary full" onClick={()=>chooseCase(index)}>Explore {scenario.title}</button>
              </article>)}
            </div>
          </>:<>
            <div className="case-intro panel">
              <div className="scenario-actions">
                <button className="text-button" onClick={()=>chooseCase(s.caseIndex!,true)}>Reset scenario</button>
                <button className="text-button" onClick={()=>{patch({caseIndex:null,route:null,dispatched:false});window.scrollTo({top:0,behavior:"instant"})}}>Choose another scenario</button>
              </div>
              <h3>{event.question}</h3>
              <p>{event.transfer}</p>
              <details>
                <summary>Reported event and sources</summary>
                <p>{event.reported}</p>
                <p>{event.sourceNote}</p>
                <div className="case-links"><a href={event.source} target="_blank" rel="noopener noreferrer">{event.sourceLabel} ↗</a>{event.additionalSource&&<a href={event.additionalSource} target="_blank" rel="noopener noreferrer">{event.additionalLabel} ↗</a>}</div>
              </details>
            </div>
            <div className="case-workspace">
              <div className="case-controls">
                <div className="panel"><div className="panel-top"><span>CHOOSE A SHIPMENT DISTANCE</span><span>USE YOUR TASK 2 RESULT</span></div><Slider label="Distance between Rail Combi terminals" value={s.inputs.distance} min={0} max={900} step={0.1} unit=" km" disabled={s.revealed} onChange={setDistance}/><button className="text-button" disabled={s.revealed} onClick={()=>setDistance(BASE_INPUTS.distance)}>USE ORIGINAL CRITICAL DISTANCE ({base.critical.toFixed(1)} KM)</button><p className="micro">Changing this shipment’s distance changes its bills and emissions. It does not move the critical distance, which is the point where the two price lines cross.</p></div>
                <div className="panel"><div className="panel-top"><span>CHANGE AN ASSUMPTION</span></div>
                  <p>Predict what will happen, then move a slider and compare the routes.</p>
                  <div className="case-sliders">{controls.map(c=><div className={"case-slider "+(changedControls.some(changed=>changed.key===c.key)?"selected":"")} key={c.key}><Slider label={c.label} value={s.inputs[c.key]*(c.scale??1)} min={c.min} max={c.max} step={c.step} unit={c.unit} disabled={s.revealed} onChange={v=>testVariable(c.key,v/(c.scale??1))}/><small>Case estimate: {c.unit===" min"&&workingBase[c.key]>=120/1440?timeLabel(workingBase[c.key]):c.unit===" days"?timeLabel(workingBase[c.key]):`${Math.round(workingBase[c.key]*(c.scale??1)*10)/10}${c.unit}`}</small></div>)}</div>
                  {s.activeVariable&&<div className="test-feedback"><b>{changedControls.length?`Changed: ${changedControls.map(c=>c.label.toLowerCase()).join(", ")}`:"At the case estimate"}</b><span>Compared with the case estimate, these settings change: {observedEffects.length?observedEffects.join(", "):"nothing yet"}. Check the graph and bills beside the sliders.</span></div>}
                  {s.revealed?<p className="micro">The controls show the revealed values. Reset the scenario to try different assumptions again.</p>:<button className="text-button" onClick={()=>patch({activeVariable:null,inputs:{...workingBase,distance:s.inputs.distance,carbonPrice:s.inputs.carbonPrice,deadline:s.inputs.deadline},dispatched:false})}>Restore assumption values</button>}
                  <details className="mechanism-guide">
                    <summary>Combine assumptions</summary>
                    <p>Use one change at a time to see its effect. Switch to combined changes to keep earlier slider adjustments.</p>
                    <div className="comparison-mode-buttons"><button className={s.comparisonMode==="single"?"selected":""} aria-pressed={s.comparisonMode==="single"} disabled={s.revealed} onClick={()=>switchComparisonMode("single")}>One change at a time</button><button className={s.comparisonMode==="combined"?"selected":""} aria-pressed={s.comparisonMode==="combined"} disabled={s.revealed} onClick={()=>switchComparisonMode("combined")}>Combine changes</button></div>
                  </details>
                </div>
                <details className="panel variable-glossary">
                  <summary>Change the deadline or carbon charge</summary>
                  <Slider label="Delivery deadline from dispatch" value={s.inputs.deadline*24} min={0} max={336} step={4} unit=" h" onChange={v=>policyChange({deadline:v/24})}/>
                  <Slider label="Internal carbon charge" value={s.inputs.carbonPrice} min={0} max={5000} step={100} unit=" SEK/t CO₂e" onChange={v=>policyChange({carbonPrice:v})}/>
                </details>
              </div>
              <div className="case-results">
                <div className="panel live-results"><div className="panel-top"><span>PRICE AND CRITICAL DISTANCE</span><span>RAIL VS TRUCK</span></div><CostPlot inputs={s.inputs}/>
                  <div className="route-score">
                    {routes.map(result=><div key={result.route}>
                      <h3>{result.route==="rail"?"Rail":"Truck"}</h3>
                      <b>{money(result.invoice)}</b><span>Carrier bill</span>
                      <span><strong>Delivery:</strong> {timeLabel(result.days)}</span>
                      <span><strong>Emissions:</strong> {kg(result.co2kg)} CO₂e/container</span>
                      <small className={result.withinDeadline?"met":"missed"}>{result.withinDeadline?"Meets delivery deadline":"Misses delivery deadline"}</small>
                      <details className="route-breakdown">
                        <summary>Cost and time details</summary>
                        <div className="bill-lines">
                          <span>Freight charge <b>{money(result.freightInvoice)}</b></span>
                          <span>Storage while waiting <b>{money(result.waitingCharge)}</b></span>
                          <span>Internal carbon charge <b>{money(result.carbonCost)}</b></span>
                          <span>Bill plus carbon charge <b>{money(result.decisionCost)}</b></span>
                          <span>Cargo capital cost <b>{money(result.cargoHoldingCost)}</b></span>
                        </div>
                        <span>Normal {timeLabel(result.normalDays)} + additional {timeLabel(result.additionalDays)} = {timeLabel(result.days)} total.</span>
                        <span>Cargo capital cost is outside the carrier bill.</span>
                      </details>
                    </div>)}
                  </div>
                </div>
                <details className="panel sensitivity-details"><summary>Compare one-variable changes</summary><Sensitivity inputs={s.inputs}/></details>
              </div>
            </div>
              <details className="panel decision-exercise" key={s.caseIndex} open={testMode||s.revealed||undefined}>
                <summary>Try a route decision with uncertainty</summary>
             <div className="case-followup">
                <div className="panel info-choice-panel"><div className="panel-top"><span>CHOOSE WHAT TO KNOW</span><span>{s.callLogs.length} OF {callLimit} CONFIRMED</span></div>
                  <p>{s.revealed?"These are the values now known after your group chose a route. Compare them with the ranges you accepted.":"Choose what to confirm before choosing rail or truck. The items you leave unconfirmed stay as ranges. Their exact values appear only after your group commits to a route."}</p>
                  {testMode&&<div className="ta-outcome"><b>TA preview · Choose an outcome</b>{[0,1,2].map(i=><button key={i} className={s.outcomeIndex===i?"selected":""} disabled={!!s.callLogs.length||s.revealed} onClick={()=>patch({outcomeIndex:i})}>{["Mild","Middle","Severe"][i]}</button>)}</div>}
                  <div className="info-choice-grid">{event.inquiries.map((item,index)=>{const confirmed=s.callLogs.some(log=>log.index===index);return <div className={"info-choice "+(confirmed?"confirmed":"")} key={item.label}><b>{item.label}</b><small>{item.purpose}</small><div className="info-values">{infoFacts[index].map(fact=>{const possible=event.reveals.map(outcome=>outcome.update[fact.key]).filter((value):value is number=>typeof value==="number");const value=confirmed||s.revealed?infoValue(fact,s.revealed?s.inputs[fact.key]:s.anchorInputs[fact.key]):`${infoValue(fact,Math.min(...possible))} to ${infoValue(fact,Math.max(...possible))}`;return <span key={fact.key}><strong>{fact.label}</strong> {value}</span>})}</div>{!confirmed&&!s.revealed&&<button className="text-button" disabled={s.callLogs.length>=callLimit} onClick={()=>confirmInformation(index)}>CONFIRM THIS INFORMATION</button>}{confirmed&&<em>CONFIRMED BEFORE DECISION</em>}</div>})}</div>
                  <p className="micro">{s.revealed?"The graph and bills now show the revealed values.":"The graph and bills use planning values for unconfirmed items. Opening a scenario draws a hidden outcome. Resetting it lets you replay the same outcome with different choices. The sliders let you test assumptions."}</p>
                </div>
            </div>
            <div className="panel decision-panel"><div className="panel-top"><span>YOUR GROUP DECISION</span><span>RAIL OR TRUCK</span></div><div className="decision-inner"><div>
              <h3>Choose the route</h3><p>Compare the carrier bill, delivery and emissions. Choose the route you would book with the information you have, then see if you would still make that choice once the remaining values are revealed.</p>
              <div className="route-buttons">{routes.map(o=><button key={o.route} className={s.route===o.route?"selected":""} disabled={s.dispatched} onClick={()=>chooseRoute(o.route)}><b>{o.route==="rail"?"Rail":"Truck"}</b><span>{money(o.invoice)} carrier bill</span><small>{timeLabel(o.days)} total · {kg(o.co2kg)} CO₂e/container</small></button>)}</div>
              {!s.dispatched?<button className="primary" onClick={dispatch}>{s.revealed?"CONFIRM REVISED DECISION":"COMMIT AND REVEAL CONDITIONS"} →</button>:<div className="outcome"><h3>Conditions revealed</h3><p>{event.reveals[s.outcomeIndex].text}</p>
                {s.beforeReveal&&<div className="action-ledger reveal-ledger">{(()=>{const before=evaluate(s.beforeReveal!,s.route!),after=evaluate(s.inputs,s.route!);return <><div><span>Your route: carrier bill</span><b>{money(before.invoice)} → {money(after.invoice)}</b></div><div><span>Your route: total time</span><b>{timeLabel(before.days)} → {timeLabel(after.days)}</b></div><div><span>Your route: emissions</span><b>{kg(before.co2kg)} → {kg(after.co2kg)}</b></div><div><span>Price critical distance incl. carbon</span><b>{criticalLabel(pricedCriticalDistance(s.beforeReveal!))} → {criticalLabel(pricedCriticalDistance(s.inputs))}</b></div><div><span>Rail bill after reveal</span><b>{money(evaluate(s.inputs,"rail").invoice)}</b></div><div><span>Truck bill after reveal</span><b>{money(evaluate(s.inputs,"road").invoice)}</b></div><div><span>Cargo capital cost on your route</span><b>{money(after.cargoHoldingCost)} outside bill</b></div></>})()}</div>}
                <div className="recommendation">{feasible.length?<><b>Lowest carrier bill plus optional carbon charge among routes meeting the deadline: {feasible[0].route==="rail"?"rail":"truck"}.</b><p>The model's cost check is {money(feasible[0].decisionCost)}. Compare it with your group's reason and the information available when you chose.</p></>:<><b>Neither route meets the deadline.</b><p>What delivery promise or contingency would your group negotiate?</p></>}</div>
                <details className="mechanism-guide"><summary>Optional: ASEK value of additional delay</summary><p>For this sensitivity only, use transport equipment in every case: {ASEK.equipment.rate.toFixed(4)} SEK per tonne-hour × 18 tonnes × 24 hours = {money(rail?.delayValue||0)} per extra day (2019 SEK, excluding VAT). These values are excluded from the bill and recommendation. SVEAB tariffs and ASEK values have different price years. <a href={ASEK_URL} target="_blank" rel="noopener noreferrer">Trafikverket ASEK table ↗</a></p></details>
                <button className="text-button" onClick={()=>patch({dispatched:false})}>RECONSIDER ROUTE</button></div>}
            </div><Scene route={s.route} dispatched={s.dispatched}/></div></div>
              </details>
            <details className="panel variable-glossary">
              <summary>Model assumptions and calculations</summary>
            <div className="sources-panel"><p><b>Shipment assumptions:</b> 18 tonnes per container, with 48 hours by rail or 24 hours by truck before any scenario delays. The graph uses freight and the internal carbon charge. The carrier bill also includes storage, while cargo capital cost is tracked separately.</p><p><b>Reported event:</b> <a href={event.source} target="_blank" rel="noopener noreferrer">{event.sourceLabel} ↗</a>{event.additionalSource&&<> · <a href={event.additionalSource} target="_blank" rel="noopener noreferrer">{event.additionalLabel} ↗</a></>}. The SVEAB scenario figures, information choices and post-decision outcomes are classroom assumptions.</p><p><b>Carrier charges:</b> Rail freight = (6.5 × (x + extra rail km) + 550) × (1 + rail premium) + two SEK 650 hauls + two SEK 240 lifts + any alternative-terminal fee. Truck freight = 9 × 1.2 × (x + 92 + road detour km) × (1 + truck quote increase ÷ 100). Rail storage = extra waiting hours × storage charge per hour. The original SVEAB handout supplies the first rail and truck terms; all disruption terms are teaching assumptions.</p><p><b>Emissions:</b> 18 tonnes × distance × illustrative factor. Electric rail: 0.004 kg CO₂e/tonne-km; road: 0.070 kg. Rail adds the two road hauls; truck adds 20% repositioning. The <a href="https://www.eea.europa.eu/en/analysis/publications/rail-and-waterborne-best-for-low-carbon-motorised-transport" target="_blank" rel="noopener noreferrer">EEA comparison ↗</a> supports the modal direction; the <a href="https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025" target="_blank" rel="noopener noreferrer">UK government factors ↗</a> show how reported factors depend on vehicle and service. The exact game factors are simplified teaching values. Internal carbon charge = emissions (kg) ÷ 1,000 × selected SEK/t CO₂e; this charge is included in the solid price lines and can move their critical distance.</p><p><b>Cargo capital cost:</b> value × 12% annual rate × total transport days ÷ 365. The cargo value and 12% rate are exercise assumptions. <a href="https://bransch.trafikverket.se/contentassets/0e5777a6301e4134a6e8365fc20c0e0e/asek-8.0-2-april-2024.pdf" target="_blank" rel="noopener noreferrer">Trafikverket ASEK 8.0, §10.1 ↗</a> explains the capital-binding rationale for goods time. This cost is outside the carrier bill.</p></div>
            </details>
          </>}
          <section className="panel">
            <h3>Class discussion · Group PPT</h3>
            {task2Questions.map(question=><p key={question}>{question}</p>)}
            {scenarioQuestions.map(question=><p key={question}>{question}</p>)}
          </section>
        </section>}
        {error&&<div className="game-error" role="alert">{error}</div>}
        <footer className="footer"><span>SVEAB · RAIL OR ROAD?</span><span>Reported case facts are linked; SVEAB scenario outcomes are classroom assumptions.</span></footer>
      </div>
    </div>
  </main>;
}
