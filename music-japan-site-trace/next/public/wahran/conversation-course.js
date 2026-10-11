/* Explicit pedagogical annotations. No automatic Arabic or audio rewriting. */
(function(root,factory){const j=typeof module==='object'&&module.exports?require('./japanese-data.js'):root.WahranJapanese;const api=factory(j);if(typeof module==='object'&&module.exports)module.exports=api;else root.WahranConversation=api;})(globalThis,function(J){
'use strict';
const SPEAKER_M='l01-05 l06-01 l06-03 l06-05 l06-06 l15-01 l15-08 l17-04'.split(' ');
const SPEAKER_F='l01-06 l06-02 l06-04 l15-02'.split(' ');
const LISTENER_M='l01-03 l02-04 l03-01 l03-03 l03-05 l04-01 l05-08 l07-06 l07-08 l08-07 l11-01 l11-04 l11-05 l11-08 l12-06 l15-07 l15-08 l17-06 l17-07 l18-06'.split(' ');
const LISTENER_F='l01-04 l02-05 l03-02 l03-04 l04-02 l08-08 l11-06 l20-08'.split(' ');
const topicNotes={essentials:'短い会話の土台になる語　単語の英訳だけでなく、例文があれば一緒に練習する',links:'疑問・接続・位置関係に使う語　後ろに何を続けるかはチャンクと一緒に確認する',time:'予定や過去の出来事で使う語　何日の何時か必要に応じて具体的に伝える',numbers:'数字は値段や数量と組み合わせて練習する　金額なら単位も聞く',people:'人や家族を指す語　男友達・女友達は話題の人物で、聞き手の性別とは別',feelings:'気持ちや状態に使う語　形容詞で自分を説明するときは、自分に合った文法形を選ぶ',actions:'この教材では「私」の動詞として収録　別の人や過去の動作に、同じ形をそのまま使うとは限らない',actions2:'動作を「私」の形で練習する　発音を聞き、したいことのチャンクにもつなげる',food:'食品を指す語　注文のチャンクに入れて練習する　材料の確認が必要なら作り手に聞く',meals:'飲み物・食事・食卓で使う語　店や家庭で何を指すか、場面も一緒に覚える',places:'場所を指す語　行き先の「〜へ」と居場所の「〜で」を分けて練習する',transport:'移動と道案内に使う語　目的地や方向を、短い文で確認する',shopping:'買い物で使う語　値段・数量・支払い方法をそれぞれ確認できるようにする',home:'身の回りの物を指す語　「どこ？」「持っている？」の短い文につなげる',health:'体や困りごとを伝える語　医療判断ではなく、症状や必要な助けを伝えるために使う',nature:'天気や景色の話に使う語　見えているものから短い会話を始める',work:'仕事や学習で使う語　自己紹介や質問の文と一緒に練習する',conversation:'会話や好みを話す語　気に入ったものを具体的に伝える文へつなげる',qualities:'物や人を説明する形容詞　性は説明する名詞に合わせるので、聞き手だけで決まるわけではない',oran:'Oranでの会話や文化に関連する語　固有名詞や料理名は一まとまりで覚える'};
const wordSpecial={
 w001:'「私」　話し手が男性でも女性でも ana を使う　自己紹介 ana mən…（私は〜出身）にも出る',
 w002:'男性1人への「あなた」　話し手ではなく、相手が男性のときの形',
 w003:'女性1人への「あなた」　話し手ではなく、相手が女性のときの形',
 w004:'「彼」　話題にしている第三者が男性　男性相手にしか使えない語ではない',
 w005:'「彼女」　話題にしている第三者が女性　女性相手にしか使えない語ではない',
 w009:'男性名詞のもの・人を指す「これ」　文法上の性は話し相手の性別とは別',
 w010:'女性名詞のもの・人を指す「これ」　男性が使ってもよい　指しているものに合わせる',
 w037:'「なぜなら」　意見に理由を足すときに使う　例文ではオランが好きな理由を話す',
 w042:'「〜なしで」　blā səkkər（砂糖なし）のように、不要なものの前に置く',
 w169:'nḥəbb は文脈で「好き・愛する・欲しい」　単語だけで恋愛の告白だと決めつけない',
 w170:'nəbghi は西部の欲求・好意の表現として収録　「欲しい」「好き」の意味は文全体で判断する',
 w226:'飲み物の「水」　同じように見える ma が否定の文にも出るが、それは水の意味ではない',
 w227:'飲み物なら「コーヒー」、場所なら「カフェ」　quddām əl-qahwa なら「カフェの前」',
 w240:'場面により「朝食」や「断食明けの食事」　時間帯と話題も確かめる',
 w479:'「アルジェリア」または首都「アルジェ」を指すことがある　文脈だけで不明なら聞き直す',
 w496:'人を迎える「ようこそ」　mərḥba bīk を歓迎の一言として練習する',
 w497:'感謝や健康を願う言葉　食事や相手の手間へのお礼など、文脈と一緒に覚える',
 w499:'rāni は「私は〜」「私はここにいる」のように現在の状態を伝える　この語自体は男女共通',
 w500:'ghādi はこれからの予定を表す西部の用法として収録　ghādi＋動詞を一つの型にする'
};
function validProfile(p){return !!p&&!Array.isArray(p)&&typeof p==='object'&&['m','f'].includes(p.speaker)&&['m','f'].includes(p.listener)}
function roles(x){return {speaker:x?.speaker||'any',listener:x?.listener||'any'}}
function visible(x,p){if(!x)return false;if(!validProfile(p))return false;const r=roles(x);return(r.speaker==='any'||r.speaker===p.speaker)&&(r.listener==='any'||r.listener===p.listener)}
function wordNote(w,ja){if(wordSpecial[w.id])return wordSpecial[w.id];let text=`「${ja}」を表す語　${topicNotes[w.topic]||''}`;if(w.pos==='noun.f'||w.pos==='noun.m')text+='　名詞の男性・女性は文法上の区別で、話す人や相手の性別ではない';return text}
function checkPersonal(x){if(!x.ja||!x.usageJa||!x.ipa||!['m','f','any'].includes(x.speaker)||!['m','f','any'].includes(x.listener))throw new Error('Incomplete personal course annotation: '+x.id)}
function enrich(data){
 data.words.forEach((w,i)=>{if(w.personal){checkPersonal(w);return}w.ja=J.words[i];w.usageJa=wordNote(w,w.ja);w.speaker='any';w.listener='any';if(w.id==='w002')w.listener='m';if(w.id==='w003')w.listener='f';if(w.topic==='feelings'&&w.pos==='adj.m')w.speaker='m'});
 data.lessons.forEach((l,i)=>{if(l.track==='personal'){if(!l.noteJa)throw new Error('Missing personal lesson guide');l.lines.forEach(checkPersonal);return}l.noteJa=J.lessonNotes[i];l.lines.forEach(x=>{const v=J.lines[x.id];if(!v)throw new Error('Missing Japanese lesson: '+x.id);[x.ja,x.usageJa]=v;x.speaker=SPEAKER_M.includes(x.id)?'m':SPEAKER_F.includes(x.id)?'f':'any';x.listener=LISTENER_M.includes(x.id)?'m':LISTENER_F.includes(x.id)?'f':'any'})});
 data.families.forEach((f,i)=>{f.noteJa=J.familyNotes[i];f.frames.forEach((x,n)=>{x.ja=J.frames[i][n];x.speaker='any';x.listener=i===0&&n===7?'m':i===0&&n===8?'f':'any'});f.items.forEach((x,n)=>x.ja=J.items[i][n]);f.contexts.forEach((x,n)=>x.ja=J.contexts[i][n])});
 data.culture.forEach((x,i)=>{[x.textJa,x.practiceJa]=J.culture[i]});data.sounds.forEach((x,i)=>x.textJa=J.sounds[i]);data.scenes.forEach((x,i)=>{x.situationJa=J.scenes[i];x.promptsJa=J.scenePrompts[i]});
 data.meta.version='1.3.0';data.meta.profileScope='Explicit speaker/listener labels; existing source sentences and audio preserved. Not automatic gender rewriting.';
 return data;
}
function extend(E){
 const baseCombo=E.combo,baseEntry=E.entry,baseEmpty=E.emptyState,baseRestore=E.restore;
 E.combo=function(n){const x=baseCombo(n),f=E.data.families[x.family],fr=f.frames[x.frame];x.ja=fr.ja.replace('{x}',f.items[x.item].ja).replace('{c}',f.contexts[x.context].ja).replace('{wish}',J.actionWish[x.item]).replace('{try}',J.actionTry[x.item]);x.usageJa=f.noteJa;x.speaker=fr.speaker;x.listener=fr.listener;return x};
 E.entry=id=>typeof id==='string'&&/^c\d{5}$/.test(id)&&+id.slice(1)<10000?E.combo(+id.slice(1)):baseEntry(id);
 E.emptyState=()=>({...baseEmpty(),profile:null});
 E.restore=function(text){const s=baseRestore(text),raw=JSON.parse(text);if(raw.profile!=null&&!validProfile(raw.profile))throw new Error('Invalid conversation profile');s.profile=raw.profile?{speaker:raw.profile.speaker,listener:raw.profile.listener}:null;return s};
 E.due=function(state,now=Date.now()){return Object.entries(state.reviews).filter(([id,r])=>r.due<=now&&E.entry(id)).sort((a,b)=>a[1].due-b[1].due).map(([id])=>E.entry(id))};
 return E;
}
function select(list,p){return list.filter(x=>visible(x,p))}
function alternative(data,id,p){const all=[...data.words,...data.lessons.flatMap(x=>x.lines)],x=all.find(x=>x.id===id);if(visible(x,p))return x;return x?all.find(y=>y.en===x.en&&visible(y,p))||null:null}
function scenes(data,p){return data.scenes.map(s=>({...s,prompts:s.prompts.map(([prompt,id],i)=>{const x=alternative(data,id,p);return x?[prompt.replace(/a man|a woman/g,'the other person').replace(/\bhim\b|\bher\b/g,'them'),x.id,s.promptsJa[i]]:null}).filter(Boolean)}))}
function profileLabel(p){return validProfile(p)?`${p.speaker==='m'?'Man':'Woman'} → ${p.listener==='m'?'Man':'Woman'}`:'Choose your conversation'}
return {enrich,extend,visible,select,roles,validProfile,alternative,scenes,profileLabel};
});
