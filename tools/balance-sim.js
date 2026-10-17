// Burger Bar economy model: income per day vs. the recommended buy order in
// docs/BALANCE.md. A spreadsheet in code, not the game: the constants mirror
// SHOP_DEFS / EQUIP_CAPS (06-shop-edit.js) and the payout in 14-main.js, so
// update both together when retuning.
//
// Usage: node tools/balance-sim.js [avgStars=4.0] [shareServed=0.85] [ratingMult=1.0]
//   average player:  node tools/balance-sim.js 4.0 0.85 1.0
//   strong player:   node tools/balance-sim.js 4.4 0.92 1.3   (4+ star rating = 1.3x groups)
const P = { stars: +process.argv[2]||4.0, served: +process.argv[3]||0.85, ratingMult: +process.argv[4]||1.0 };
const st = {cash:0, day:0, floor:0, trays:4, speed:0, grill:0.5, decor:1, tables:1, counters:0, soda:0, grills:0, sinks:0, fryer:0, robots:0, price:0, oc:0};
const cap = (k,f)=>({counter:Math.min(14,3+2*f), grill:Math.min(9,3+f), sink:Math.min(9,3+f), soda:Math.min(6,3+Math.ceil(f*.5)), table:Math.min(14,8+f)})[k];
const shop = {
  trays:   {day:1, cost:()=>60, ok:()=>st.trays<20, buy:()=>st.trays+=4},
  speed:   {day:1, cost:()=>60+st.speed*40, ok:()=>st.speed<5, buy:()=>st.speed++},
  grill:   {day:1, cost:()=>55+Math.floor(st.grill*25), ok:()=>st.grill<3, buy:()=>st.grill=Math.min(3,st.grill+.35)},
  table:   {day:3, cost:()=>80*(st.tables+1), ok:()=>st.tables<cap('table',st.floor), buy:()=>st.tables++},
  decor:   {day:3, cost:()=>45+Math.floor(st.decor*20), ok:()=>st.decor<3, buy:()=>st.decor=Math.min(3,st.decor+.35)},
  counter: {day:3, cost:()=>70+st.counters*35, ok:()=>st.counters<cap('counter',st.floor), buy:()=>st.counters++},
  price:   {day:4, cost:()=>Math.round(150*Math.pow(1.4,st.price)/5)*5, ok:()=>st.price<10, buy:()=>st.price++},
  soda:    {day:5, cost:()=>150+st.soda*100, ok:()=>st.soda<cap('soda',st.floor), buy:()=>st.soda++},
  expand:  {day:5, cost:()=>200*(st.floor+1), ok:()=>st.floor<6, buy:()=>st.floor++},
  xgrill:  {day:5, cost:()=>120+st.grills*80, ok:()=>st.grills<cap('grill',st.floor), buy:()=>st.grills++},
  xsink:   {day:5, cost:()=>90+st.sinks*60, ok:()=>st.sinks<cap('sink',st.floor), buy:()=>st.sinks++},
  robot:   {day:5, cost:()=>200+st.robots*60, ok:()=>st.robots<10, buy:()=>st.robots++},
  fryer:   {day:11,cost:()=>170, ok:()=>!st.fryer, buy:()=>st.fryer=1},
  overclock:{day:15,cost:()=>[600,1000,1600,2400,3500][st.oc], ok:()=>st.oc<5, buy:()=>st.oc++},
};
// Target counts by day: what a bar SHOULD own to keep up with that day's load.
// Each entry: [fromDay, item, targetCount-or-level]
const plan = [
  [1,'grill',1.2],[2,'trays',8],[3,'table',2],[3,'counter',1],[4,'price',1],[4,'speed',1],
  [5,'soda',1],[5,'table',3],[6,'robot',1],[6,'price',2],[7,'expand',1],[7,'counter',2],[8,'trays',12],[8,'decor',1.7],
  [9,'robot',2],[9,'xsink',1],[10,'table',4],[10,'price',3],[10,'xgrill',1],[11,'fryer',1],[11,'counter',4],
  [12,'robot',3],[12,'expand',2],[12,'speed',2],[13,'price',4],[13,'table',5],[14,'robot',4],[14,'counter',6],[14,'trays',16],
  [15,'xgrill',2],[15,'price',5],[15,'expand',3],[16,'robot',5],[16,'table',6],[16,'counter',8],[17,'xsink',2],[17,'decor',2.4],
  [18,'robot',6],[18,'price',6],[19,'expand',4],[19,'table',8],[19,'counter',10],[20,'trays',20],[20,'robot',7],[20,'grill',3],
  [21,'overclock',1],[21,'price',7],[22,'xgrill',4],[22,'robot',8],[23,'expand',5],[23,'counter',12],[23,'table',10],
  [24,'soda',2],[24,'xsink',4],[25,'overclock',2],[25,'price',8],[25,'robot',9],[26,'speed',5],[26,'decor',3],
  [27,'expand',6],[27,'robot',10],[28,'table',12],[28,'counter',14],[28,'price',9],[29,'overclock',3],[30,'price',10],
];
const level = k=>({trays:st.trays,speed:st.speed,grill:st.grill,table:st.tables,decor:st.decor,counter:st.counters,price:st.price,soda:st.soda,expand:st.floor,xgrill:st.grills,xsink:st.sinks,robot:st.robots,fryer:st.fryer,overclock:st.oc})[k];
function income(day){
  const groups = day===1 ? 2 : Math.round(Math.min(day+1,31)*P.ratingMult);   // base stops at Day 30; demand (grades) is the multiplier
  const s=P.stars;
  let pp = 16*(s/5) + (s>=4?(s-3)*1.5:0);
  if(st.soda) pp += 0.7*7*(s/5);
  if(st.fryer) pp += 0.22*5*(s/5);
  let m = day<=4?1.3:day<=6?1.15:1;
  const vip = day>=8?1.3:1, streak = day>=10?1.12:1.04;
  const price = 1+0.15*st.price;
  const goals = day>=2 ? 0.6*((30+day*3)+(40+day*4)) : 0;
  return groups*P.served*1.45*pp*m*vip*streak*price + goals;
}
const rows=[]; let spent=0, cum=0;
for(let d=1; d<=30; d++){
  st.day=d; const inc=income(d); st.cash+=inc; cum+=inc;
  // After the shift: buy anything on the plan that's due and affordable, in order.
  for(const [from,k,target] of plan){
    if(from>d+0) continue;
    while(level(k)<target-1e-9 && shop[k].ok() && d+1>=shop[k].day && st.cash>=shop[k].cost()){ const c=shop[k].cost(); st.cash-=c; spent+=c; shop[k].buy(); }
  }
  if([1,5,10,15,18,20,25,30].includes(d)) rows.push({day:d, income:Math.round(inc), earned:Math.round(cum), spent, bank:Math.round(st.cash),
     tables:st.tables, counters:2+st.counters, grills:1+st.grills, sinks:1+st.sinks, soda:st.soda, robots:st.robots, floor:st.floor, price:st.price, trays:st.trays, oc:st.oc,
     behind: plan.filter(([f,k,t])=>f<=d && level(k)<t-1e-9).map(([f,k,t])=>k+'→'+t).join(' ')});
}
console.table(rows);
