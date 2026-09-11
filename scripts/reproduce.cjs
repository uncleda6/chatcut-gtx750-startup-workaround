#!/usr/bin/env node
// Synthetic local reproduction; uses the user's installed Flux API, not vendor source.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const [installArg,outputArg,...flags]=process.argv.slice(2);
if (!installArg || !outputArg || flags.some(f=>f!=='--ignore-gpu-blocklist')) {
  console.error('Usage: node scripts/reproduce.cjs INSTALL_DIR NEW_OUTPUT_DIR [--ignore-gpu-blocklist]');
  process.exit(1);
}
const install=path.resolve(installArg),output=path.resolve(outputArg);
if(fs.existsSync(output)) throw new Error('Use a new output directory; existing data will not be overwritten');
const runtime=path.join(install,'resources','flux-runtime');
if(!fs.existsSync(path.join(runtime,'native-host.js'))) throw new Error('Native host not found');
fs.mkdirSync(output,{recursive:true});
const timeline={id:'synthetic',revision:1,compositionWidth:1920,compositionHeight:1080,duration:2000000,
  tracks:[{id:'v1',kind:'video',order:0}],audioEffectItems:[],audioItems:[],captionsItems:[],pixelEffectItems:[],gifItems:[],imageItems:[],motionGraphicItems:[],solidItems:[],svgItems:[],textItems:[],timelineItems:[],transitionItems:[],videoItems:[]};
const base={id:'red',start:0,duration:1000000,fadeInDuration:0,fadeOutDuration:0,height:1080,width:1920,left:0,top:0,opacity:1,rotation:0,trackId:'v1',borderRadius:0};
timeline.solidItems=[{...base,color:'#E53935'},{...base,id:'blue',start:1000000,color:'#1565C0'}];
const model={projectId:'synthetic-colors',activeTimelineId:'synthetic',revision:1,frameRate:30,timelines:[timeline],audioEffectAssets:[],audioAssets:[],captionsAssets:[],pixelEffectAssets:[],fontAssets:[],gifAssets:[],imageAssets:[],motionGraphicAssets:[],svgAssets:[],transitionAssets:[],videoAssets:[]};
const host=spawn(path.join(runtime,'node.exe'),[path.join(runtime,'native-host.js'),'--name=community-reproduction',...flags],{windowsHide:true});
let nextId=0,buffer='',stderr='',pending=new Map(),responses=[];
function rejectPending(error){for(const p of pending.values())p.reject(error);pending.clear();}
host.on('error',rejectPending);
host.on('exit',()=>rejectPending(new Error('Native host exited before completing a request')));
host.stdout.on('data',data=>{
  buffer+=data;
  let index;
  while((index=buffer.indexOf('\n'))>=0){
    const line=buffer.slice(0,index);buffer=buffer.slice(index+1);
    try{const result=JSON.parse(line);fs.appendFileSync(path.join(output,'events.jsonl'),line+'\n');
      if(pending.has(result.id)){pending.get(result.id).resolve(result);pending.delete(result.id);}
    }catch{stderr+=line+'\n';}
  }
});
host.stderr.on('data',data=>stderr+=data);
host.stdin.on('error',rejectPending);
const timer=setTimeout(()=>{rejectPending(new Error('55-second diagnostic timeout'));host.kill();},55000);
function request(operation,args=[]){return new Promise((resolve,reject)=>{
  const id=++nextId;pending.set(id,{resolve,reject});host.stdin.write(JSON.stringify({id,operation,args})+'\n');
}).then(result=>{responses.push({operation,result});console.log(operation,JSON.stringify(result));return result;});}
function ensureOk(response){if(!response.ok || response.value?.ok===false)throw new Error('Native operation failed; inspect diagnostic responses');}
const exportOptions=file=>({outputFile:path.join(output,file),format:'mp4_h264',writeAudioTrack:false,width:1920,height:1080,frameRate:30,videoBitrate:6000000});
(async()=>{try{
  const probe=await request('environment.probe-graphics-support');
  if(!probe.value?.supported){console.log('Graphics probe is unsupported; no render attempted.');return;}
  ensureOk(await request('logging.set-enabled',[true]));
  ensureOk(await request('capture.frames',[model,{frames:[0,45],outputDir:output,filePrefix:'colors'}]));
  ensureOk(await request('export.video',[model,exportOptions('source.mp4')]));
  const source=path.join(output,'source.mp4');
  model.projectId='synthetic-video';model.activeTimelineId='video';model.revision=2;
  model.videoAssets=[{id:'source',fileName:'source.mp4',kind:'video',path:source,exists:true,contentSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),videoStreamId:'0'}];
  timeline.id='video';timeline.revision=2;timeline.solidItems=[];
  timeline.videoItems=[{...base,id:'video-item',duration:2000000,assetId:'source',cropBottom:0,cropTop:0,cropLeft:0,cropRight:0,keepAspectRatio:true,playbackRate:1,sourceIn:0}];
  timeline.tracks.push({id:'v2',kind:'video',order:-1});
  timeline.textItems=[{...base,id:'text',duration:2000000,trackId:'v2',left:120,top:400,width:1680,height:160,align:'center',background:null,color:'#FFFFFF',direction:'ltr',fontFamily:'Microsoft YaHei',fontSize:70,fontStyle:{variant:'normal',weight:'normal'},letterSpacing:0,lineHeight:1.2,resizeOnEdit:false,strokeColor:'#000000',strokeWidth:0,text:'ChatCut 视频与中文字幕测试'}];
  ensureOk(await request('capture.frames',[model,{frames:[0,45],outputDir:output,filePrefix:'video-text'}]));
  ensureOk(await request('export.video',[model,exportOptions('video-text.mp4')]));
  console.log('API calls completed. VISUAL CORRECTNESS IS NOT AUTOMATICALLY VERIFIED. Check PNGs, MP4 and decoder warnings.');
}catch(error){console.error(error.message);process.exitCode=1;}
finally{clearTimeout(timer);fs.writeFileSync(path.join(output,'stderr.log'),stderr);fs.writeFileSync(path.join(output,'responses.json'),JSON.stringify(responses,null,2));host.kill();}})();
