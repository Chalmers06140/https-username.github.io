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
  [{key:"railDelay",label:"Hours waiting for a train",min:0,max:720,step:4,unit:" h",testStep:4,scale:24},{key:"storage",label:"Storage per waiting hour",min:0,max:20,step:0.5,unit:" SEK/h",testStep:2},{key:"truckPremium",label:"Truck booking premium",min:0,max:80,step:1,unit:"%",testStep:10}],
  [{key:"fuelShock",label:"Diesel price increase",min:0,max:80,step:0.1,unit:"%",testStep:10},{key:"fuelShare",label:"Fuel share of truck quote",min:0,max:70,step:1,unit:"%",testStep:10},{key:"passThrough",label:"Share charged to SVEAB",min:0,max:100,step:5,unit:"%",testStep:20}],
  [{key:"roadExtraKm",label:"Road detour",min:0,max:150,step:5,unit:" km",testStep:20},{key:"roadDelay",label:"Additional road time",min:0,max:2880,step:5,unit:" min",testStep:60,scale:1440},{key:"railDelay",label:"Rail terminal wait",min:0,max:120,step:4,unit:" h",testStep:4,scale:24}],
  [{key:"railDetourKm",label:"Extra rail kilometres",min:0,max:180,step:5,unit:" km",testStep:20},{key:"railDelay",label:"Rail slot wait",min:0,max:240,step:4,unit:" h",testStep:4,scale:24},{key:"truckPremium",label:"Truck capacity premium",min:0,max:80,step:1,unit:"%",testStep:10}]
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
    question:"Which information should you confirm before choosing a route, and which range can you accept?",
    unknowns:["Train departure time","Replacement truck price and availability","Storage rate"],
    starting:{railDelay:5,roadDelay:1,truckPremium:20,storage:5},
    range:{key:"truckPremium",label:"Possible truck booking premium",low:15,high:55,unit:"%"},
    inquiries:[
      {label:"Train departure",purpose:"Confirm the next usable train departure.",responses:[
        {text:"The next usable train is confirmed in 96 hours.",update:{railDelay:4}},
        {text:"The next usable train is confirmed in 168 hours.",update:{railDelay:7}},
        {text:"The next usable train is confirmed in 216 hours.",update:{railDelay:9}}]},
      {label:"Replacement truck",purpose:"Confirm its price and departure time.",resolves:1,responses:[
        {text:"A truck is confirmed with a 30% premium and a 6-hour departure wait.",update:{truckPremium:30,roadDelay:0.25},bounds:[30,30]},
        {text:"A truck is confirmed with a 40% premium and a 24-hour departure wait.",update:{truckPremium:40,roadDelay:1},bounds:[40,40]},
        {text:"A truck is confirmed with a 50% premium and a 48-hour departure wait.",update:{truckPremium:50,roadDelay:2},bounds:[50,50]}]},
      {label:"Storage rate",purpose:"Confirm the hourly storage rate.",resolves:2,responses:[
        {text:"The warehouse quotes SEK 4 per waiting hour.",update:{storage:4}},
        {text:"The warehouse quotes SEK 5 per waiting hour.",update:{storage:5}},
        {text:"The warehouse quotes SEK 6 per waiting hour.",update:{storage:6}}]}
    ],
    reveals:[
      {text:"The rail wait is 96 hours. A replacement truck has a 30% premium and a 6-hour departure wait. Storage is SEK 4/hour.",update:{railDelay:4,truckPremium:30,roadDelay:0.25,storage:4}},
      {text:"The rail wait is 168 hours. A replacement truck has a 40% premium and a 24-hour departure wait. Storage is SEK 5/hour.",update:{railDelay:7,truckPremium:40,roadDelay:1,storage:5}},
      {text:"The rail wait is 216 hours. A replacement truck has a 50% premium and a 48-hour departure wait. Storage is SEK 6/hour.",update:{railDelay:9,truckPremium:50,roadDelay:2,storage:6}}
    ],
    outcome:{rail:"The container waits for a train; the warehouse charges for each waiting hour.",road:"The truck can depart sooner, subject to its quoted premium."}
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
      {label:"Fuel surcharge",purpose:"Confirm the share passed on to SVEAB.",responses:[
        {text:"The carrier confirms no fuel surcharge for this shipment.",update:{passThrough:0},bounds:[0,20]},
        {text:"The carrier confirms that 40% of the fuel increase will be passed on.",update:{passThrough:40},bounds:[25,55]},
        {text:"The carrier confirms that 85% of the fuel increase will be passed on.",update:{passThrough:85},bounds:[60,90]}]},
      {label:"Fuel share",purpose:"Confirm the fuel share of the truck quote.",responses:[
        {text:"Procurement estimates that fuel accounts for 30% of the truck quote.",update:{fuelShare:30}},
        {text:"Procurement estimates that fuel accounts for 35% of the truck quote.",update:{fuelShare:35}},
        {text:"Procurement estimates that fuel accounts for 42% of the truck quote.",update:{fuelShare:42}}]},
      {label:"Rail departure",purpose:"Confirm the additional wait for rail.",responses:[
        {text:"Rail Combi expects no additional wait. Its freight quote is unchanged.",update:{railDelay:0}},
        {text:"Rail Combi expects 12 hours of additional wait. Its freight quote is unchanged.",update:{railDelay:0.5}},
        {text:"Rail Combi expects 24 hours of waiting. Its freight quote is unchanged.",update:{railDelay:1}}]}
    ],
    reveals:[
      {text:"The final truck invoice passes on none of the fuel rise. Fuel is 30% of its original quote; rail has no extra wait.",update:{passThrough:0,fuelShare:30,railDelay:0}},
      {text:"The final truck invoice passes on 40% of the fuel rise. Fuel is 35% of its original quote; rail waits 12 hours.",update:{passThrough:40,fuelShare:35,railDelay:0.5}},
      {text:"The final truck invoice passes on 85% of the fuel rise. Fuel is 42% of its original quote; rail waits 24 hours.",update:{passThrough:85,fuelShare:42,railDelay:1}}
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
    unknowns:["Road detour and congestion","Rail terminal plan","Cargo value tied up in transit"],
    starting:{roadExtraKm:30,roadDelay:25/1440,railDelay:1,cargoValue:250000,holdingRate:12},
    range:{key:"roadExtraKm",label:"Possible truck detour",low:20,high:65,unit:" km"},
    inquiries:[
      {label:"Road detour",purpose:"Confirm the detour and extra travel time.",responses:[
        {text:"The road detour is 25 km and adds 20 minutes.",update:{roadExtraKm:25,roadDelay:20/1440},bounds:[20,30]},
        {text:"The road detour is 45 km and adds 3 hours.",update:{roadExtraKm:45,roadDelay:3/24},bounds:[40,50]},
        {text:"The road detour is 60 km and adds 42 hours.",update:{roadExtraKm:60,roadDelay:1.75},bounds:[55,65]}]},
      {label:"Rail terminal plan",purpose:"Confirm the wait and any alternative terminal cost.",responses:[
        {text:"A rail slot is available now at the usual terminal.",update:{railDelay:0,railExtraKm:0,railFee:0}},
        {text:"The usual terminal confirms a 12-hour wait.",update:{railDelay:0.5,railExtraKm:0,railFee:0}},
        {text:"Rail needs an alternative terminal after a 24-hour wait, adding 40 km and SEK 800 handling.",update:{railDelay:1,railExtraKm:40,railFee:800}}]},
      {label:"Cargo value",purpose:"Confirm the value tied up in transit.",resolves:2,responses:[
        {text:"The container holds goods valued at SEK 100,000. The exercise assumes 12% annual capital cost.",update:{cargoValue:100000}},
        {text:"The container holds goods valued at SEK 250,000. The exercise assumes 12% annual capital cost.",update:{cargoValue:250000}},
        {text:"The container holds goods valued at SEK 400,000. The exercise assumes 12% annual capital cost.",update:{cargoValue:400000}}]}
    ],
    reveals:[
      {text:"The signed detour was 25 km; congestion added 20 minutes in total. Cargo value is SEK 100,000.",update:{roadExtraKm:25,roadDelay:20/1440,railDelay:0,railExtraKm:0,railFee:0,cargoValue:100000}},
      {text:"The signed detour was 45 km; unexpected congestion brought additional road time to 3 hours. Cargo value is SEK 250,000.",update:{roadExtraKm:45,roadDelay:3/24,railDelay:0.5,railExtraKm:0,railFee:0,cargoValue:250000}},
      {text:"The road detour is 60 km with 42 hours of extra travel. Rail uses an alternative terminal, adding 40 km of local road haul and SEK 800 in handling. Cargo value is SEK 400,000.",update:{roadExtraKm:60,roadDelay:1.75,railDelay:1,railExtraKm:40,railFee:800,cargoValue:400000}}
    ],
    outcome:{rail:"Rail can avoid the closed road section, subject to terminal capacity.",road:"The truck pays for the detour and may spend extra time in a queue."}
  },
  {
    title:"Gotthard rail tunnel closure",short:"Rail detour · August 2023",
    reported:"A freight train derailed in the Gotthard Base Tunnel on 10 August 2023. Rail traffic was restricted until full reopening in September 2024.",
    source:"https://news.sbb.ch/en/019d7b76-dea8-7bc7-a9d2-8b70f60dc7b9/gotthard-base-tunnel-passenger-information",sourceLabel:"Swiss Federal Railways, English account",
    sourceNote:"SBB, updated 2 September 2024: derailment on 10 August 2023 and prolonged restricted rail operation. The extra distance, slot wait and road quote below are invented for SVEAB, not Gotthard measurements.",
    product:"equipment",transfer:"Imagine a physical rail closure on the SVEAB network. Rail may travel farther and wait for a diverted slot, while truck remains available at a possible capacity premium. Unlike a strike, extra rail kilometres directly change the rail cost line and emissions.",
    question:"If the rail route is longer but its final slot is uncertain, which fact should you confirm before deciding?",
    unknowns:["Length of the usable rail diversion","Date of a diverted rail slot","Replacement truck capacity premium"],
    starting:{railDetourKm:80,railDelay:3,truckPremium:20,storage:5},
    range:{key:"railDetourKm",label:"Possible extra rail distance",low:0,high:150,unit:" km"},
    inquiries:[
      {label:"Rail diversion",purpose:"Confirm the distance of a usable rail route.",responses:[
        {text:"The rail diversion is estimated at 15–30 extra km. The path is not final.",update:{railDetourKm:20},bounds:[15,30]},
        {text:"The rail diversion is estimated at 60–100 extra km. The path is not final.",update:{railDetourKm:80},bounds:[60,100]},
        {text:"The rail diversion is estimated at 120–150 extra km. The path is not final.",update:{railDetourKm:140},bounds:[120,150]}]},
      {label:"Rail slot wait",purpose:"Confirm the next diverted rail slot.",responses:[
        {text:"Rail Combi expects 24 additional hours before a diverted slot.",update:{railDelay:1}},
        {text:"Rail Combi expects 72 additional hours before a diverted slot.",update:{railDelay:3}},
        {text:"Rail Combi expects 144 additional hours before a diverted slot.",update:{railDelay:6}}]},
      {label:"Truck capacity premium",purpose:"Confirm the replacement truck premium.",resolves:2,responses:[
        {text:"The broker quotes a 15% truck capacity premium.",update:{truckPremium:15}},
        {text:"The broker quotes a 25% truck capacity premium.",update:{truckPremium:25}},
        {text:"The broker quotes a 40% truck capacity premium.",update:{truckPremium:40}}]}
    ],
    reveals:[
      {text:"The diversion required 20 extra rail km and 24 hours of additional wait. The road premium is 15%.",update:{railDetourKm:20,railDelay:1,truckPremium:15}},
      {text:"The diversion required 80 extra rail km and 72 hours of additional wait. The road premium is 25%.",update:{railDetourKm:80,railDelay:3,truckPremium:25}},
      {text:"The diversion required 140 extra rail km and 144 hours of additional wait. The road premium is 40%.",update:{railDetourKm:140,railDelay:6,truckPremium:40}}
    ],
    outcome:{rail:"Rail may use a longer diversion, with a scarce slot and storage during the wait.",road:"The truck avoids the rail closure but its capacity premium may rise."}
  }
];
export const BASE_INPUTS:Inputs={distance:Math.round(baseline(0).critical*10)/10,scenario:0,railDelay:0,roadDelay:0,truckPremium:0,railPremium:0,fuelShock:0,fuelShare:35,passThrough:100,roadExtraKm:0,railExtraKm:0,railDetourKm:0,railFee:0,storage:0,carbonPrice:0,deadline:2.5,cargoValue:250000,holdingRate:12};
export function scenarioInputs(index:number,distance:number):Inputs{return {...BASE_INPUTS,...SCENARIOS[index].starting,scenario:index,distance}}
export function baseline(distance:number){const railSlope=6.5,railIntercept=550+2*CASE.haulage+2*CASE.lift,roadSlope=CASE.truckRate*CASE.reposition,roadIntercept=roadSlope*(CASE.supplierKm+CASE.destinationKm);return {railSlope,railIntercept,roadSlope,roadIntercept,rail:railSlope*distance+railIntercept,road:roadSlope*distance+roadIntercept,critical:(railIntercept-roadIntercept)/(roadSlope-railSlope)}}
export type OptionResult={route:Route;freightInvoice:number;waitingCharge:number;invoice:number;normalDays:number;additionalDays:number;days:number;co2kg:number;cargoHoldingCost:number;delayValue:number;delayCost:number;carbonCost:number;decisionCost:number;withinDeadline:boolean;note:string};
export function evaluate(i:Inputs,route:Route):OptionResult{const b=baseline(i.distance),event=SCENARIOS[i.scenario],roadRate=CASE.truckRate*CASE.reposition,roadKm=i.distance+CASE.supplierKm+CASE.destinationKm+i.roadExtraKm,railKm=i.distance+i.railDetourKm,railQuote=(b.railSlope*railKm+550)*(1+i.railPremium/100),railFreight=railQuote+2*CASE.haulage+2*CASE.lift+i.railFee,roadFreight=roadRate*roadKm*(1+i.truckPremium/100+i.fuelShock/100*i.fuelShare/100*i.passThrough/100),freightInvoice=route==="rail"?railFreight:roadFreight,waitingCharge=route==="rail"?i.railDelay*24*i.storage:0,invoice=freightInvoice+waitingCharge,normalDays=route==="rail"?2:1,additionalDays=route==="rail"?i.railDelay:i.roadDelay,days=normalDays+additionalDays,co2kg=CASE.weight*(route==="rail"?railKm*0.004+(CASE.supplierKm+CASE.destinationKm+i.railExtraKm)*0.07:roadKm*CASE.reposition*0.07),cargoHoldingCost=i.cargoValue*i.holdingRate/100*days/365,delayValue=ASEK[event.product].rate*CASE.weight*24,delayCost=additionalDays*delayValue,carbonCost=co2kg/1000*i.carbonPrice,decisionCost=invoice+carbonCost;return {route,freightInvoice,waitingCharge,invoice,normalDays,additionalDays,days,co2kg,cargoHoldingCost,delayValue,delayCost,carbonCost,decisionCost,withinDeadline:days<=i.deadline,note:event.outcome[route]}}
function crossing(i:Inputs,includeCarbon:boolean){const value=(distance:number,route:Route)=>{const result=evaluate({...i,distance},route);return result.freightInvoice+(includeCarbon?result.carbonCost:0)},r0=value(0,"rail"),t0=value(0,"road"),denominator=(value(1,"road")-t0)-(value(1,"rail")-r0);if(Math.abs(denominator)<1e-8)return null;const x=(r0-t0)/denominator;return Number.isFinite(x)&&x>=0?x:null}
export function criticalDistance(i:Inputs){return crossing(i,false)}
export function pricedCriticalDistance(i:Inputs){return crossing(i,true)}
export function money(n:number){return "SEK "+Math.round(n).toLocaleString("en-US")}
export function kg(n:number){return Math.round(n).toLocaleString("en-US")+" kg"}
