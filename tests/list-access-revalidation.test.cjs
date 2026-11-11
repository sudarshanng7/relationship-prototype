const assert=require('node:assert/strict');
const {test}=require('node:test');
const {harness,deferred}=require('./helpers/account-screen-harness.cjs');
const {client,momentsClient,momentRepair}=require('./helpers/account-screen-client.cjs');
// Real screens, account boundary and committed coordinator. Time, host elements,
// transport and Realtime notifications are synthetic; these are not RLS tests.
function clock(){let now=0,id=0;const timers=new Map();return{now:()=>now,schedule(fn,delay){const key=++id;timers.set(key,{at:now+Math.max(0,delay),fn});return()=>timers.delete(key)},advance(ms){const end=now+ms;for(;;){const due=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn()}now=end},size:()=>timers.size}}
const updated='2026-11-08T12:00:00Z';
const perspective=(author_id,extra={})=>({id:'p-'+author_id,author_id,perspective_text:author_id+' OWN RETAINED WORDS',sharing_status:'suspended',updated_at:updated,...extra});
const ownRepair=(user_id,extra={})=>({event_id:'hidden-'+user_id,user_id,repair_status:'reconnected',what_helped:'space',sharing_status:'private',status_origin:'explicit',updated_at:updated,...extra});
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):typeof n==='string'?n:'';
const cards=ui=>ui.nodes().filter(n=>n.type==='Pressable'&&n.props.testID?.startsWith('moment-'));
const ids=ui=>cards(ui).map(n=>n.props.testID.slice(7)).sort();
const ownText=ui=>ui.text().includes('OWN RETAINED WORDS');
const empty=/No moments here yet|Nothing shared here yet|private space is quiet|No contributions available/;
function noProtected(ui,kind){
  assert.equal(cards(ui).length,0);assert.equal(ownText(ui),false);
  assert.ok(!ui.nodes().some(n=>n.type==='Text'&&/^Your update:|^Partner shared:|^My report:|^What helped me:/.test(text(n))));
  if(kind==='contributions')assert.ok(!ui.nodes().some(n=>n.props.accessibilityRole==='header'&&['My perspective','My repair update'].includes(text(n))));
  assert.doesNotMatch(ui.text(),empty);
}
async function setup(t,kind,configure,options={}){
  const db=kind==='moments'?momentsClient():client(),time=clock();
  if(kind==='contributions'){db.perspectives=[perspective('a'),perspective('b')];db.repairs=[ownRepair('a'),ownRepair('b')]}
  configure?.(db);
  const ui=harness(db,kind==='moments'?'src/app/events.tsx':'src/app/my-contributions.tsx',{
    accessClock:time,webLifecycle:true,imports:{'@/components/AppBottomNav':{AppBottomNav:()=>null}},...options,
  });t.after(ui.unmount);await ui.flush();return{db,ui,time};
}
const refresh=kind=>kind==='moments'?'Refresh moments and repair updates':'Refresh my contributions';
const authChecks=(db,kind)=>kind==='moments'?db.authChecks:db.checks.length;
for(const kind of ['moments','contributions']){
 test(`${kind}: focused lease expires without retaining protected hosts or verified-empty copy`,async t=>{
  const {db,ui,time}=await setup(t,kind);const original=db.read,pending=deferred();let held;
  db.read=call=>{if(call.table===(kind==='moments'?'relationship_events':'event_perspectives')){held=structuredClone(kind==='moments'?db.defaultRead(call):{data:[perspective('a')],error:null});return pending.promise}return original(call)};
  time.advance(25000);await ui.flush();assert.equal(kind==='moments'?cards(ui).length>0:ownText(ui),true,'the prior lease is still fresh while the read runs');
  time.advance(5000);await ui.flush();noProtected(ui,kind);assert.match(ui.text(),/Could not verify access/);
  pending.resolve(held);await ui.flush();noProtected(ui,kind);db.read=original;await ui.tap(refresh(kind));assert.equal(kind==='moments'?cards(ui).length>0:ownText(ui),true);
 });
 test(`${kind}: failed verification hides all rows and explicit recovery only reads`,async t=>{
  const {db,ui}=await setup(t,kind);const original=db.read;db.read=call=>call.table==='event_repair_states'?Promise.resolve({data:null,error:{message:'PRIVATE_BACKEND_DETAIL'}}):original(call);
  await ui.tap(refresh(kind));noProtected(ui,kind);assert.doesNotMatch(ui.text(),/PRIVATE_BACKEND_DETAIL/);db.read=original;await ui.tap(refresh(kind));assert.equal(kind==='moments'?cards(ui).length>0:ownText(ui),true);assert.equal(db.writes?.length??0,0);
 });
 test(`${kind}: membership loss hides rows, closes the relationship channel and never becomes verified empty`,async t=>{
  const {db,ui,time}=await setup(t,kind);const old=db.channels.at(-1);db.memberships.delete('a');time.advance(25000);await ui.flush();noProtected(ui,kind);assert.equal(old.removed,true);
  assert.ok(db.reads.slice(-1).every(call=>call.table==='couple_members'));db.memberships.set('a','couple-1');await ui.tap(refresh(kind));assert.equal(kind==='moments'?cards(ui).length>0:ownText(ui),true);
 });
 for(const replacement of [null,'replacement-couple'])test(`${kind}: membership ${replacement} during child reads invalidates the assembled snapshot`,async t=>{
  const {db,ui}=await setup(t,kind);const original=db.read;let changed=false;db.read=async call=>{const result=await original(call);if(!changed&&call.table==='event_repair_states'){changed=true;if(replacement)db.memberships.set('a',replacement);else db.memberships.delete('a')}return result};await ui.tap(refresh(kind));noProtected(ui,kind);assert.equal(db.writes?.length??0,0);
 });
 test(`${kind}: background and offline remove content; resume and online require fresh reads`,async t=>{
  const {db,ui,time}=await setup(t,kind);const initial=db.reads.length;await ui.appState('background');noProtected(ui,kind);time.advance(90000);await ui.flush();assert.equal(db.reads.length,initial);
  await ui.appState('active');assert.equal(kind==='moments'?cards(ui).length>0:ownText(ui),true);
  await ui.webEvent('offline');noProtected(ui,kind);await ui.webEvent('online');assert.equal(kind==='moments'?cards(ui).length>0:ownText(ui),true);assert.equal(db.writes?.length??0,0);
 });
 test(`${kind}: overlapping notification bursts coalesce and ordinary refreshes retain one subscription`,async t=>{
  const {db,ui}=await setup(t,kind);const channel=db.channels.at(-1),before=db.reads.length;for(let i=0;i<8;i++)channel.handlers[0].handler({new:{perspective_text:'UNTRUSTED_PUSH_PAYLOAD',category:'UNTRUSTED_PUSH_PAYLOAD'}});await ui.flush();
  assert.equal(db.reads.length-before,kind==='moments'?6:4);assert.equal(db.channels.length,1);assert.equal(channel.removed,false);assert.doesNotMatch(ui.text(),/UNTRUSTED_PUSH_PAYLOAD/);
  await ui.tap(refresh(kind));await ui.tap(refresh(kind));assert.equal(db.channels.length,1);assert.equal(db.writes?.length??0,0);
 });
 for(const status of ['CHANNEL_ERROR','TIMED_OUT','CLOSED'])test(`${kind}: ${status} invalidates access and SUBSCRIBED triggers verified recovery`,async t=>{
  const {db,ui}=await setup(t,kind);const channel=db.channels.at(-1);channel.status(status);ui.render();await ui.flush();noProtected(ui,kind);channel.status('SUBSCRIBED');await ui.flush();assert.equal(kind==='moments'?cards(ui).length>0:ownText(ui),true);assert.equal(db.channels.length,1);
  const count=db.reads.length;channel.status('SUBSCRIBED');await ui.flush();assert.equal(db.reads.length,count);
 });
 test(`${kind}: periodic fallback recovers even if the channel stays failed`,async t=>{
  const {db,ui,time}=await setup(t,kind);db.channels.at(-1).status('CHANNEL_ERROR');ui.render();noProtected(ui,kind);time.advance(25000);await ui.flush();assert.equal(kind==='moments'?cards(ui).length>0:ownText(ui),true);assert.equal(db.channels.length,1);
 });
 test(`${kind}: blur cleans up the subscription, ignores old hints and rejects outstanding reads`,async t=>{
  const {db,ui,time}=await setup(t,kind);const channel=db.channels.at(-1),original=db.read,pending=deferred();db.read=()=>pending.promise;channel.handlers[0].handler();await ui.flush();await ui.blur();assert.equal(channel.removed,true);const count=db.reads.length;channel.handlers[0].handler();channel.status('SUBSCRIBED');time.advance(90000);await ui.flush();assert.equal(db.reads.length,count);
  pending.resolve({data:[],error:null});await ui.flush();assert.equal(cards(ui).length,0);assert.equal(ownText(ui),false);db.read=original;await ui.focus();assert.equal(kind==='moments'?cards(ui).length>0:ownText(ui),true);assert.equal(db.channels.filter(c=>!c.removed).length,1);
 });
 test(`${kind}: a delayed Account A child response cannot repopulate Account B`,async t=>{
  const {db,ui}=await setup(t,kind);const original=db.read,pending=deferred();let held=false;db.read=call=>{if(!held&&call.table==='event_repair_states'&&call.headers.Authorization==='Bearer a-token'){held=true;return pending.promise}return original(call)};
  ui.find(refresh(kind)).props.onPress();await ui.flush();await ui.switchAccount('b');pending.resolve({data:[kind==='moments'?momentRepair():ownRepair('a')],error:null});await ui.flush();
  if(kind==='moments'){assert.ok(ids(ui).includes('b-mine'));assert.ok(!ids(ui).includes('a-mine'))}else{assert.match(ui.text(),/b OWN RETAINED WORDS/);assert.doesNotMatch(ui.text(),/a OWN RETAINED WORDS/)}
  assert.ok(db.channels.filter(c=>!c.removed).every(c=>kind==='moments'?c.name.includes('-b-'):true));assert.equal(db.writes?.length??0,0);
 });
 for(const malformed of [null,{},'unexpected'])test(`${kind}: malformed child data ${JSON.stringify(malformed)} is failed verification, never an empty list`,async t=>{
  const {db,ui}=await setup(t,kind);const original=db.read;db.read=call=>call.table==='event_repair_states'?Promise.resolve({data:malformed,error:null}):original(call);await ui.tap(refresh(kind));noProtected(ui,kind);
 });
 test(`${kind}: request cadence is bounded and background verification performs zero writes`,async t=>{
  const {db,ui,time}=await setup(t,kind);const reads=db.reads.length,auth=authChecks(db,kind);for(let i=0;i<4;i++){time.advance(25000);await ui.flush()}
  assert.equal(db.reads.length-reads,kind==='moments'?24:16);assert.equal(authChecks(db,kind)-auth,8);assert.equal(db.channels.length,1);assert.equal(db.writes?.length??0,0);
 });
}

