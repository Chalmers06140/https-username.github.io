export const CASE = { company:"SVEAB", weight:18, truckRate:9, haulage:650, lift:240, supplierKm:50, destinationKm:42, reposition:1.2 } as const;
export const POINTS = [100,200,300,400,500,600,700,800].map(x=>({x,y:6.5*x+550}));
export type Route="rail"|"road";
export type Intel=Route;
export type Product="mining"|"food"|"chemicals"|"machinery"|"equipment";
// ASEK 8.1 Table 10.3, 2019 SEK per tonne-hour, excluding VAT.
export const ASEK:Record<Product,{rate:number;label:string}>={
  mining:{rate:0.4306952942,label:"ore and minerals"},food:{rate:8.2494909331,label:"food products"},
  chemicals:{rate:8.3525240037,label:"chemical products"},machinery:{rate:78.1851123238,label:"machinery"},
  equipment:{rate:39.7676625894,label:"transport equipment"}
};
export type Inputs={distance:number;scenario:number;railDelay:number;roadDelay:number;truckPremium:number;railPremium:number;fuelShock:number;fuelShare:number;passThrough:number;roadExtraKm:number;railExtraKm:number;railDetourKm:number;railFee:number;storage:number;carbonPrice:number;deadline:number;cargoValue:number;holdingRate:number};
export type CaseControl={key:keyof Inputs;label:string;min:number;max:number;step:number;unit:string;testStep:number;scale?:number};
export const CASE_CONTROLS:CaseControl[][]=[
  [{key:"railDelay",label:"Days waiting for a train",min:0,max:30,step:1,unit:" days",testStep:1},{key:"storage",label:"Storage per waiting day",min:0,max:400,step:10,unit:" SEK/day",testStep:100},{key:"truckPremium",label:"Truck booking premium",min:0,max:80,step:1,unit:"%",testStep:10}],
  [{key:"fuelShock",label:"Diesel price increase",min:0,max:80,step:0.1,unit:"%",testStep:10},{key:"fuelShare",label:"Fuel share of truck quote",min:0,max:70,step:1,unit:"%",testStep:10},{key:"passThrough",label:"Share charged to SVEAB",min:0,max:100,step:5,unit:"%",testStep:20}],
  [{key:"roadExtraKm",label:"Road detour",min:0,max:150,step:5,unit:" km",testStep:20},{key:"roadDelay",label:"Additional road time",min:0,max:2880,step:5,unit:" min",testStep:60,scale:1440},{key:"railDelay",label:"Rail terminal wait",min:0,max:5,step:0.5,unit:" days",testStep:1}],
  [{key:"railDetourKm",label:"Extra rail kilometres",min:0,max:180,step:5,unit:" km",testStep:20},{key:"railDelay",label:"Rail slot wait",min:0,max:10,step:0.5,unit:" days",testStep:1},{key:"truckPremium",label:"Truck capacity premium",min:0,max:80,step:1,unit:"%",testStep:10}]
];
export type Inquiry={label:string;purpose:string;resolves?:number;responses:[{text:string;update:Partial<Inputs>;bounds?:[number,number]},{text:string;update:Partial<Inputs>;bounds?:[number,number]},{text:string;update:Partial<Inputs>;bounds?:[number,number]}]};
export type Reveal={text:string;update:Partial<Inputs>};
export type Scenario={title:string;short:string;reported:string;source:string;sourceLabel:string;sourceNote:string;additionalSource?:string;additionalLabel?:string;product:Product;transfer:string;question:string;unknowns:string[];starting:Partial<Inputs>;range:{key:keyof Inputs;label:string;low:number;high:number;unit:string};inquiries:[Inquiry,Inquiry,Inquiry];reveals:[Reveal,Reveal,Reveal];action?:{label:string;route:Route;update:Partial<Inputs>;explanation:string};outcome:Record<Route,string>};
export const SCENARIOS:Scenario[]=[
  {
    title:"German rail strike",short:"Rail service · January 2024",
    reported:"German train drivers announced a six-day strike that the European Rail Freight Association said would significantly affect rail freight and interrupt important corridors.",
    source:"https://www.erfarail.eu/news/press-release-strikes-in-germany-db-infrago-must-fulfil-its-sovereign-duty-as-an-infrastructure-manager",sourceLabel:"European Rail Freight Association, English press release",
    sourceNote:"ERFA, 23 January 2024: six days of announced industrial action, with disruption to freight corridors. The duration of a SVEAB delay below is a teaching assumption, not an observed effect of this strike.",
    product:"equipment",transfer:"Imagine the same SVEAB network facing a short rail service interruption. A delayed train raises storage and delivery risk; scarce replacement trucks carry a premium. The freight rail quote itself is unchanged.",
    question:"Which information would you seek first: a train departure estimate, a truck quote, or a storage quote?",
    unknowns:["Train departure may slip after the estimate","Replacement truck price is not fixed until booked","Storage charge is not confirmed"],
    starting:{railDelay:5,roadDelay:1,truckPremium:20,storage:120},
    range:{key:"truckPremium",label:"Possible truck booking premium",low:15,high:55,unit:"%"},
    inquiries:[
      {label:"Ask rail control",purpose:"Estimate the next usable train departure.",responses:[
        {text:"Rail control expects a train in 3 days, but crew release is not guaranteed.",update:{railDelay:3}},
        {text:"Rail control expects a train in 5 days, but crew release is not guaranteed.",update:{railDelay:5}},
        {text:"Rail control expects a train in 7 days, but crew release is not guaranteed.",update:{railDelay:7}}]},
      {label:"Ask a truck broker",purpose:"Request a replacement truck quote.",resolves:1,responses:[
        {text:"The broker offers a 30% premium if booked now. This quote remains available for the exercise.",update:{truckPremium:30},bounds:[30,30]},
        {text:"The broker offers a 40% premium if booked now. This quote remains available for the exercise.",update:{truckPremium:40},bounds:[40,40]},
        {text:"The broker offers a 50% premium if booked now. This quote remains available for the exercise.",update:{truckPremium:50},bounds:[50,50]}]},
      {label:"Ask the warehouse",purpose:"Check the charge while the container waits.",resolves:2,responses:[
        {text:"The warehouse quotes SEK 90 per waiting day.",update:{storage:90}},
        {text:"The warehouse quotes SEK 120 per waiting day.",update:{storage:120}},
        {text:"The warehouse quotes SEK 150 per waiting day.",update:{storage:150}}]}
    ],
    reveals:[
      {text:"Crew release slipped by one day: the rail wait is 4 days. The truck premium is 30% and storage is SEK 90/day.",update:{railDelay:4,truckPremium:30,storage:90}},
      {text:"The departure estimate slipped: the rail wait is 7 days. The truck premium is 40% and storage is SEK 120/day.",update:{railDelay:7,truckPremium:40,storage:120}},
      {text:"No crew was available for the expected train: the rail wait is 9 days. The truck premium is 50% and storage is SEK 150/day.",update:{railDelay:9,truckPremium:50,storage:150}}
    ],
    action:{label:"Book a priority replacement truck",route:"road",update:{roadDelay:0.25,truckPremium:50},explanation:"A priority truck reduces the departure wait to six hours but fixes the booking premium at 50%. Its route and emissions stay the same."},
    outcome:{rail:"The container waits for a train; the warehouse charges for each waiting day.",road:"The truck can depart sooner, subject to its quoted premium."}
  },
  {
    title:"EU diesel price rise",short:"Truck tariff · June 2022",
    reported:"Eurostat reported EU consumer diesel prices 45.2% higher year on year in June 2022.",
    source:"https://ec.europa.eu/eurostat/en/web/products-eurostat-news/w/ddn-20241008-2",sourceLabel:"Eurostat fuel price report",
    sourceNote:"Eurostat, 8 October 2024: diesel +45.2% in June 2022 year on year. This is a fuel price change, not a freight tariff. All fuel shares and contract terms below are teaching assumptions.",
    product:"equipment",transfer:"For SVEAB, the truck carrier may pass part of its higher fuel cost on to SVEAB. Rail Combi's quote does not acquire a surcharge in this case. The critical distance depends on the contract pass-through, which is initially unknown.",
    question:"Does the full range of possible fuel surcharges change the conclusion, or is rail still cheaper?",
    unknowns:["Share of fuel increase charged to SVEAB","Fuel share of the truck quote","Whether the rail slot meets the delivery promise"],
    starting:{fuelShock:45.2,fuelShare:35,passThrough:50},
    range:{key:"passThrough",label:"Fuel increase charged to SVEAB",low:0,high:100,unit:"%"},
    inquiries:[
      {label:"Ask the truck carrier",purpose:"Seek a surcharge estimate before the final invoice.",responses:[
        {text:"The carrier expects to charge 0–20% of its fuel increase to SVEAB; use 10% for the planning quote. The final invoice is pending.",update:{passThrough:10},bounds:[0,20]},
        {text:"The carrier expects to charge 25–55% of its fuel increase to SVEAB; use 40% for the planning quote. The final invoice is pending.",update:{passThrough:40},bounds:[25,55]},
        {text:"The carrier expects to charge 60–90% of its fuel increase to SVEAB; use 75% for the planning quote. The final invoice is pending.",update:{passThrough:75},bounds:[60,90]}]},
      {label:"Ask procurement",purpose:"Check how much fuel contributes to the truck quote.",responses:[
        {text:"Procurement estimates that fuel accounts for 30% of the truck quote.",update:{fuelShare:30}},
        {text:"Procurement estimates that fuel accounts for 35% of the truck quote.",update:{fuelShare:35}},
        {text:"Procurement estimates that fuel accounts for 42% of the truck quote.",update:{fuelShare:42}}]},
      {label:"Ask Rail Combi",purpose:"Check the next available rail departure.",responses:[
        {text:"Rail Combi expects no additional wait. Its freight quote is unchanged.",update:{railDelay:0}},
        {text:"Rail Combi expects half a day of additional wait. Its freight quote is unchanged.",update:{railDelay:0.5}},
        {text:"Rail Combi expects one extra day of waiting. Its freight quote is unchanged.",update:{railDelay:1}}]}
    ],
    reveals:[
      {text:"The final truck invoice passes on none of the fuel rise. Fuel is 30% of its original quote; rail has no extra wait.",update:{passThrough:0,fuelShare:30,railDelay:0}},
      {text:"The final truck invoice passes on 40% of the fuel rise. Fuel is 35% of its original quote; rail waits half a day.",update:{passThrough:40,fuelShare:35,railDelay:0.5}},
      {text:"The final truck invoice passes on 85% of the fuel rise. Fuel is 42% of its original quote; rail waits one day.",update:{passThrough:85,fuelShare:42,railDelay:1}}
    ],
    outcome:{rail:"Rail keeps its original freight quote; a service wait may still matter.",road:"The truck invoice depends on the carrier's fuel share and contract pass-through."}
  },
  {
    title:"E6 Stenungsund landslide",short:"Road detour · September 2023",
    reported:"A landslide destroyed part of the E6 near Stenungsund and diverted road traffic.",
    source:"https://shk.se/engelska/the-swedish-accident-investigation-authority/search-investigation/other-incidents/2023-12-05-a-large-landslide-on-the-e6-road-outside-stenungsund-vastra-gotalands-county",sourceLabel:"Swedish Accident Investigation Authority, English summary",
    additionalSource:"https://www.svensktnaringsliv.se/bilder_och_dokument/rapporter/5gk1nl_pm_-_samhallsekonomiska_effekter_av_jordskredet_vid_e6_stenungssu_1204074.html/PM_-_Samhallsekonomiska_effekter_av_jordskredet_vid_E6_Stenungssund.pdf",additionalLabel:"WSP detour study, Swedish PDF",
    sourceNote:"Investigation Authority: landslide on 23 September 2023. WSP, 17 October 2023, p. 7: roughly 30 extra kilometres and 25 minutes for a studied heavy-vehicle route. SVEAB's detour and congestion are hypothetical.",
    product:"equipment",transfer:"Place the SVEAB shipment under a road closure of this kind. The signed detour changes truck kilometres, price and emissions; traffic may add time beyond the distance-based estimate. Rail may use another terminal, at a handling and local haulage cost.",
    question:"Would you choose a shorter bill or more reliable delivery when the final congestion time is unknown?",
    unknowns:["Final signed truck detour","Congestion beyond the route estimate","Cargo value tied up in transit"],
    starting:{roadExtraKm:30,roadDelay:25/1440,railDelay:1,cargoValue:250000,holdingRate:12},
    range:{key:"roadExtraKm",label:"Possible truck detour",low:20,high:65,unit:" km"},
    inquiries:[
      {label:"Ask road dispatch",purpose:"Narrow the detour distance and travel estimate.",responses:[
        {text:"Dispatch expects 20–30 extra km and about 20 minutes without a queue. Congestion remains unknown.",update:{roadExtraKm:25,roadDelay:20/1440},bounds:[20,30]},
        {text:"Dispatch expects 40–50 extra km and about 35 minutes without a queue. Congestion remains unknown.",update:{roadExtraKm:45,roadDelay:35/1440},bounds:[40,50]},
        {text:"Dispatch expects 55–65 extra km and about 50 minutes without a queue. Congestion remains unknown.",update:{roadExtraKm:60,roadDelay:50/1440},bounds:[55,65]}]},
      {label:"Ask Rail Combi",purpose:"Check the terminal departure estimate.",responses:[
        {text:"A rail slot is available today; no additional terminal wait is expected.",update:{railDelay:0}},
        {text:"The terminal expects a half-day wait for rail.",update:{railDelay:0.5}},
        {text:"The terminal expects one extra day of rail waiting.",update:{railDelay:1}}]},
      {label:"Ask SVEAB finance",purpose:"Check the value of goods tied up in transit.",resolves:2,responses:[
        {text:"The container holds goods valued at SEK 100,000. The exercise assumes 12% annual capital cost.",update:{cargoValue:100000}},
        {text:"The container holds goods valued at SEK 250,000. The exercise assumes 12% annual capital cost.",update:{cargoValue:250000}},
        {text:"The container holds goods valued at SEK 400,000. The exercise assumes 12% annual capital cost.",update:{cargoValue:400000}}]}
    ],
    reveals:[
      {text:"The signed detour was 25 km; congestion added 20 minutes in total. Cargo value is SEK 100,000.",update:{roadExtraKm:25,roadDelay:20/1440,railDelay:0,cargoValue:100000}},
      {text:"The signed detour was 45 km; unexpected congestion brought additional road time to 3 hours. Cargo value is SEK 250,000.",update:{roadExtraKm:45,roadDelay:3/24,railDelay:0.5,cargoValue:250000}},
      {text:"The signed detour was 60 km; access was blocked for another 1 day 18 hours. Cargo value is SEK 400,000.",update:{roadExtraKm:60,roadDelay:1.75,railDelay:1,cargoValue:400000}}
    ],
    action:{label:"Reserve an alternative rail terminal",route:"rail",update:{railDelay:0,railExtraKm:40,railFee:800},explanation:"The alternative terminal removes the rail wait but adds 40 km of local road haulage and SEK 800 in haulage and handling."},
    outcome:{rail:"Rail can avoid the closed road section, subject to terminal capacity.",road:"The truck pays for the detour and may spend extra time in a queue."}
  },
  {
    title:"Gotthard rail tunnel closure",short:"Rail detour · August 2023",
    reported:"A freight train derailed in the Gotthard Base Tunnel on 10 August 2023. Rail traffic was restricted until full reopening in September 2024.",
    source:"https://news.sbb.ch/en/019d7b76-dea8-7bc7-a9d2-8b70f60dc7b9/gotthard-base-tunnel-passenger-information",sourceLabel:"Swiss Federal Railways, English account",
    sourceNote:"SBB, updated 2 September 2024: derailment on 10 August 2023 and prolonged restricted rail operation. The extra distance, slot wait and road quote below are invented for SVEAB, not Gotthard measurements.",
    product:"equipment",transfer:"Imagine a physical rail closure on the SVEAB network. Rail may travel farther and wait for a diverted slot, while truck remains available at a possible capacity premium. Unlike a strike, extra rail kilometres directly change the rail cost line and emissions.",
    question:"If the rail route is longer but its final slot is uncertain, which estimate is worth checking first?",
    unknowns:["Length of the usable rail diversion","Date of a diverted rail slot","Replacement truck capacity premium"],
    starting:{railDetourKm:80,railDelay:3,truckPremium:20,storage:120},
    range:{key:"railDetourKm",label:"Possible extra rail distance",low:0,high:150,unit:" km"},
    inquiries:[
      {label:"Ask infrastructure control",purpose:"Narrow the distance of a usable rail diversion.",responses:[
        {text:"The rail diversion is estimated at 15–30 extra km. The path is not final.",update:{railDetourKm:20},bounds:[15,30]},
        {text:"The rail diversion is estimated at 60–100 extra km. The path is not final.",update:{railDetourKm:80},bounds:[60,100]},
        {text:"The rail diversion is estimated at 120–150 extra km. The path is not final.",update:{railDetourKm:140},bounds:[120,150]}]},
      {label:"Ask Rail Combi",purpose:"Estimate the next usable slot.",responses:[
        {text:"Rail Combi expects one additional day before a diverted slot.",update:{railDelay:1}},
        {text:"Rail Combi expects three additional days before a diverted slot.",update:{railDelay:3}},
        {text:"Rail Combi expects six additional days before a diverted slot.",update:{railDelay:6}}]},
      {label:"Ask a truck broker",purpose:"Request a road capacity quote.",resolves:2,responses:[
        {text:"The broker quotes a 15% truck capacity premium.",update:{truckPremium:15}},
        {text:"The broker quotes a 25% truck capacity premium.",update:{truckPremium:25}},
        {text:"The broker quotes a 40% truck capacity premium.",update:{truckPremium:40}}]}
    ],
    reveals:[
      {text:"The diversion required 20 extra rail km and one day of additional wait. The road premium is 15%.",update:{railDetourKm:20,railDelay:1,truckPremium:15}},
      {text:"The diversion required 80 extra rail km and three days of additional wait. The road premium is 25%.",update:{railDetourKm:80,railDelay:3,truckPremium:25}},
      {text:"The diversion required 140 extra rail km and six days of additional wait. The road premium is 40%.",update:{railDetourKm:140,railDelay:6,truckPremium:40}}
    ],
    outcome:{rail:"Rail may use a longer diversion, with a scarce slot and storage during the wait.",road:"The truck avoids the rail closure but its capacity premium may rise."}
  }
];
export const BASE_INPUTS:Inputs={distance:Math.round(baseline(0).critical*10)/10,scenario:0,railDelay:0,roadDelay:0,truckPremium:0,railPremium:0,fuelShock:0,fuelShare:35,passThrough:100,roadExtraKm:0,railExtraKm:0,railDetourKm:0,railFee:0,storage:0,carbonPrice:0,deadline:2.5,cargoValue:250000,holdingRate:12};
export function scenarioInputs(index:number,distance:number):Inputs{return {...BASE_INPUTS,...SCENARIOS[index].starting,scenario:index,distance}}
export function baseline(distance:number){const railSlope=6.5,railIntercept=550+2*CASE.haulage+2*CASE.lift,roadSlope=CASE.truckRate*CASE.reposition,roadIntercept=roadSlope*(CASE.supplierKm+CASE.destinationKm);return {railSlope,railIntercept,roadSlope,roadIntercept,rail:railSlope*distance+railIntercept,road:roadSlope*distance+roadIntercept,critical:(railIntercept-roadIntercept)/(roadSlope-railSlope)}}
export type OptionResult={route:Route;freightInvoice:number;waitingCharge:number;invoice:number;normalDays:number;additionalDays:number;days:number;co2kg:number;cargoHoldingCost:number;delayValue:number;delayCost:number;carbonCost:number;decisionCost:number;withinDeadline:boolean;note:string};
export function evaluate(i:Inputs,route:Route):OptionResult{const b=baseline(i.distance),event=SCENARIOS[i.scenario],roadRate=CASE.truckRate*CASE.reposition,roadKm=i.distance+CASE.supplierKm+CASE.destinationKm+i.roadExtraKm,railKm=i.distance+i.railDetourKm,railQuote=(b.railSlope*railKm+550)*(1+i.railPremium/100),railFreight=railQuote+2*CASE.haulage+2*CASE.lift+i.railFee,roadFreight=roadRate*roadKm*(1+i.truckPremium/100+i.fuelShock/100*i.fuelShare/100*i.passThrough/100),freightInvoice=route==="rail"?railFreight:roadFreight,waitingCharge=route==="rail"?i.railDelay*i.storage:0,invoice=freightInvoice+waitingCharge,normalDays=route==="rail"?2:1,additionalDays=route==="rail"?i.railDelay:i.roadDelay,days=normalDays+additionalDays,co2kg=CASE.weight*(route==="rail"?railKm*0.004+(CASE.supplierKm+CASE.destinationKm+i.railExtraKm)*0.07:roadKm*CASE.reposition*0.07),cargoHoldingCost=i.cargoValue*i.holdingRate/100*days/365,delayValue=ASEK[event.product].rate*CASE.weight*24,delayCost=additionalDays*delayValue,carbonCost=co2kg/1000*i.carbonPrice,decisionCost=invoice+carbonCost;return {route,freightInvoice,waitingCharge,invoice,normalDays,additionalDays,days,co2kg,cargoHoldingCost,delayValue,delayCost,carbonCost,decisionCost,withinDeadline:days<=i.deadline,note:event.outcome[route]}}
function crossing(i:Inputs,includeCarbon:boolean){const value=(distance:number,route:Route)=>{const result=evaluate({...i,distance},route);return result.freightInvoice+(includeCarbon?result.carbonCost:0)},r0=value(0,"rail"),t0=value(0,"road"),denominator=(value(1,"road")-t0)-(value(1,"rail")-r0);if(Math.abs(denominator)<1e-8)return null;const x=(r0-t0)/denominator;return Number.isFinite(x)&&x>=0?x:null}
export function criticalDistance(i:Inputs){return crossing(i,false)}
export function pricedCriticalDistance(i:Inputs){return crossing(i,true)}
export function money(n:number){return "SEK "+Math.round(n).toLocaleString("en-US")}
export function kg(n:number){return Math.round(n).toLocaleString("en-US")+" kg"}
