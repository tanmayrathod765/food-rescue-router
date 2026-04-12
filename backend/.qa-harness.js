const { solveTSP } = require('./src/algorithms/tsp/index');
const { findBestDriver } = require('./src/algorithms/matching/index');
const { claimPickup } = require('./src/services/claim.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const base='http://localhost:5000';
const out=[];
async function j(url,opts={}){ const r=await fetch(base+url,opts); const t=await r.text(); let b; try{b=JSON.parse(t);}catch{b=t;} return {status:r.status,body:b}; }
function pass(name,ok,detail){ out.push({name,ok,detail}); }
(async()=>{
  try{
    let r=await j('/health');
    pass('T1 Backend Health', r.status===200 && r.body.status==='ok', r.status);

    r=await j('/api/donors');
    pass('T3 Seed donors', r.status===200 && r.body.success && (r.body.data||[]).length>=3, (r.body.data||[]).length);
    const donors=r.body.data||[];
    const donorId=donors[0]?.id;

    r=await j('/api/drivers');
    const drivers=r.body.data||[];
    pass('T4 Seed drivers', r.status===200 && drivers.length>=3, drivers.map(d=>d.name+':'+d.vehicleType).join('|'));

    r=await j('/api/shelters');
    const shelters=r.body.data||[];
    pass('T5 Seed shelters', r.status===200 && shelters.length>=2, shelters.map(s=>s.name).join('|'));

    r=await j('/api/admin/stats');
    const st=r.body.data||{};
    pass('T6 Admin stats', r.status===200 && ['activeDrivers','pendingPickups','kgDeliveredToday','mealsToday'].every(k=>typeof st[k]==='number'), JSON.stringify(st));

    r=await j('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@foodrescue.com',password:'admin123'})});
    pass('T7 Admin login', r.status===200 && !!r.body.token && r.body.user?.role==='ADMIN', r.status);
    const adminToken=r.body.token;

    r=await j('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'pizzahut@demo.com',password:'demo123'})});
    pass('T8 Restaurant login', r.status===200 && r.body.user?.role==='RESTAURANT' && r.body.user?.entityData?.name==='Pizza Hut Vijay Nagar', r.status);

    r=await j('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'amit@demo.com',password:'demo123'})});
    pass('T9 Driver login', r.status===200 && r.body.user?.role==='DRIVER' && r.body.user?.entityData?.vehicleType==='CAR', r.status);

    r=await j('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'shelter1@demo.com',password:'demo123'})});
    pass('T10 Shelter login', r.status===200 && r.body.user?.role==='SHELTER', r.status);

    r=await j('/api/auth/me',{headers:{Authorization:'Bearer '+adminToken}});
    pass('T11 Auth me', r.status===200 && r.body.user?.role==='ADMIN', r.status);

    r=await j('/api/auth/me',{headers:{Authorization:'Bearer fake_token_123'}});
    pass('T12 Invalid token rejected', r.status===401, r.status);

    const closingTime=new Date(Date.now()+2*3600*1000).toISOString();
    r=await j('/api/donors/food-posting',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({donorId,foodType:'HOT_MEAL',isVeg:true,quantityKg:20,closingTime,timeSinceCooked:30,isRefrigerated:false})});
    const posting=r.body.data;
    pass('T13 Food posting create', r.status===201 && posting?.status==='AVAILABLE' && typeof posting?.urgencyScore==='number' && typeof posting?.safetyScore==='number', r.status);

    r=await j('/api/donors/safety-score',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({foodType:'HOT_MEAL',timeSinceCooked:30,isRefrigerated:false,closingTime:new Date(Date.now()+3600000).toISOString(),quantityKg:20})});
    pass('T14 Safety score API', r.status===200 && r.body?.data && typeof r.body.data.score==='number' && !!r.body.data.label, JSON.stringify(r.body.data||{}));

    const tsp=solveTSP({lat:22.74,lng:75.88},[{id:'p1',name:'Pizza Hut',lat:22.7533,lng:75.8937,foodType:'HOT_MEAL',quantityKg:20,closingTime:new Date(Date.now()+3600000)}],[{id:'s1',name:'City Shelter',lat:22.7196,lng:75.8577,closingTime:new Date(Date.now()+10800000)}]);
    pass('T15 TSP direct', tsp.success===true && tsp.totalDistance>0 && tsp.computeTimeMs<1000, JSON.stringify({stops:tsp.totalStops,dist:tsp.totalDistance,time:tsp.computeTimeMs}));

    const match=findBestDriver([{id:'d1',name:'Amit',vehicleType:'CAR',capacityKg:50,currentLat:22.74,currentLng:75.88,isAvailable:true,trustScore:92},{id:'d2',name:'Priya',vehicleType:'BIKE',capacityKg:10,currentLat:22.72,currentLng:75.86,isAvailable:true,trustScore:87}],{id:'f1',donorLat:22.7533,donorLng:75.8937,quantityKg:20,foodType:'HOT_MEAL',closingTime:new Date(Date.now()+3600000)});
    pass('T16 Matching direct', match.success===true && match.matchedDriver?.name==='Amit', JSON.stringify({winner:match.matchedDriver?.name,score:match.matchScore}));

    let p=await prisma.pickup.findFirst({where:{status:'PENDING'}});
    if(!p){
      const d=await prisma.donor.findFirst();
      const fp=await prisma.foodPosting.create({data:{donorId:d.id,foodType:'HOT_MEAL',isVeg:true,quantityKg:8,closingTime:new Date(Date.now()+3600000)}});
      p=await prisma.pickup.create({data:{foodPostingId:fp.id,status:'PENDING'}});
    }
    const ds=await prisma.driver.findMany({take:2});
    const [c1,c2]=await Promise.all([claimPickup(p.foodPostingId,ds[0].id,null),claimPickup(p.foodPostingId,ds[1].id,null)]);
    const winners=[c1,c2].filter(x=>x.success).length;
    pass('T17 Concurrency race prevention', winners===1 && (c1.raceConditionBlocked||c2.raceConditionBlocked), JSON.stringify({c1:c1.success,c2:c2.success,winners}));

    const b=await j('/api/gamification/badges/'+ds[0].id);
    const s=await j('/api/gamification/streak/'+ds[0].id);
    pass('T18 Gamification badges+streak', b.status===200 && s.status===200, JSON.stringify({badges:b.status,streak:s.status}));

    const ld=await j('/api/gamification/leaderboard/drivers');
    const ln=await j('/api/gamification/leaderboard/donors');
    pass('T19 Leaderboards', ld.status===200 && ln.status===200 && Array.isArray(ld.body.data) && Array.isArray(ln.body.data), JSON.stringify({drivers:ld.body.data?.length,donors:ln.body.data?.length}));

    const z=await j('/api/zones/analysis');
    pass('T20 Zone analysis', z.status===200 && Array.isArray(z.body.data) && z.body.data.length===5, z.status);

    const posts=await j('/api/donors/'+donorId+'/postings');
    const postingId=posts.body.data?.[0]?.id;
    const rp=await j('/api/donors/passport/'+postingId);
    pass('T21 Food passport', rp.status===200 && rp.body?.passport?.passportId && !!rp.body?.qrCode, rp.status);

    const sim=await j('/api/simulation/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scenario:'A',speed:5})});
    pass('T22 Simulation start', sim.status===200 && sim.body.success===true, sim.body.message||sim.status);

    console.log(JSON.stringify(out,null,2));
    await prisma.$disconnect();
  } catch(e){
    console.error('HARNESS_ERR', e);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