test('moments: Ours becomes Mine; the peer loses the card and the author retains it privately',async t=>{
 const {db,ui,time}=await setup(t,'moments');db.events.find(e=>e.id==='b-ours').visibility='mine';time.advance(25000);await ui.flush();assert.ok(!ids(ui).includes('b-ours'));
 await ui.switchAccount('b');await ui.tap('Show Mine moments');assert.ok(ids(ui).includes('b-ours'));assert.equal(db.writes?.length??0,0);
});
test('moments: withdrawal removes only the stale partner summary while the event remains',async t=>{
 const {db,ui,time}=await setup(t,'moments',db=>{db.repairs=[momentRepair(),momentRepair({user_id:'b',sharing_status:'shared',what_helped:'talking'})]});assert.match(ui.text(),/Partner shared:/);
 db.repairs[1].sharing_status='private';db.repairs[1].report_version++;time.advance(25000);await ui.flush();assert.ok(ids(ui).includes('a-ours'));assert.doesNotMatch(ui.text(),/Partner shared:/);assert.match(ui.text(),/Your update: Still unresolved/);
});
for(const race of ['parent','withdrawal','version'])test(`moments: ${race} changes during assembly cannot publish a mixed snapshot`,async t=>{
 const {db,ui}=await setup(t,'moments',db=>{db.repairs=[momentRepair({user_id:'b',sharing_status:'shared',what_helped:'talking'})]});const original=db.read;let once=true;
 db.read=async call=>{const result=await original(call);if(once&&call.table==='event_repair_states'){once=false;if(race==='parent')db.events.find(e=>e.id==='a-ours').visibility='mine';else if(race==='withdrawal')db.repairs[0].sharing_status='private';else db.repairs[0].report_version++}return result};
 await ui.tap(refresh('moments'));noProtected(ui,'moments');db.read=original;await ui.tap(refresh('moments'));assert.equal(cards(ui).length>0,true);assert.equal(db.writes?.length??0,0);
});
test('moments: Realtime during the periodic read discards it and coalesces a fresh generation',async t=>{
 const {db,ui,time}=await setup(t,'moments');const original=db.read,pending=deferred();let once=true;db.read=call=>{if(once&&call.table==='relationship_events'){once=false;return pending.promise}return original(call)};
 time.advance(25000);await ui.flush();for(let i=0;i<5;i++)db.channels[0].handlers[0].handler();ui.render();noProtected(ui,'moments');pending.resolve({data:[{id:'STALE_PARENT',creator_id:'a',couple_id:'couple-1',visibility:'mine',event_type:'positive'}],error:null});await ui.flush();assert.ok(!ids(ui).includes('STALE_PARENT'));assert.equal(cards(ui).length,4);assert.equal(db.channels.length,1);
});
test('moments: selected local filter survives unchanged refresh, expiry/recovery and genuine refocus',async t=>{
 const {ui}=await setup(t,'moments');await ui.tap('Show Mine moments');const expected=ids(ui);await ui.tap(refresh('moments'));assert.deepEqual(ids(ui),expected);assert.equal(ui.find('Show Mine moments').props.accessibilityState.selected,true);
 await ui.blur();await ui.focus();assert.deepEqual(ids(ui),expected);assert.equal(ui.find('Show Mine moments').props.accessibilityState.selected,true);
});
test('contributions: hidden parent retention never adds a parent lookup or navigation affordance',async t=>{
 const {db,ui,time}=await setup(t,'contributions');db.hiddenParent={visibility:'mine',category:'HIDDEN_PARENT',shared_topic:'PRIVATE_PARTNER_TOPIC'};time.advance(25000);await ui.flush();assert.match(ui.text(),/a OWN RETAINED WORDS/);assert.match(ui.text(),/My report: I feel reconnected/);
 assert.ok(db.reads.every(c=>['couple_members','event_perspectives','event_repair_states'].includes(c.table)));assert.doesNotMatch(ui.text(),/HIDDEN_PARENT|PRIVATE_PARTNER_TOPIC|hidden-a|hidden-b|b OWN RETAINED WORDS/);
 assert.deepEqual(ui.nodes().filter(n=>n.type==='Pressable').map(n=>n.props.accessibilityLabel).sort(),['Back to Moments','Refresh my contributions']);assert.equal(db.writes.length,0);
});
test('contributions: refreshed own status and provenance replace old text without inferring partner state',async t=>{
 const {db,ui,time}=await setup(t,'contributions');db.perspectives[0].perspective_text='NEW OWN WORDS';db.repairs[0].status_origin='legacy_default_unconfirmed';db.repairs[0].what_helped='humour';time.advance(25000);await ui.flush();assert.doesNotMatch(ui.text(),/a OWN RETAINED WORDS|My report:|What helped me:/);assert.match(ui.text(),/NEW OWN WORDS|Unconfirmed legacy default/);assert.doesNotMatch(ui.text(),/b OWN RETAINED WORDS|mutually repaired/);assert.equal(db.writes.length,0);
});

