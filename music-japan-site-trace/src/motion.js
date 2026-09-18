import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from 'lenis';

// Same libraries and easing as baton/src/lib/motion.ts, with cleanup and reduced-motion support.
export function createMotion({hero, repeat, report}) {
  gsap.registerPlugin(ScrollTrigger, CustomEase);
  CustomEase.create('mj-wave','0.16,1,0.3,1');
  const cleanups=[], timelines=[], triggers=[];
  let disposed=false;
  const lenis=new Lenis({duration:1.1,lerp:0,
    easing:t=>Math.min(1,1.001-Math.pow(2,-10*t)),smoothWheel:true,syncTouch:false,
    autoRaf:false,anchors:true,prevent:node=>Boolean(node.closest('textarea,select,[data-lenis-prevent],.site-nav.is-open'))});
  // Native touch inertia is preserved on iOS (syncTouch deliberately false).
  lenis.on('scroll',ScrollTrigger.update);
  const tick=time=>lenis.raf(time*1000);
  const wake=()=>{if(!document.hidden&&!disposed)gsap.ticker.add(tick);};
  const sleep=()=>{gsap.ticker.remove(tick);};
  const visibility=()=>{if(document.hidden){sleep();timelines.forEach(t=>t.pause());}
    else {wake();timelines.filter(t=>t.progress()<1).forEach(t=>t.resume());ScrollTrigger.refresh();}};
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
    const tl=gsap.timeline({onComplete:()=>{hero.dataset.mjIntro='complete';report({intro:'complete'});}});
    hero.dataset.mjIntro=repeat?'short':'full';
    report({intro:repeat?'short / 0.6s':'full / 2.0s'});
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
    timelines.push(tl);
    cleanups.push(()=>gsap.set([orbit,trace,lead,sub,...ctas].filter(Boolean),{clearProps:'transform,opacity'}));
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
    const pending=list.filter(el=>el.getBoundingClientRect().top>innerHeight*.88);
    if(!pending.length)return;
    gsap.set(pending,{y:18,opacity:0});
    const reveal=()=>{
      const tl=gsap.to(pending,{y:0,opacity:1,duration:.65,stagger:.09,ease:'mj-wave',clearProps:'transform,opacity'});
      timelines.push(tl);
    };
    triggers.push(ScrollTrigger.create({trigger:pending[0],start:'top 88%',once:true,onEnter:reveal}));
    const focus=()=>{gsap.killTweensOf(pending);gsap.set(pending,{clearProps:'transform,opacity'});};
    key.addEventListener('focusin',focus);
    cleanups.push(()=>key.removeEventListener('focusin',focus));
  });
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
