import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from 'lenis';

// Same libraries and easing as baton/src/lib/motion.ts, with cleanup and reduced-motion support.
export function createMotion({hero, repeat, report, introDelay = 0}) {
  gsap.registerPlugin(ScrollTrigger, CustomEase);
  CustomEase.create('mj-wave','0.16,1,0.3,1');
  const cleanups=[], timelines=[], triggers=[];
  let advanceIntro=null, introClockResume=()=>{};
  let disposed=false;
  const lenis=new Lenis({duration:1.1,lerp:0,
    easing:t=>Math.min(1,1.001-Math.pow(2,-10*t)),smoothWheel:true,syncTouch:false,
    autoRaf:false,anchors:true,prevent:node=>Boolean(node.closest('textarea,select,[data-lenis-prevent],.site-nav.is-open'))});
  // Native touch inertia is preserved on iOS (syncTouch deliberately false).
  lenis.on('scroll',ScrollTrigger.update);
  const tick=time=>{lenis.raf(time*1000);advanceIntro?.();};
  const wake=()=>{if(!document.hidden&&!disposed)gsap.ticker.add(tick);};
  const sleep=()=>{gsap.ticker.remove(tick);};
  const visibility=()=>{if(document.hidden){sleep();timelines.forEach(t=>t.pause());}
    else {introClockResume();wake();timelines.filter(t=>t.progress()<1).forEach(t=>t.resume());ScrollTrigger.refresh();}};
  wake();gsap.ticker.lagSmoothing(0);
  document.addEventListener('visibilitychange',visibility);
  cleanups.push(()=>{sleep();lenis.destroy();document.removeEventListener('visibilitychange',visibility);});

  if(hero && scrollY<100) {
    const h1=hero.querySelector('h1');
    const chars=[];
    if(h1){
      const label=h1.textContent.replace(/FROM(?=JAPAN)/,'FROM ');
      h1.setAttribute('aria-label',label);
      for(const line of h1.children){
        const original=line.textContent;
        const fragment=document.createDocumentFragment();
        for(const letter of original){const span=document.createElement('span');span.className='mj-char';
          span.textContent=letter;span.setAttribute('aria-hidden','true');fragment.append(span);chars.push(span);}
        line.replaceChildren(fragment);
        cleanups.push(()=>{line.textContent=original;});
      }
      cleanups.push(()=>h1.removeAttribute('aria-label'));
    }
    const orbit=hero.querySelector('.hero__orbit');
    const trace=hero.querySelector('.mj-intro-line');
    const lead=hero.querySelector('.hero__lead'),sub=hero.querySelector('.hero__sub');
    const ctas=[...hero.querySelectorAll('.hero__actions .button')];
    let introElapsed=0, introPrevious=performance.now();
    const tl=gsap.timeline({paused:true,onComplete:()=>{
      advanceIntro=null;
      hero.dataset.mjIntro='complete';gsap.set(orbit,{clearProps:'transform,opacity'});
      report({intro:'complete',introElapsedMs:Math.round(introElapsed)});
    }});
    hero.dataset.mjIntro=repeat?'short':'full';
    report({intro:repeat?'short / 0.6s':'full / 2.0s',introVariant:repeat?'repeat':'first',introPlannedMs:repeat?600:2000});
    // Hero HTML is present before this independent enhancement and never waits for WebGL.
    if(repeat){
      tl.fromTo(chars,{y:18,opacity:0},{y:0,opacity:1,stagger:.008,duration:.3,ease:'mj-wave'},0)
        .fromTo([lead,sub,...ctas].filter(Boolean),{y:12,opacity:0},{y:0,opacity:1,stagger:.025,duration:.35,ease:'mj-wave'},.175)
        .fromTo(orbit,{scale:.97},{scale:1,duration:.6,ease:'mj-wave'},0);
    }else{
      tl.fromTo(trace,{scaleX:0,opacity:0},{scaleX:1,opacity:1,duration:.5,ease:'mj-wave'},0)
        .to(trace,{opacity:0,duration:.55},.6)
        .fromTo(orbit,{scale:.78,rotation:4,opacity:.25},{scale:1,rotation:-22,opacity:1,duration:1.6,ease:'mj-wave'},.1)
        .fromTo(chars,{y:40,opacity:0},{y:0,opacity:1,stagger:.035,duration:.7,ease:'mj-wave'},.25)
        .fromTo([lead,sub,...ctas].filter(Boolean),{y:18,opacity:0},{y:0,opacity:1,stagger:.09,duration:.65,ease:'mj-wave'},1.08);
      // End at exactly two seconds, without blocking interaction or adding a loader.
      tl.to({}, {duration:.0},2);
    }
    // Use visible wall time so shared GSAP clock adjustments cannot stretch the intro.
    // Hidden time is excluded; the existing ticker stops until the tab is visible.
    introClockResume=()=>{introPrevious=performance.now();};
    advanceIntro=()=>{
      const now=performance.now();introElapsed+=now-introPrevious;introPrevious=now;
      const played=Math.max(introElapsed/1000-introDelay,0);
      tl.totalTime(Math.min(played,repeat?.6:2));
      if(played>=(repeat?.6:2))tl.progress(1);
    };
    cleanups.push(()=>{advanceIntro=null;tl.kill();});
    cleanups.push(()=>gsap.set([orbit,trace,lead,sub,...ctas].filter(Boolean),{clearProps:'transform,opacity'}));
  }

  // Headings get the hero's per-character wave. Long strings stay whole: hundreds
  // of spans cost more than the effect is worth and bloat the accessibility tree.
  const splitChars=el=>{
    const label=el.textContent.trim();
    if(!label||label.length>42||el.querySelector('.mj-char'))return null;
    el.setAttribute('aria-label',label);
    const fragment=document.createDocumentFragment();
    const spans=[];
    for(const letter of el.textContent){
      const span=document.createElement('span');span.className='mj-char';
      span.textContent=letter;span.setAttribute('aria-hidden','true');
      fragment.append(span);spans.push(span);
    }
    const original=el.textContent;
    el.replaceChildren(fragment);
    cleanups.push(()=>{el.textContent=original;el.removeAttribute('aria-label');});
    return spans;
  };

  // Inner pages have no .hero, so before this they opened with no entrance at all.
  const innerHero=!hero&&document.querySelector('.inner-page__hero,.profile-hero');
  if(innerHero){
    const title=innerHero.querySelector('h1');
    const chars=title?splitChars(title):null;
    const rest=[...innerHero.children].filter(el=>el!==title);
    const tl=gsap.timeline();
    if(chars)tl.fromTo(chars,{y:26,opacity:0},{y:0,opacity:1,stagger:.022,duration:.5,ease:'mj-wave',clearProps:'transform,opacity'},0);
    if(rest.length)tl.fromTo(rest,{y:20,opacity:0},{y:0,opacity:1,stagger:.07,duration:.55,ease:'mj-wave',clearProps:'transform,opacity'},chars?.18:0);
    timelines.push(tl);
    innerHero.dataset.mjIntro='inner';
    report({intro:'inner / 0.8s'});
  }

  const groups=new Map();
  const candidates=[...document.querySelectorAll('[data-reveal]')].filter(el=>!el.closest('.hero'));
  // A single controller owns each subtree; nested reveals must not double-fade text.
  const items=candidates.filter(el=>!el.parentElement?.closest('[data-reveal]'));
  items.forEach(el=>{
    const key=el.closest('[data-reveal-group]')||el.closest('section')||el;
    const list=groups.get(key)||[];list.push(el);groups.set(key,list);
  });
  groups.forEach((list,key)=>{
    const pending=list.filter(el=>el.getBoundingClientRect().top>innerHeight*.82);
    if(!pending.length)return;
    gsap.set(pending,{y:32,opacity:0});
    const headings=pending.flatMap(el=>{
      const h=el.matches('.section-heading')?el.querySelector('h2'):null;
      const spans=h?splitChars(h):null;
      return spans?[{spans}]:[];
    });
    headings.forEach(({spans})=>gsap.set(spans,{y:24,opacity:0}));
    const reveal=()=>{
      const tl=gsap.to(pending,{y:0,opacity:1,duration:.8,stagger:.11,ease:'mj-wave',clearProps:'transform,opacity'});
      timelines.push(tl);
      headings.forEach(({spans})=>timelines.push(
        gsap.to(spans,{y:0,opacity:1,duration:.55,stagger:.02,ease:'mj-wave',clearProps:'transform,opacity'})));
    };
    triggers.push(ScrollTrigger.create({trigger:pending[0],start:'top 85%',once:true,onEnter:reveal}));
    const focus=()=>{const spans=headings.flatMap(h=>h.spans);
      gsap.killTweensOf([...pending,...spans]);gsap.set([...pending,...spans],{clearProps:'transform,opacity'});};
    key.addEventListener('focusin',focus);
    cleanups.push(()=>key.removeEventListener('focusin',focus));
  });
  // Parallax and velocity drive CSS variables rather than transforms: the record
  // already owns `transform` for its rotation, and `translate` composes with it.
  const docEl=document.documentElement;
  if(hero){
    triggers.push(ScrollTrigger.create({trigger:hero,start:'top top',end:'bottom top',scrub:.6,
      onUpdate:self=>{const p=self.progress;
        hero.style.setProperty('--mj-orbit-y',(p*96).toFixed(1)+'px');
        hero.style.setProperty('--mj-halo-y',(p*-44).toFixed(1)+'px');
        hero.style.setProperty('--mj-field-y',(p*52).toFixed(1)+'px');}}));
    cleanups.push(()=>hero.style.removeProperty('--mj-orbit-y'));
    cleanups.push(()=>{hero.style.removeProperty('--mj-halo-y');hero.style.removeProperty('--mj-field-y');});
  }
  const onVelocity=({velocity})=>{
    const v=Math.max(-1,Math.min(1,velocity/26));
    docEl.style.setProperty('--mj-vel',v.toFixed(3));
    docEl.style.setProperty('--mj-vel-abs',Math.abs(v).toFixed(3));
  };
  lenis.on('scroll',onVelocity);
  cleanups.push(()=>{docEl.style.removeProperty('--mj-vel');docEl.style.removeProperty('--mj-vel-abs');});

  const refresh=()=>{if(!disposed)ScrollTrigger.refresh();};
  document.fonts?.ready.then(refresh);
  addEventListener('load',refresh,{once:true});
  report({scroll:'Lenis 1.1s / GSAP + ScrollTrigger'});
  return {dispose(){
    disposed=true;timelines.forEach(t=>t.kill());triggers.forEach(t=>t.kill());
    gsap.set(items,{clearProps:'transform,opacity'});cleanups.reverse().forEach(fn=>fn());
    removeEventListener('load',refresh);
  }};
}
