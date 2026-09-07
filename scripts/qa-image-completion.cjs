// Isolated browser + real React hook. All backend/media calls mocked; no credits used.
const path = require('node:path');
const assert = require('node:assert/strict');
const {build} = require('C:/Work/eos-creative-studio-backend/node_modules/esbuild');
const {chromium} = require('C:/Users/Thatawat.T/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const mockApi=`
const start=(input,callback)=>new Promise(resolve=>{window.job={input,callback,resolve};});
export const createTextToImage=start,createImageToImage=start,createStyleTransfer=start,createBackgroundGeneration=start,createExtendImage=start,createUpscale=start;
export const resumeGeneration=(pending,callback)=>{window.resumed=true;return start(pending,callback);};
export const resumeTextToImage=resumeGeneration;
export const listGenerationHistory=async()=>window.historyFixtures??[];
export const cancelGeneration=async()=>({});
`;
const mocks={
 '@/lib/api/generations':mockApi,
 '@/lib/api/generation-models':`export const listGenerationModels=async()=>[{model:'qa-model',displayName:'QA',provider:'qa',isDefault:true,enabled:true,capabilities:{parameters:[],supportedSizes:[],supportedRatios:['16:9'],supportedResolutions:['720p'],qualityValues:[],backgroundModes:['remove','replace','generate','solid']}}];`,
 '@/lib/api/style-presets':`export const listStylePresets=async()=>[];`,
 '@/lib/api/storage':`export const uploadImageAsset=async()=>'/composited.png';export const uploadMaskAsset=async()=>'/mask.png';`,
 '@/lib/api/generation-errors':`export const formatGenerationError=(e)=>String(e);`,
 './use-image-credit-estimate':`export const useImageCreditEstimate=()=>({creditCost:1,loading:false,error:null});`,
 '@/features/templates/use-template-settings':`export const useTemplateSettings=()=>{};`,
};
async function main(){
 const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {useImageGenerationState} from './src/features/create/image-generation/hooks/use-image-generation-state';function App(){window.hook=useImageGenerationState();return React.createElement('output',null,window.hook.activeTab)}createRoot(document.getElementById('root')).render(React.createElement(App));`,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"test"'},plugins:[{name:'isolated-api',setup(b){b.onResolve({filter:/.*/},args=>{if(mocks[args.path])return {path:args.path,namespace:'mock'};if(args.path.startsWith('@/'))return {path:path.join(root,'src',args.path.slice(2))+'.ts'};});b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const cases=[['Text to Image','text-to-image','generateImage','generatedImageUrls','isGenerating'],['Image to Image','image-to-image','transformImage','imageToImageUrls','imageToImageIsGenerating'],['AI Style Transfer','style-transfer','generateStyleTransfer','styleTransferUrls','styleTransferIsGenerating'],['AI Background','background-removal','generateBackground','backgroundUrls','backgroundIsGenerating'],['Extend Image','extend-image','extendImage','extendUrls','extendIsGenerating'],['Upscale','upscale','generateUpscale','upscaleUrls','upscaleIsGenerating']];
 let passed=0;
 try {
  for(const [tab,feature,method,urlsKey,busyKey] of cases){
   for(const mode of ['fresh','resume','history']){
    const context=await browser.newContext();const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
    await page.goto('http://localhost:18765');
    if(mode==='history')await page.evaluate(({feature,tab})=>{
     window.historyFixtures=[{id:'qa-job',workspaceId:'qa',feature,kind:'image',provider:'qa',model:'qa-model',pollUrl:'/status',status:'processing',totalCount:1,completedCount:0,output:[],createdAt:new Date().toISOString()}];
     sessionStorage.setItem('eos.generation.image-draft.v1',JSON.stringify({activeTab:tab}));
    },{feature,tab});
    if(mode==='resume')await page.evaluate(({feature,tab})=>{
     const key=feature==='text-to-image'?'eos.generation.pending':'eos.generation.pending.'+feature;
     sessionStorage.setItem(key,JSON.stringify({generationId:'qa-job',workspaceId:'qa',provider:'qa',model:'qa-model',pollUrl:'/status',status:'processing',totalCount:1,completedCount:0,output:[]}));
     sessionStorage.setItem('eos.generation.image-draft.v1',JSON.stringify({activeTab:tab}));
    },{feature,tab});
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.waitForFunction(()=>window.hook&&!window.hook.isLoadingModels);
    // Style Transfer is supported internally but intentionally absent from the visible tab list.
    if(mode==='history' && tab==='AI Style Transfer') {
     await page.evaluate(tab=>window.hook.setActiveTab(tab),tab);
    }
    if(mode==='fresh'){
     await page.evaluate(tab=>window.hook.setActiveTab(tab),tab);
     await page.waitForFunction(tab=>window.hook.activeTab===tab,tab);
     await page.evaluate(()=>{const h=window.hook;h.setPrompt('QA');h.setImageToImagePrompt('QA');h.setStyleTransferPrompt('QA');h.setExtendPrompt('QA');h.setImageToImageSourceImage('/source.png');h.setStyleTransferSourceImage('/source.png');h.setBackgroundSourceImage('/source.png');h.setExtendSourceImage('/source.png');h.setUpscaleSourceImage('/source.png');});
     await page.waitForFunction(()=>window.hook.prompt==='QA');
     await page.evaluate(method=>{void window.hook[method]();},method);
    }
    await page.waitForFunction(()=>Boolean(window.job),null,{timeout:5000}).catch(async error=>{console.error('Scenario',tab,mode,errors,await page.evaluate(()=>({tab:window.hook.activeTab,prompt:window.hook.prompt,error:window.hook.generationError,imageError:window.hook.imageToImageError,backgroundError:window.hook.backgroundError,busy:window.hook.isGenerating,keys:Object.keys(window.hook).filter(k=>k.includes('enerate'))})));throw error;});
    await page.evaluate(()=>{window.hook.selectRecentGeneration('/old.png');});
    await page.evaluate(()=>{
     const output=[{url:'/new.png',type:'image',mimeType:'image/png'}];
     const progress={generationId:'qa-job',workspaceId:'qa',provider:'qa',model:'qa-model',pollUrl:'/status',status:'completed',totalCount:1,completedCount:1,output};
     window.job.callback(progress);window.job.resolve({data:progress});
     window.historyFixtures=[];
    });
    await page.waitForFunction(({urlsKey,busyKey})=>window.hook[urlsKey]?.includes('/new.png')&&!window.hook[busyKey],{urlsKey,busyKey},{timeout:5000});
    const state=await page.evaluate(()=>({selected:window.hook.selectedRecentImageUrl}));
    assert.equal(state.selected,null,tab+' must show new output, not old recent selection');
    assert.deepEqual(errors,[],tab+' browser errors');
    console.log('PASS',tab,mode);passed++;await context.close();
   }
  }
  console.log(passed+' completion/resume browser-hook scenarios passed (mock APIs, no paid generation).');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
