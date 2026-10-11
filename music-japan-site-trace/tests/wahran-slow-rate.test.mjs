import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={module:{exports:{}}};
vm.runInNewContext(readFileSync(new URL('../next/public/wahran/hosted-audio.js',import.meta.url),'utf8'),context);
class ResettingAudio {
 constructor(){this.defaultPlaybackRate=1;this.playbackRate=1;this.paused=true;this.observed=[]}
 set src(value){this._src=value;this.playbackRate=this.defaultPlaybackRate}
 get src(){return this._src}
 setAttribute(){}
 pause(){this.paused=true}
 play(){this.paused=false;this.observed.push(this.playbackRate);const ended=this.onended;setTimeout(()=>{if(!this.paused)ended?.()},1);return Promise.resolve()}
}
test('slow playback survives every new audio resource and returns to normal on demand',async()=>{
 const player=new context.module.exports.Player({Audio:ResettingAudio,setTimeout,clearTimeout});
 const paths=['audio/000000000000000000000001.mp3','audio/000000000000000000000002.mp3','audio/000000000000000000000003.mp3'];
 assert.equal(await player.play(paths,.75),true);
 assert.deepEqual(player.audio.observed,[.75,.75,.75]);
 assert.equal(player.audio.defaultPlaybackRate,.75);
 assert.equal(await player.play([paths[0]],1),true);
 assert.equal(player.audio.playbackRate,1);
});