for(const kind of ['moments','contributions'])test(`${kind}: focused callback replacement rejects old reads and keeps periodic verification alive`,async t=>{
 let dbRef;const makeScope=()=>({userId:'a',isCurrent:()=>true,authorize:async()=>{const {data}=await dbRef.supabase.auth.getSession();const token=data.session.access_token;const {data:auth}=await dbRef.supabase.auth.getUser(token);return{user:auth.user,token}}});let liveScope=makeScope();
 const pending=deferred();let once=true;
 const {db,ui,time}=await setup(t,kind,db=>{dbRef=db;const original=db.read;db.read=call=>{if(once&&call.table===(kind==='moments'?'event_repair_states':'event_perspectives')){once=false;return pending.promise}return original(call)}},{imports:{
  '@/components/AppBottomNav':{AppBottomNav:()=>null},
  '@/components/AccountSessionBoundary':{AccountSessionBoundary:({children})=>children,useAccountSessionScope:()=>liveScope},
 }});
 liveScope=makeScope();await ui.flush();assert.equal(kind==='moments'?cards(ui).length>0:ownText(ui),true);
 pending.resolve({data:kind==='moments'?[momentRepair({user_id:'b',sharing_status:'shared',what_helped:'humour'})]:[perspective('a',{perspective_text:'LATE_CALLBACK_CANARY'})],error:null});await ui.flush();assert.doesNotMatch(ui.text(),/LATE_CALLBACK_CANARY|Partner shared:.*Humour/);
 const count=db.reads.length;time.advance(25000);await ui.flush();assert.equal(db.reads.length-count,kind==='moments'?6:4);assert.equal(db.channels.length,1);assert.equal(db.writes?.length??0,0);
});
for(const kind of ['moments','contributions'])test(`${kind}: unavailable membership takes precedence over an earlier channel failure`,async t=>{
 const {db,ui,time}=await setup(t,kind);const channel=db.channels.at(-1);channel.status('CHANNEL_ERROR');ui.render();db.memberships.delete('a');time.advance(25000);await ui.flush();noProtected(ui,kind);
 assert.match(ui.text(),kind==='moments'?/Your relationship space is unavailable/:/relationship space is unavailable/);
 assert.doesNotMatch(ui.text(),/Live access checks are unavailable/);assert.equal(channel.removed,true);assert.equal(db.writes?.length??0,0);
});

