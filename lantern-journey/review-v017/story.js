/* Original short coastal story. Dialogue state is saved with the journey. */
(()=>{'use strict';
const intro=[
 {who:'潮鐘の里',text:'鐘が止まって、七日\n海霧が道を隠し、宿守りのユナが帰らなくなった'},
 {who:'ミナ',text:'ユナさんの足跡を追うなら、私も行く\nアレン、ひとりで先に行かないでよ'},
 {who:'ふたり、灯を持って',text:'アレンの灯剣と、ミナの風読みの矢\n戦うほど必殺技の灯が満ちる\nガランがくれた回復薬は、傷が深くなると自動で使う\nまずは二人で、帰り道をつなごう'}
];
const dialogues={
 firstTrail:[{who:'ミナ',text:'この角獣、いつもなら里まで来ないのに\n鐘が止まってから、森の様子がおかしい'}, {who:'アレン',text:'落ちていた灯晶、ガランに見せよう\n装備の強化に使えるかもしれない'}],
 rescueYuna:[{who:'ユナ',text:'二人とも、迎えに来てくれたんだね\n見習いのリオが、灯で霧を押し返してくれたの'}, {who:'ミナ',text:'その子は、どこへ？'}, {who:'ユナ',text:'炉の灯が消える前に旧道へ行く、と\n鐘を直すために必要だって。あの子も迎えに行こう'}],
 joinMina:[{who:'ミナ',text:'ちょっと、ひとりで飛び出さないでよ\n足跡を追うなら、私の出番でしょ'}, {who:'アレン',text:'来てくれたのか、ミナ\n……助かった。ここからは、一緒に行こう'}, {who:'風の弓手・ミナが加入',text:'ミナの矢は守り手の隙を作る\n個別の必殺技が満ちたら、星彩乱射を放てる\n次は、二人で林道を進もう'}],
 trail:[{who:'ミナ',text:'この足跡、ユナさんだけじゃない\n杖をついた誰かが、一緒に歩いてる'}, {who:'アレン',text:'祠の方に灯が見える\n待っていてくれ。必ず連れ戻す'}],
 joinRio:[{who:'リオ',text:'間に合った……！\n炉の灯を守っていたけれど、私の灯だけでは道を開けなくて'}, {who:'ユナ',text:'二人とも、その子も連れ戻してくれたんだね\nありがとう。みんなで里へ帰ろう'}, {who:'リオ',text:'私はリオ、鐘守りの見習いです\n鐘を鳴らす旅、私も加えてくれますか'}, {who:'星の癒し手・リオが加入',text:'リオの灯火が印を刻み、アレンの剣につながる\n三つの灯が共鳴すると、連携奥義「暁の三重奏」が使える\n炉が戻り、海の封印へ向かう準備が整った'}],
 chapterEnd:[{who:'アレン',text:'聞こえる……父が守っていた、あの鐘だ\n二人で出た道が、みんなの帰り道になった'}, {who:'ミナ',text:'ユナさんのパンが冷める前に帰ろう\n次の冒険は、そのあと！'}, {who:'ノア',text:'鐘が聞こえて、霧の向こうから帰れたんだ\n僕はノア、旅の吟遊詩人\nリオが鐘塔を調べる間、竪琴で君たちの旅を支えたい'}, {who:'第一章・灯の旅路 完',text:'仲間・装備・育成を組み替えて、自由な冒険へ\nこの短い章の旅は、ここで一区切り'}],

 returning:[{who:'旅のしおり',text:'潮鐘は、霧を遠ざけて船を里へ導く合図\n止まった鐘を鳴らすため、アレンたちは散った住人と灯石を探している'},...intro.slice(2,7),{who:'旅は続く',text:'これまでの装備・成長・里の復旧は、そのまま残っている\n次は、灯が戻る理由を確かめながら歩こう'}],
 forestReturn:[{who:'ユナ',text:'迎えに来てくれたんだね\n霧が深くて、帰り道が分からなくなってしまって'}, {who:'ミナ',text:'もう大丈夫\nアレンが道を開いて、リオが灯をつないだ\n私たちの足跡をたどれば、里へ帰れるよ'}, {who:'ユナ',text:'宿を直せたら、温かいパンを焼こう\nあの子たちも、匂いを覚えているはずだから'}],
 stoneReturn:[{who:'ガラン',text:'この護石なら、炉の火が戻る\nお前たちが道を開いたから、あいつも帰ってこられた'}, {who:'ノア',text:'旧道で、三つの灯が歌うのを聞いたんだ\n僕はノア、旅の吟遊詩人\nその響きの続きを、一緒に探してもいいかな'}, {who:'リオ',text:'あなたの竪琴は、傷ついた灯を整えられる\n鐘塔で私が記録を調べる間、旅を手伝ってくれますか'}, {who:'仲間が増えた',text:'吟遊詩人・ノアが加わった\n「仲間と装備」でリオと交代できる\nノアは癒しが強く、灯の攻撃は控えめ'}],
 tideReturn:[{who:'セト',text:'沖の灯が、ようやく見えた\nこれで霧の向こうへ、舟を出せる'}, {who:'アレン',text:'森の灯、炉の灯、海の灯\n鐘を鳴らすのに必要だったのは、帰る場所を守る人たちだったんだ'}, {who:'リオ',text:'さあ、潮鐘を仕上げましょう\n今度は、帰ってくる人が迷わないように'}],
 yuna:[{who:'ユナ',text:'パンが焼ける匂いで、里に朝が戻ったね\nミナは耳の端、リオは柔らかいところが好き\nアレンは、いつも二人の残りを食べていた'}, {who:'アレン',text:'……それは昔の話だよ\n帰ってから話す相手がいるだけで、道が短く感じるんだ'}],
 garan:[{who:'ガラン',text:'強い刃だけ集めても、旅は続かん\n傷を支える外套と、灯を蓄える石も見ろ\n拾った装備を強化し、要らんものは灯晶に分解しろ\n迷ったら「最強装備」で整えればいい'}, {who:'ミナ',text:'竪琴の修理もできる？\nノアの曲、帰り道に聴くとちょっと元気が出るんだ'}],
 seto:[{who:'セト',text:'あの霧は、船の音まで飲み込んじまう\n鐘が鳴れば、沖の連中も帰ってこられる\n桟橋と鐘塔、どっちも頼むよ'}, {who:'ミナ',text:'海の灯だけが、まだ返事をしないんだね\n舟が直ったら、みんなで確かめに行こう'}],
 party:[{who:'ミナ',text:'さっきの一撃、ちょっと急いだでしょ\n隙を作るまで待ってくれたら、もっと合わせられるのに'}, {who:'アレン',text:'分かってる\nただ、誰かが狙われると、先に体が動くんだ'}, {who:'リオ',text:'二人とも、ちゃんと私の灯を見ていて\n帰るのは、全員一緒ですから'}],
 noah:[{who:'ノア',text:'鐘の音って、誰が聴くかで違うんだ\n船には道しるべ、里には朝、君たちには帰る合図'}, {who:'ノア',text:'僕の竪琴は、その響きを少し整えるだけ\nリオほど強い灯は放てないけど、仲間の傷を癒すのは得意だよ'}]
};
function empty(){return{intro:0,started:false,support:'rio',recruited:false,seen:[],dialogue:null};}
function restore(v,progress,legacy=false){if(!v&&legacy){return{...empty(),intro:3,started:true,recruited:progress.clears.stone>0,dialogue:{id:'returning',index:0}};}if(!v)return empty();if(!Number.isInteger(v.intro)||v.intro<0||v.intro>9||typeof v.started!=='boolean'||typeof v.recruited!=='boolean'||!['rio','noah'].includes(v.support)||v.support==='noah'&&!v.recruited||!Array.isArray(v.seen)||v.seen.some(x=>!Object.hasOwn(dialogues,x)))return null;const d=v.dialogue;if(d&&(!Object.hasOwn(dialogues,d.id)||!Number.isInteger(d.index)||d.index<0||d.index>=dialogues[d.id].length&&!legacy))return null;return{intro:v.started?3:Math.min(v.intro,2),started:v.started,support:v.support,recruited:v.recruited,seen:[...new Set(v.seen)],dialogue:d?{id:d.id,index:Math.min(d.index,dialogues[d.id].length-1)}:null};}
function conversation(id,s){if(id==='party'&&s.campaign.roster===1)return[{who:'アレン',text:'まずは、ひとりで道を開こう\n戻ってくる人が、灯を見つけられるように'}];if(id==='party'&&s.campaign.roster===2)return dialogues.party.slice(0,2);if(id==='party'&&s.story.support==='noah')return dialogues.party.slice(0,2).concat({who:'ノア',text:'僕の竪琴も、二人の呼吸に合わせるよ\n帰るときの歌は、誰も欠けていない方がいい'});if(id==='yuna'&&s.progress.clears.forest&&!s.progress.projects.inn)return[{who:'ユナ',text:'迎えに来てくれて、ありがとう\n宿の修理が終わったら、またパンを焼こう\n三人が帰ってくる席は、私が用意するから'}];if(id==='yuna'&&!s.progress.clears.forest)return[{who:'宿の扉',text:'宿守りのユナは、薬草を探しに森へ向かったまま\nまずは風見の林道へ迎えに行こう'}];if(id==='garan'&&!s.progress.projects.smith)return[{who:'ガラン',text:'炉の火は弱いが、旅支度ぐらいならできる\n拾った装備は灯晶で強化、要らないものは分解だ\n旧道の護石が戻れば、この里も息を吹き返す'}];return dialogues[id];}
function camp(r,s){const support=s.story.support==='noah'?'ノア':'リオ';return r.route==='forest'?['ミナ「ユナさんの足跡、まだ新しいね」\nアレン「帰り道に迷わせないよう、灯を置こう」',`${support}「三つの灯が、だんだん同じ拍に」\nミナ「次は森の主。全員で帰ろう」`][Math.min(r.node,1)]:r.route==='stone'?['アレン「盾を崩す音が、炉の奥まで響いた」\nリオ「誰かの竪琴が、返事をしています」','ミナ「この護石なら、ガランさんが喜ぶね」\nアレン「その前に、道の主と向き合おう」'][Math.min(r.node,1)]:'セトの舟が、霧の向こうで揺れている\n三人は灯を囲み、帰る里の話をした';}
window.LanternStory=Object.freeze({intro,dialogues,empty,restore,conversation,camp});
})();
