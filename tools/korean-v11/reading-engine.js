/* Reading hints are approximate, not native-speaker verification. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WahranReading=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 function create(data){
  const all=data.pronunciation||{},contexts=[...(data.readingContexts||[])].sort((a,b)=>b.length-a.length);
  function forText(text){
   if(typeof text!=='string')return null;
   const exact=Object.hasOwn(all,text)?all[text]:null;
   if(exact)return{kana:exact[0],ipa:exact[1],scope:'line'};
   for(const context of contexts){
    if(!text.startsWith(context+' '))continue;
    const rest=text.slice(context.length+1).trim(),head=all[context],tail=all[rest];
    if(head&&tail)return{kana:head[0]+' '+tail[0],ipa:'['+head[1].slice(1,-1)+' '+tail[1].slice(1,-1)+']',scope:'chunks'};
   }
   return null;
  }
  return{forText};
 }
 return{create};
});