// Inject raw response elements after the synthetic transport's authorization
// filtering, so even malformed partner rows must be validated before filtering.
const invalidEventFields = [
 ['missing event ID','id',undefined], ['blank event ID','id',' '],
 ['missing creator ID','creator_id',undefined], ['invalid creator ID','creator_id',42],
 ['missing couple ID','couple_id',undefined], ['invalid couple ID','couple_id',{}],
 ['invalid event visibility','visibility','unsupported'], ['invalid event type','event_type','unsupported'],
 ['missing category','category',undefined], ['invalid category','category',null],
 ['missing event timestamp','created_at',undefined], ['invalid event timestamp','created_at','ROW_VALIDATION_CANARY'],
 ['missing intensity','intensity',undefined], ['invalid intensity','intensity',6],
 ['fractional intensity','intensity',1.5],
];
const invalidRepairFields = [
 ['missing repair event ID','event_id',undefined], ['invalid repair event ID','event_id',{}],
 ['missing repair user ID','user_id',undefined], ['blank repair user ID','user_id',' '],
 ['invalid repair status','repair_status','ROW_VALIDATION_CANARY'],
 ['missing repair method','what_helped',undefined], ['invalid repair method','what_helped','ROW_VALIDATION_CANARY'],
 ['invalid repair sharing','sharing_status','ROW_VALIDATION_CANARY'],
 ['invalid repair provenance','status_origin','ROW_VALIDATION_CANARY'],
];
const invalidVersions = [undefined,0,-1,1.5,'1',Number.MAX_SAFE_INTEGER+1,NaN,Infinity,null];
const invalidPerspectiveFields = [
 ['missing perspective ID','id',undefined], ['missing perspective author','author_id',undefined],
 ['invalid perspective author','author_id',{}], ['invalid perspective sharing','sharing_status','ROW_VALIDATION_CANARY'],
 ['missing perspective text','perspective_text',undefined], ['invalid perspective text','perspective_text',null],
 ['empty perspective text','perspective_text',''], ['blank perspective text','perspective_text','   '],
 ['missing perspective timestamp','updated_at',undefined], ['invalid perspective timestamp','updated_at','ROW_VALIDATION_CANARY'],
];
const rowCases = [
 ...invalidEventFields.map(([name,field,value])=>({kind:'moments',table:'relationship_events',name,field,value})),
 ...invalidRepairFields.map(([name,field,value])=>({kind:'moments',table:'event_repair_states',name,field,value})),
 ...invalidVersions.map((value,i)=>({kind:'moments',table:'event_repair_states',name:i===0?'missing report version':`invalid report version ${String(value)}`,field:'report_version',value})),
 ...invalidPerspectiveFields.map(([name,field,value])=>({kind:'contributions',table:'event_perspectives',name,field,value})),
 ...invalidRepairFields.map(([name,field,value])=>({kind:'contributions',table:'event_repair_states',name,field,value})),
 ...[undefined,null,'ROW_VALIDATION_CANARY'].map(value=>({kind:'contributions',table:'event_repair_states',name:`invalid repair timestamp ${String(value)}`,field:'updated_at',value})),
];
for(const {kind,table,name,field,value} of rowCases)test(`row validation ${kind}: ${name}`,async t=>{
 const {db,ui}=await setup(t,kind,db=>{if(kind==='moments')db.repairs=[momentRepair(),momentRepair({user_id:'b',sharing_status:'shared'})]});
 const original=db.read;let firstMalformed;
 db.read=async call=>{
  const result=await original(call);
  if(call.table!==table)return result;
  const malformed={...result.data.at(-1),[field]:value};
  if(value===undefined)delete malformed[field];
  firstMalformed??=structuredClone(malformed);
  // Keep a valid row alongside the bad one. Repeated batches are identical.
  return {data:[result.data[0],firstMalformed],error:null};
 };
 await ui.tap(refresh(kind));
 assert.match(ui.text(),/Could not verify access to your (moments|contributions)\. Refresh to check again\./);
 noProtected(ui,kind);
 const accessible=ui.nodes().map(n=>[n.props.accessibilityLabel,n.props.accessibilityHint,n.type==='Text'?text(n):''].filter(Boolean).join(' ')).join(' ');
 assert.doesNotMatch(accessible,/ROW_VALIDATION_CANARY|OWN RETAINED WORDS|Partner shared:|Your update:|My report:|My perspective|My repair update/);
 assert.equal(db.writes?.length??0,0);
});

