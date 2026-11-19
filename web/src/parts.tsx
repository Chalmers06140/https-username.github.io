"use client";
import { CASE, CASE_CONTROLS, POINTS, baseline, criticalDistance, pricedCriticalDistance, evaluate, money, type CaseControl, type Inputs, type Route } from "./model";

export function Field({label,value,onChange,unit,hint}:{label:string;value:string;onChange:(v:string)=>void;unit?:string;hint?:string}) {
  return <label className="field"><span>{label}</span>{hint&&<small>{hint}</small>}<div className="input-wrap"><input inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)}/>{unit&&<em>{unit}</em>}</div></label>;
}
export function Slider({label,value,min,max,step=1,unit="",disabled=false,onChange}:{label:string;value:number;min:number;max:number;step?:number;unit?:string;disabled?:boolean;onChange:(v:number)=>void}) {
  const shown=unit===" min"&&value>=120?duration(value/1440):unit===" days"?`${Number.isInteger(value)?value.toLocaleString():value.toFixed(1)} ${value===1?"day":"days"}`:`${Number.isInteger(value)?value.toLocaleString():value.toFixed(1)}${unit}`;
  return <label className="slider"><span><b>{label}</b><strong>{shown}</strong></span><input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e=>onChange(Number(e.target.value))}/></label>;
}
export function duration(daysValue:number){const minutes=Math.round(daysValue*1440),hours=Math.floor(minutes/60),rest=minutes%60;return [hours&&`${hours} h`,rest&&`${rest} min`].filter(Boolean).join(" ")||"0 min"}
export function RailPlot({chosen,onChoose}:{chosen:number[];onChoose:(n:number)=>void}) {
  const X=(x:number)=>55+x/850*620,Y=(y:number)=>224-y/6000*195;
  return <div className="quote-plot"><svg viewBox="0 0 740 275" aria-label="Rail Combi price quotes. Click two points on the line.">
    <line x1="55" y1="224" x2="680" y2="224" className="graph-axis"/><line x1="55" y1="20" x2="55" y2="224" className="graph-axis"/>
    {[0,2000,4000,6000].map(v=><g key={v}><line x1="55" x2="680" y1={Y(v)} y2={Y(v)} className="graph-grid"/><text x="47" y={Y(v)+4} textAnchor="end" className="graph-label">{v/1000}k</text></g>)}
    <path d={POINTS.map((p,i)=>(i?"L":"M")+X(p.x)+" "+Y(p.y)).join(" ")} fill="none" stroke="#218071" strokeWidth="4"/>
    {POINTS.map((p,i)=><g key={i}><g role="button" tabIndex={0} aria-label={"Select "+p.x+" km, "+money(p.y)} onClick={()=>onChoose(i)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onChoose(i)}}} className="quote-dot"><circle cx={X(p.x)} cy={Y(p.y)} r="17" fill="transparent"/><circle cx={X(p.x)} cy={Y(p.y)} r={chosen.includes(i)?12:9} fill={chosen.includes(i)?"#f2bf62":"#f8f5e9"} stroke="#164a40" strokeWidth="3"/></g><text x={X(p.x)} y="246" textAnchor="middle" className="graph-label">{p.x}</text></g>)}
    <text x="368" y="271" textAnchor="middle" className="graph-label">Distance between Rail Combi terminals (km)</text>
  </svg><div className="selected-quotes">{chosen.length?chosen.map(i=><b key={i}>{POINTS[i].x} km = {money(POINTS[i].y)}</b>):<span>No points selected yet.</span>}</div><p className="micro">Click two different dots on the line. Use their distances and prices to find the price per added kilometre and the starting price.</p></div>;
}
export function Scene({route,dispatched}:{route:Route|null;dispatched:boolean}) {
  return <div className={"scene "+(dispatched?"departed ":"")+"route-"+(route||"none")}><div className="scene-sky"><span className="sun"/><span className="cloud one"/><span className="cloud two"/></div><div className="station"><span className="station-sign">SVEAB YARD</span><span className="station-window"/><span className="station-window"/></div><div className="gantry"><span className="gantry-board">23:00 <b>FREIGHT / 04</b></span></div><div className="platform"/><div className="railtrack main"/><div className="railtrack spur"/><div className="signal"><i/></div><div className="train"><div className="locomotive"><span className="cab-window"/><span className="nose"/><span className="headlamp"/></div><div className="wagon"><span>FREIGHT</span></div><div className="wagon second"><span>CONTAINER</span></div></div><div className="truck"><span className="truck-box">CARGO</span><span className="truck-cab"/></div><div className="scene-caption">{dispatched?(route==="rail"?"RAIL DISPATCHED":"ROAD DISPATCHED"):"CHOOSE A ROUTE"}</div></div>;
}
export function CostPlot({inputs}:{inputs:Inputs}) {
  const original=baseline(inputs.distance),freightCrossing=criticalDistance(inputs),adjusted=pricedCriticalDistance(inputs),maxX=900;
  const X=(x:number)=>62+x/maxX*690;
  const chartValue=(x:number,r:Route)=>{const result=evaluate({...inputs,distance:x},r);return result.freightInvoice+result.carbonCost};
  const values=[baseline(0).rail,baseline(0).road,baseline(maxX).rail,baseline(maxX).road,chartValue(0,"rail"),chartValue(0,"road"),chartValue(maxX,"rail"),chartValue(maxX,"road")];
  const maxY=Math.max(...values)*1.12,Y=(y:number)=>335-y/maxY*300;
  const path=(a:number,b:number)=>"M "+X(0)+" "+Y(a)+" L "+X(maxX)+" "+Y(b);
  const alwaysCheaper=chartValue(0,"rail")<chartValue(0,"road")?"rail":"truck";
  const adjustedLabel=adjusted===null?`No positive crossing; ${alwaysCheaper} is cheaper throughout the modelled range`:adjusted>maxX?"Beyond 900 km":adjusted.toFixed(1)+" km";
  return <div className="cost-plot"><svg viewBox="0 0 800 405" role="img" aria-label="Original freight and current rail and truck prices by distance, with the carbon charge included in current prices">
    <line x1="62" y1="335" x2="752" y2="335" className="graph-axis"/><line x1="62" y1="32" x2="62" y2="335" className="graph-axis"/>
    {[0,300,600,900].map(x=><g key={x}><line x1={X(x)} x2={X(x)} y1="335" y2="342" className="graph-axis"/><text x={X(x)} y="358" textAnchor="middle" className="graph-label">{x}</text></g>)}
    <path d={path(baseline(0).rail,baseline(maxX).rail)} className="line-original rail"/><path d={path(baseline(0).road,baseline(maxX).road)} className="line-original road"/>
    <path d={path(chartValue(0,"rail"),chartValue(maxX,"rail"))} className="line-adjusted rail"/><path d={path(chartValue(0,"road"),chartValue(maxX,"road"))} className="line-adjusted road"/>
    <line x1={X(original.critical)} x2={X(original.critical)} y1="36" y2="335" className="critical-original"/><text x={X(original.critical)+5} y="49" className="graph-note">Original {original.critical.toFixed(1)} km</text>
    {adjusted!==null&&adjusted<=maxX&&<><line x1={X(adjusted)} x2={X(adjusted)} y1="74" y2="335" className="critical-adjusted"/><text x={X(adjusted)+5} y="85" className="graph-note">Current price {adjusted.toFixed(1)} km</text></>}
    <line x1={X(inputs.distance)} x2={X(inputs.distance)} y1="32" y2="335" className="distance-line"/><text x={X(inputs.distance)+5} y="320" className="graph-note">Scenario shipment {inputs.distance} km</text>
    <text x="65" y="21" className="graph-label">SEK</text><text x="741" y="385" textAnchor="end" className="graph-label">Distance between rail terminals (km)</text>
  </svg><div className="plot-legend"><span><i className="legend-original rail"/>Original rail freight</span><span><i className="legend-original road"/>Original truck freight</span><span><i className="legend-adjusted rail"/>Current rail price + carbon</span><span><i className="legend-adjusted road"/>Current truck price + carbon</span></div>
  <div className="critical-readout"><b>Original freight critical distance: {original.critical.toFixed(1)} km</b><b>Current freight-only critical distance: {freightCrossing===null?"No positive crossing":freightCrossing.toFixed(1)+" km"}</b><b>Current price critical distance incl. carbon: {adjustedLabel}</b></div>
  <p className="micro">The solid lines include freight charges and SVEAB’s selected carbon charge. The carbon charge changes the slope because emissions grow with distance. Waiting time and storage are excluded from this graph; they appear in the bill below.</p></div>;
}
export function Sensitivity({inputs}:{inputs:Inputs}) {
  const oldRail=evaluate(inputs,"rail"),oldRoad=evaluate(inputs,"road"),oldCritical=pricedCriticalDistance(inputs);
  const deltaMoney=(n:number)=>n===0?"no change":`${n>0?"+":"−"}${money(Math.abs(n))}`;
  const deltaTime=(n:number)=>n===0?"no change":`${n>0?"+":"−"}${duration(Math.abs(n))}`;
  const controls:CaseControl[]=[{key:"distance",label:"Distance between rail terminals",min:0,max:900,step:1,unit:" km",testStep:50},...CASE_CONTROLS[inputs.scenario],{key:"carbonPrice",label:"Internal carbon charge",min:0,max:5000,step:100,unit:" SEK/t CO₂e",testStep:500}];
  const rows=controls.map(control=>{
    const scale=control.scale??1,next=Math.min(control.max/scale,inputs[control.key]+control.testStep/scale),tested={...inputs,[control.key]:next};
    const rail=evaluate(tested,"rail"),road=evaluate(tested,"road"),nextCritical=pricedCriticalDistance(tested);
    const shown=(v:number)=>control.unit===" min"&&v*scale>=120?duration(v):control.unit===" days"?`${Math.round(v*10)/10} ${v===1?"day":"days"}`:`${Math.round(v*scale*10)/10}${control.unit}`;
    return {label:`${control.label}: ${shown(inputs[control.key])} → ${shown(next)}`,railBill:deltaMoney(rail.invoice-oldRail.invoice),roadBill:deltaMoney(road.invoice-oldRoad.invoice),railPrice:deltaMoney(rail.decisionCost-oldRail.decisionCost),roadPrice:deltaMoney(road.decisionCost-oldRoad.decisionCost),railTime:deltaTime(rail.days-oldRail.days),roadTime:deltaTime(road.days-oldRoad.days),railCo2:Math.round(rail.co2kg-oldRail.co2kg),roadCo2:Math.round(road.co2kg-oldRoad.co2kg),critical:oldCritical===nextCritical?"no change":`${oldCritical===null?"none":oldCritical.toFixed(1)+" km"} → ${nextCritical===null?"none":nextCritical.toFixed(1)+" km"}`};
  });
  return <div className="sensitivity"><h3>What changes when one input moves?</h3><p>At your chosen {inputs.distance} km shipment, change one input at a time. The critical distance here includes the selected carbon charge; moving the shipment itself changes its costs, not that threshold.</p>{rows.map((r,i)=><div className="sensitivity-row multi" key={r.label}><b>{i+1}. {r.label}</b><span>Carrier bill: rail {r.railBill}; truck {r.roadBill}</span><span>Bill incl. carbon: rail {r.railPrice}; truck {r.roadPrice}</span><span>Total time: rail {r.railTime}; truck {r.roadTime}</span><span>Emissions: rail {r.railCo2===0?"no change":`${r.railCo2>0?"+":""}${r.railCo2} kg`}; truck {r.roadCo2===0?"no change":`${r.roadCo2>0?"+":""}${r.roadCo2} kg`}</span><span>Price critical distance incl. carbon: {r.critical}</span></div>)}</div>;
}
