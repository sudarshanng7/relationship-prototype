const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource, deferred } = require('./helpers/account-screen-harness.cjs');
const { createAccessRevalidation } = loadSource('src/hooks/useAccessRevalidation.ts', { react: {}, 'react-native': {} });
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function clock() {
  let now = 0, next = 0; const timers = new Map();
  return { now: () => now, schedule(fn, delay) { const id = ++next; timers.set(id, { at: now + delay, fn }); return () => timers.delete(id); },
    advance(ms) { const end = now + ms; for (;;) { const due = [...timers].filter(([, t]) => t.at <= end).sort((a,b) => a[1].at - b[1].at)[0]; if (!due) break; now = due[1].at; timers.delete(due[0]); due[1].fn(); } now = end; },
    size: () => timers.size,
  };
}
async function setup(t, verify = async () => ({ kind: 'ready', data: 'authorized' })) {
  const time = clock(), published = [], phases = []; let reads = 0;
  const access = createAccessRevalidation({ clock: time, verify: (valid) => { reads++; return verify(valid); }, publish: (data, revision) => published.push({ data, revision }), changed: (state) => phases.push(state) });
  t.after(access.stop); access.start(); await settle();
  return { access, time, published, phases, reads: () => reads };
}
test('initial authorization publishes a fresh resource and only one lease', async t => {
  const x = await setup(t); assert.equal(x.access.state().phase, 'ready'); assert.equal(x.access.canDispatch(), true); assert.equal(x.reads(), 1); assert.equal(x.time.size(), 2);
});
test('25-second refresh renews the read-start lease without a write', async t => {
  const x = await setup(t); x.time.advance(25000); await settle(); assert.equal(x.reads(), 2); assert.equal(x.access.state().verifiedAt, 25000); assert.equal(x.published.length, 2);
});
test('a delayed background read cannot extend an expired lease', async t => {
  const pending = deferred(); let n = 0; const x = await setup(t, () => ++n === 1 ? Promise.resolve({kind:'ready',data:1}) : pending.promise);
  x.time.advance(25000); await settle(); x.time.advance(5000); await settle(); assert.equal(x.access.hasFreshAccess(), false); assert.equal(x.access.state().phase, 'failed'); pending.resolve({kind:'ready',data:'late'}); await settle(); assert.equal(x.published.length, 1);
});
test('freshness is measured from request start, not delayed response completion', async t => {
  const pending = deferred(); const x = await setup(t, () => pending.promise); x.time.advance(4000); pending.resolve({kind:'ready',data:1}); await settle(); assert.equal(x.access.state().verifiedAt, 0); x.time.advance(26000); assert.equal(x.access.hasFreshAccess(), false);
});
for (const kind of ['failed','unavailable']) test(`${kind} validation hides the lease and blocks dispatch`, async t => {
  let n=0; const x = await setup(t, async () => ++n===1 ? {kind:'ready',data:1} : {kind}); await x.access.refresh(); assert.equal(x.access.state().phase,kind); assert.equal(x.access.canDispatch(),false); assert.equal(x.access.beginMutation(),null);
});
test('thrown and timeout failures never renew access or expose backend messages', async t => {
  const x = await setup(t, async () => { throw new Error('PRIVATE_BACKEND'); }); assert.equal(x.access.state().phase,'failed'); assert.equal(JSON.stringify(x.access.state()).includes('PRIVATE'),false); assert.equal(x.published.length,0);
});
test('overlapping triggers coalesce into the same verification', async t => {
  const pending = deferred(); const x = await setup(t, () => pending.promise); const a=x.access.refresh(true),b=x.access.refresh(true),c=x.access.refresh(); assert.equal(a,b); assert.equal(b,c); assert.equal(x.reads(),1); pending.resolve({kind:'ready',data:1}); assert.equal(await a,true);
});
test('backgrounding hides immediately and rejects the old response; resume requires a new read', async t => {
  const pending=deferred(); let n=0; const x=await setup(t, () => ++n===1 ? pending.promise : Promise.resolve({kind:'ready',data:'new'})); x.access.foreground(false); assert.equal(x.access.canDispatch(),false); assert.equal(x.time.size(),0); pending.resolve({kind:'ready',data:'old'}); await settle(); assert.equal(x.published.length,0); x.access.foreground(true); assert.equal(x.access.state().phase,'checking'); await settle(); assert.equal(x.published[0].data,'new');
});
test('unfocus stops recurring checks and refocus starts a new generation', async t => {
  const x=await setup(t); x.access.stop(); x.time.advance(90000); await settle(); assert.equal(x.reads(),1); assert.equal(x.time.size(),0); x.access.start(); await settle(); assert.equal(x.reads(),2);
});
test('invalidation rejects a late read even with a still-valid account', async t => {
  const pending=deferred(); const x=await setup(t,()=>pending.promise); x.access.invalidate(); pending.resolve({kind:'ready',data:'old'}); await settle(); assert.equal(x.published.length,0); assert.equal(x.access.canDispatch(),false);
});
test('a pending mutation retains its receipt callback after expiry and cannot be duplicated', async t => {
  const x=await setup(t); const finish=x.access.beginMutation(); assert.ok(finish); assert.equal(x.access.beginMutation(),null); x.time.advance(30000); assert.equal(x.access.hasFreshAccess(),false); assert.equal(await finish(),true); assert.equal(x.access.canDispatch(),true); const count=x.reads(); await finish(); assert.equal(x.reads(),count);
});
test('mutation start invalidates a pre-write read; reconciliation only publishes a post-write snapshot', async t => {
  const pending=deferred(); let n=0; const x=await setup(t,()=> ++n===2 ? pending.promise : Promise.resolve({kind:'ready',data:n})); const old=x.access.refresh(); await settle(); const finish=x.access.beginMutation(); assert.ok(finish); pending.resolve({kind:'ready',data:'pre-write'}); assert.equal(await old,false); await finish(); assert.deepEqual(x.published.map(p=>p.data),[1,3]);
});
test('unknown outcome schedules read-only verification without immediate retry', async t => {
  const x=await setup(t); const finish=x.access.beginMutation(); await finish(false); assert.equal(x.reads(),1); assert.equal(x.access.canDispatch(),false); x.time.advance(25000); await settle(); assert.equal(x.reads(),2); assert.equal(x.access.canDispatch(),true);
});
test('resume/focus verification waits for the pending mutation rather than suppressing its result', async t => {
  const x=await setup(t); const finish=x.access.beginMutation(); x.access.foreground(false); x.access.foreground(true); await settle(); assert.equal(x.reads(),1); assert.equal(x.access.hasFreshAccess(),false); await finish(); await settle(); assert.equal(x.reads(),2); assert.equal(x.access.canDispatch(),true);
});
test('cleanup resolves coalesced waiters and invalidates all publication', async t => {
  const x=await setup(t); const finish=x.access.beginMutation(); const queued=x.access.refresh(true); x.access.stop(); assert.equal(await queued,false); assert.equal(await finish(),false); assert.equal(x.time.size(),0);
});
test('an invalid freshness policy is rejected', () => { assert.throws(()=>createAccessRevalidation({verify(){},publish(){},changed(){},policy:{budgetMs:30,refreshMs:30,timeoutMs:5}})); });
test('background settles queued triggers; a write finishing inactive causes just one resume read', async t=>{
  const x=await setup(t);const finish=x.access.beginMutation();const queued=x.access.refresh(true);
  x.access.foreground(false);assert.equal(await queued,false);assert.equal(await finish(),false);assert.equal(x.time.size(),0);
  x.access.foreground(true);await settle();assert.equal(x.reads(),2);assert.equal(x.access.canDispatch(),true);
});