for(const kind of ['moments','contributions'])test(`row validation ${kind}: malformed partner row cannot be filtered into verified emptiness`,async t=>{
 const {db,ui}=await setup(t,kind);const original=db.read;
 db.read=async call=>call.table==='event_repair_states'?{data:[{...momentRepair({user_id:'other',sharing_status:'private'}),updated_at:updated,status_origin:'ROW_VALIDATION_CANARY'}],error:null}:original(call);
 await ui.tap(refresh(kind));noProtected(ui,kind);assert.match(ui.text(),/Could not verify access/);assert.doesNotMatch(ui.text(),/ROW_VALIDATION_CANARY/);assert.equal(db.writes?.length??0,0);
});

test('row validation: schema-valid historical text, nullable intensity and all repair methods remain readable',async t=>{
 const {db,ui}=await setup(t,'moments');db.events.find(e=>e.id==='a-ours').intensity=null;db.events.find(e=>e.id==='a-mine').category='';
 for(const method of [null,'talking','space','apology','affection','humour','practical_action','time','other']){
  db.repairs=[momentRepair({what_helped:method})];await ui.tap(refresh('moments'));assert.equal(cards(ui).length,4);assert.match(ui.text(),/Your update: Still unresolved/);
 }
 assert.equal(db.writes?.length??0,0);
});
test('row validation: contribution query needs no version and preserves SQL-valid text and every provenance',async t=>{
 const {db,ui}=await setup(t,'contributions');
 for(const origin of ['explicit','legacy_creator_report','legacy_default_unconfirmed']){
  // PostgreSQL btrim(text) strips spaces, not every JavaScript whitespace char.
  db.perspectives=[perspective('a',{perspective_text:'\t',sharing_status:'submitted'})];db.repairs=[ownRepair('a',{status_origin:origin,what_helped:null})];
  await ui.tap(refresh('contributions'));assert.match(ui.text(),/My perspective/);assert.match(ui.text(),origin==='legacy_default_unconfirmed'?/Unconfirmed legacy default/:/My report:/);
 }
 assert.ok(db.reads.every(c=>!c.columns.includes('report_version')));assert.equal(db.writes.length,0);
});
