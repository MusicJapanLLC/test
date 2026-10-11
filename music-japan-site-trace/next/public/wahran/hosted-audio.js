/* Self-hosted synthetic Algerian Arabic. No runtime speech API or device voice required. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return}
  root.WahranHosted=api;
  try{api.install(root,JSON.parse(root.document.getElementById('course-data').textContent),root.WahranFiles)}
  catch(error){
    root.WahranAudioBootError=error.message;
    if(root.WahranAudio?.Speech){const Base=root.WahranAudio.Speech;root.WahranAudio.Speech=class extends Base{play(){return Promise.reject(new Error('The included audio pack could not load. Reload this page with an internet connection.'))}}}
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
  const validPath=p=>typeof p==='string'&&/^audio\/[a-f0-9]{24}\.mp3$/.test(p);
  function checkPath(p){if(!validPath(p))throw new Error('Invalid or missing local audio path');return p}
  function createResolver(course,manifest){
    if(!course||!manifest||manifest.version!==2||!manifest.entries||manifest.families?.length!==course.families.length)throw new Error('Incomplete included audio pack');
    const map=new Map();
    for(const x of [...course.words,...course.lessons.flatMap(l=>l.lines)])map.set(x.ar.trim(),[checkPath(manifest.entries[x.id])]);
    course.families.forEach((f,fi)=>{
      const a=manifest.families[fi];
      if(a.frames?.length!==f.frames.length||a.items?.length!==f.items.length||a.contexts?.length!==f.contexts.length)throw new Error('Incomplete chunk audio pack');
      a.frames.forEach(checkPath);a.items.forEach(checkPath);a.contexts.forEach(checkPath);
      f.frames.forEach((fr,ti)=>f.items.forEach((x,xi)=>f.contexts.forEach((c,ci)=>{
        const text=fr.ar.replace('{x}',x.ar).replace('{c}',c.ar).trim();
        if(!map.has(text))map.set(text,[a.frames[ti],a.items[xi],a.contexts[ci]]);
      })));
    });
    return text=>map.get(String(text).trim())?.slice()||null;
  }
  class Player{
    constructor(env=globalThis){
      this.env=env;this.audio=new env.Audio();this.audio.preload='auto';this.audio.id='wahran-hosted-audio';this.audio.hidden=true;
      this.audio.setAttribute?.('playsinline','');this.audio.setAttribute?.('aria-hidden','true');
      env.document?.body?.append?.(this.audio);
      this.token=0;this.settle=null;this.timer=null;
    }
    detach(){this.env.clearTimeout(this.timer);this.timer=null;this.audio.onended=null;this.audio.onerror=null;this.audio.onplaying=null}
    stop(){this.token++;this.detach();this.audio.pause();if(this.settle){const settle=this.settle;this.settle=null;settle(false)}}
    play(paths,rate=1,onPlaying=()=>{}){
      this.stop();
      if(!Array.isArray(paths)||!paths.length||paths.some(p=>!validPath(p)))return Promise.reject(new Error('This item has no included audio file. Reload the page.'));
      const queue=paths.slice(),token=this.token,a=this.audio;let index=0;
      const speed=Number.isFinite(rate)?Math.max(.55,Math.min(1.4,rate)):1;
      a.defaultPlaybackRate=speed;a.playbackRate=speed;a.preservesPitch=true;
      return new Promise((resolve,reject)=>{
        this.settle=resolve;
        const finish=(ok,error)=>{if(token!==this.token)return;this.detach();this.settle=null;if(error)a.pause();error?reject(new Error(error)):resolve(ok)};
        const next=()=>{
          if(token!==this.token)return;
          this.detach();
          if(index>=queue.length){finish(true);return}
          a.src=queue[index++];a.playbackRate=speed;
          a.onplaying=()=>{if(token===this.token)onPlaying(index,queue.length)};
          a.onerror=()=>finish(false,'The included audio file could not be loaded. Check your connection and tap Listen again.');
          a.onended=next;
          this.timer=this.env.setTimeout(()=>finish(false,'The audio file did not finish. Check your connection and tap Listen again.'),45000);
          try{const started=a.play();started?.catch(()=>finish(false,'Audio playback was blocked. Open this page in Safari or Chrome and tap Listen again.'))}
          catch(error){finish(false,'Audio playback was blocked. Open this page in Safari or Chrome and tap Listen again.')}
        };
        next();
      });
    }
  }
  function install(env,course,manifest){
    const resolve=createResolver(course,manifest),Base=env.WahranAudio.Speech;
    env.WahranAudio.Speech=class HostedSpeech extends Base{
      constructor(e=env){super(e);this.player=new Player(e);this.hostedToken=0}
      stop(){this.hostedToken++;super.stop();this.player?.stop()}
      play(text,{rate=.85}={}){
        this.stop();const token=this.hostedToken,playlist=resolve(text);
        if(!playlist)return Promise.reject(new Error('This item has no included audio file. Reload the page.'));
        this.active=true;
        return this.player.play(playlist,rate/.85,()=>this.onStatus('playing',{lang:'ar-DZ',hosted:true,name:manifest.voice,chunks:playlist.length})).then(ok=>{
          if(token===this.hostedToken){this.active=false;this.onStatus('idle')}return ok;
        },error=>{if(token===this.hostedToken){this.active=false;this.onStatus('error')}throw error});
      }
    };
    return env.WahranAudio.Speech;
  }
  return{createResolver,Player,install};
});