// Actual hook/effects with a controlled scheduler and synthetic lifecycle events.
function hookHarness() {
  const time=clock(),slots=[],events=new Map();let cursor=0,layout=[],passive=[],output,reads=0,published=[];
  const memo=(factory,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.length!==old.deps.length||deps.some((v,k)=>!Object.is(v,old.deps[k])))slots[i]={deps,value:factory()};return slots[i].value};
  const effect=(queue,fn,deps)=>{const i=cursor++,old=slots[i];if(old&&deps.length===old.deps.length&&deps.every((v,k)=>Object.is(v,old.deps[k])))return;slots[i]={deps,cleanup:old?.cleanup};queue.push(()=>{slots[i].cleanup?.();slots[i].cleanup=fn()})};
  const react={useMemo:memo,useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:initial};return[slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v}]},useLayoutEffect:(fn,deps)=>effect(layout,fn,deps),useEffect:(fn,deps)=>effect(passive,fn,deps)};
  const app={currentState:'active',addEventListener(_,fn){events.set('app',fn);return{remove:()=>events.delete('app')}}};let next=0;const cancels=new Map();
  const mod=loadSource('src/hooks/useAccessRevalidation.ts',{react,'react-native':{AppState:app,Platform:{OS:'web'}}},undefined,{Date:{now:time.now},setTimeout(fn,delay){const id=++next;cancels.set(id,time.schedule(fn,delay));return id},clearTimeout(id){cancels.get(id)?.();cancels.delete(id)},window:{addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)}});
  let verify=async()=>{reads++;return{kind:'ready',data:'initial'}},publish=data=>published.push(data);
  const render=()=>{cursor=0;output=mod.useAccessRevalidation({verify,publish});react.useEffect(()=>{output.controller.start();return()=>output.controller.stop()},[output.controller]);while(layout.length)layout.shift()();while(passive.length)passive.shift()()};
  return{time,render,get:()=>output,reads:()=>reads,published:()=>published,verify(fn){verify=async valid=>{reads++;return fn(valid)}},replacePublish(){publish=data=>published.push(data)},event:name=>events.get(name)?.(),foreground(active){app.currentState=active?'active':'background';events.get('app')?.(app.currentState)},unmount(){slots.forEach(s=>s.cleanup?.())}};
}
for(const callback of ['verify','publish'])test(`7B.1R replacing ${callback} preserves focused lifecycle and one recurring timer`,async t=>{
  const h=hookHarness();t.after(h.unmount);h.render();await settle();h.render();
  if(callback==='verify')h.verify(async()=>({kind:'ready',data:'new'}));else h.replacePublish();h.render();await settle();h.render();
  assert.equal(h.get().controller.hasFreshAccess(),true);const reads=h.reads();h.time.advance(25000);await settle();h.render();assert.equal(h.reads(),reads+1);assert.equal(h.time.size(),2);
  h.get().controller.stop();const stopped=h.reads();h.replacePublish();h.render();h.event('focus');h.event('online');h.time.advance(90000);await settle();assert.equal(h.reads(),stopped);assert.equal(h.time.size(),0);
});
test('7B.1R callback replacement cancels a checking generation before accepting its late response',async t=>{
  const h=hookHarness(),pending=deferred();t.after(h.unmount);h.verify(()=>pending.promise);h.render();await settle();const old=h.get().controller.refresh();
  h.verify(async()=>({kind:'ready',data:'new'}));h.render();await settle();h.render();assert.equal(await old,false);pending.resolve({kind:'ready',data:'old'});await settle();
  assert.deepEqual(h.published(),['new']);assert.equal(h.get().controller.hasFreshAccess(),true);
});
test('7B.1R callback replacement during a mutation keeps queued readers settled and does not duplicate work',async t=>{
  const h=hookHarness();t.after(h.unmount);h.render();await settle();h.render();const finish=h.get().controller.beginMutation();const old=h.get().controller.refresh(true);
  h.replacePublish();h.render();assert.equal(await old,false);assert.equal(h.reads(),1);await finish();await settle();h.render();assert.equal(h.reads(),2);assert.equal(h.get().controller.canDispatch(),true);
  h.foreground(false);assert.equal(h.time.size(),0);h.foreground(true);await settle();h.render();assert.equal(h.reads(),3);
});
test('7B.1R hook unmount settles a pending read and rejects its eventual network response',async()=>{
  const h=hookHarness(),pending=deferred();h.verify(()=>pending.promise);h.render();await settle();const old=h.get().controller.refresh();h.unmount();assert.equal(await old,false);pending.resolve({kind:'ready',data:'late'});await settle();assert.deepEqual(h.published(),[]);assert.equal(h.time.size(),0);
});
