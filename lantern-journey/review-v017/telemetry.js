(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else {root.LanternTelemetryFactory=factory;root.LanternTelemetry=factory();}
})(typeof globalThis!=='undefined'?globalThis:this,function createTelemetry(options){
  'use strict';
  const o=options||{},root=typeof globalThis!=='undefined'?globalThis:{},clock=o.now||Date.now;
  let storage=o.storage;try{if(storage===undefined)storage=root.localStorage;}catch(_){storage=null;}
  const crypto=o.crypto||root.crypto,fetcher=o.fetch||root.fetch?.bind(root);
  const CONSENT='lantern.analytics.consent.v1',IDENTITY='lantern.analytics.install.v1';
  const enumOf=(...xs)=>v=>xs.includes(v),integer=(min,max)=>v=>Number.isInteger(v)&&v>=min&&v<=max;
  const screen=enumOf('title','home','map','battle','result','party','equipment','growth','forge','summon','shop','pass','rewards','story','settings');
  const policy=enumOf('balanced','aggressive','defensive'),mode=enumOf('auto','paused','manual');
  const difficulty=integer(0,2),stage=integer(0,20),count=integer(0,10000),boolean=v=>typeof v==='boolean';
  const schemas={
    tutorial_started:{required:['step'],fields:{step:integer(0,20)}},
    tutorial_completed:{required:['step'],fields:{step:integer(0,20)}},
    screen_viewed:{required:['screen'],fields:{screen}},
    battle_started:{required:['stage','difficulty','mode'],fields:{stage,difficulty,mode,policy,waves:integer(1,3),tower_floor:integer(0,1000),resumed:boolean}},
    battle_ended:{required:['stage','difficulty','outcome','duration_ms'],fields:{stage,difficulty,outcome:enumOf('won','lost','retreat'),duration_ms:integer(0,7200000),mode,policy,waves:integer(0,3),tower_floor:integer(0,1000),resumed:boolean}},
    battle_mode_changed:{required:['mode'],fields:{mode,stage,difficulty}},
    battle_policy_changed:{required:['policy'],fields:{policy,stage,difficulty}},
    growth_used:{required:['operation','count'],fields:{operation:enumOf('equip_best','gear_upgrade','skill_upgrade','awaken','batch_upgrade','dismantle','deck_save','auto_party','equip_manual','bond','sigil_upgrade','tonic_upgrade'),count,power_delta:integer(-1000000,1000000)}},
    summon_completed:{required:['banner','count'],fields:{banner:enumOf('standard','weapons','heroes','featured','sigils'),count:integer(1,10),highest_rarity:integer(0,4),new_characters:integer(0,10),pity_triggered:boolean}},
    reward_claimed:{required:['source','count'],fields:{source:enumOf('login','stage','quest','achievement','tower','daily','weekly','event','pass','hunt','collection','all'),count}},
    shop_viewed:{required:['tab'],fields:{tab:enumOf('featured','exchange','product'),product:enumOf('harbor-pass','star-lantern')}},
    session_started:{required:['screen'],fields:{screen}},
    session_ended:{required:['screen','duration_ms','reason'],fields:{screen,duration_ms:integer(0,86400000),reason:enumOf('pagehide','manual','idle')}}
  };
  function read(k){try{return storage?.getItem(k)||null;}catch(_){return null;}}
  function write(k,v){try{storage?.setItem(k,v);}catch(_){}}
  function remove(k){try{storage?.removeItem(k);}catch(_){}}
  function uuid(){try{if(crypto?.randomUUID)return crypto.randomUUID();if(!crypto?.getRandomValues)return null;const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;return Array.from(b,(v,i)=>([4,6,8,10].includes(i)?'-':'')+v.toString(16).padStart(2,'0')).join('');}catch(_){return null;}}
  const uuidOK=v=>typeof v==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(v);
  let consent=read(CONSENT)==='yes',config=null,id=null,session=null,lastScreen='title',queue=[],active=null,flushing=null,epoch=0;
  function enabled(){return Boolean(consent&&config&&fetcher&&crypto);}
  function identity(){if(id)return id;const saved=read(IDENTITY);id=uuidOK(saved)?saved:uuid();if(id)write(IDENTITY,id);return id;}
  function configure(c){
    // Only public ingestion tokens; personal/API secrets are never accepted.
    config=null;queue=[];epoch++;active?.abort();
    if(!c||!['https://us.i.posthog.com','https://eu.i.posthog.com'].includes(c.host)||!/^phc_[a-zA-Z0-9_-]{12,160}$/.test(c.token||''))return false;
    config={host:c.host,token:c.token,version:/^\d+\.\d+(?:\.\d+)?$/.test(c.version||'')?c.version:'0.15.0',environment:c.environment==='production'?'production':'staging'};
    return true;
  }
  function setConsent(value){
    consent=value===true;write(CONSENT,consent?'yes':'no');
    if(!consent){epoch++;active?.abort();queue=[];id=null;session=null;remove(IDENTITY);}
    return consent;
  }
  function track(name,raw){
    if(!enabled()||!Object.hasOwn(schemas,name))return false;
    const shape=schemas[name],input=raw&&typeof raw==='object'?raw:{},props={};
    for(const [k,valid]of Object.entries(shape.fields))if(valid(input[k]))props[k]=input[k];
    if(shape.required.some(k=>props[k]===undefined))return false;
    const distinct=identity(),eventID=uuid();if(!distinct||!eventID)return false;
    // No game saves, account identity, URLs, DOM text, browser fingerprints or profiles.
    const item={api_key:config.token,distinct_id:distinct,event:'lantern_'+name,uuid:eventID,timestamp:new Date(clock()).toISOString(),properties:{...props,game_version:config.version,environment:config.environment,schema_version:1,$process_person_profile:false,$geoip_disable:true}};
    if(session)item.properties.session_id=session.id;
    // Reject a new event when full, preserving the in-flight head and its retry UUID.
    if(queue.length>=128)return false;queue.push({event:item,attempts:0});return true;
  }
  function flush(){
    if(flushing)return flushing;if(!enabled()||!queue.length)return Promise.resolve(0);
    const ownEpoch=epoch,endpoint=config.host+'/i/v0/e/';
    flushing=(async()=>{let sent=0;
      while(queue.length&&enabled()&&epoch===ownEpoch){
        const item=queue[0];active=typeof AbortController!=='undefined'?new AbortController():null;
        const timer=active?setTimeout(()=>active?.abort(),8000):null;
        try{
          const response=await fetcher(endpoint,{method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(item.event),signal:active?.signal});
          if(epoch!==ownEpoch)break;
          if(response.ok){queue.shift();sent++;}
          else if(response.status>=400&&response.status<500&&response.status!==408&&response.status!==429){queue.shift();}
          else {if(++item.attempts>=3)queue.shift();break;}
        }catch(_){if(epoch===ownEpoch&&++item.attempts>=3)queue.shift();break;}
        finally {if(timer)clearTimeout(timer);active=null;}
      }
      return sent;
    })().finally(()=>{flushing=null;});return flushing;
  }
  function startSession(scene){if(!enabled()||session)return false;const sessionID=uuid();if(!sessionID)return false;session={id:sessionID,started:clock()};lastScreen=screen(scene)?scene:'title';return track('session_started',{screen:lastScreen});}
  function view(scene){if(!screen(scene))return false;lastScreen=scene;return track('screen_viewed',{screen:scene});}
  function endSession(reason){if(!session)return false;const duration=Math.max(0,Math.min(86400000,clock()-session.started));const ok=track('session_ended',{screen:lastScreen,duration_ms:duration,reason:reason||'pagehide'});session=null;flush();return ok;}
  function status(){return{configured:Boolean(config),consent,enabled:enabled(),queued:queue.length};}
  if(o.config)configure(o.config);
  return Object.freeze({configure,setConsent,track,flush,startSession,endSession,view,status,events:Object.freeze(Object.keys(schemas))});
});
