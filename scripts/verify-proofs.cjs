const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const repo='fact-triad',root=path.resolve(__dirname,'..');
if(!['fact-triad','drift-fence'].includes(repo))throw Error('Unknown repository');
const config=JSON.parse(fs.readFileSync(path.join(root,'proof-config.json')));
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const load=name=>JSON.parse(fs.readFileSync(path.join(root,'proofs',name+'.json')));
const assert=(value,message)=>{if(!value)throw Error(message);};
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
async function rpc(method,params){
  for(let i=0;i<3;i++){
    try{const r=await fetch('https://studio.genlayer.com/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(30000)});const v=await r.json();if(!r.ok||v.error)throw Error(JSON.stringify(v.error||r.status));return v.result;}
    catch(error){if(i===2)throw error;await new Promise(r=>setTimeout(r,5000));}
  }
}
async function receipt(name,hash){
  const r=load(name+'-receipt');
  const live=await rpc('eth_getTransactionByHash',[hash]);
  assert((live.status_name||live.statusName||live.status)==='FINALIZED' && (live.result_name||live.result)==='MAJORITY_AGREE','Live receipt not successful '+name);
  assert((live.hash||live.tx_id)===hash && same(live.consensus_data.votes,r.consensus_data.votes),'Live receipt hash/votes mismatch '+name);
  assert(live.consensus_data?.leader_receipt?.[0]?.execution_result===r.consensus_data?.leader_receipt?.[0]?.execution_result,'Live execution mismatch '+name);
  assert(r.hash===hash && (r.status_name||r.statusName)==='FINALIZED' && r.result_name==='MAJORITY_AGREE','Receipt mismatch '+name);
  assert(['SUCCESS','FINISHED_WITH_RETURN'].includes(r.txExecutionResultName||r.consensus_data?.leader_receipt?.[0]?.execution_result),'Execution failure '+name);
  const votes=Object.values(r.consensus_data.votes),agree=votes.filter(v=>v==='agree').length;
  assert(agree>votes.length/2,'No strict quorum '+name);
  assert(r.to_address.toLowerCase()===config.address.toLowerCase(),'Wrong destination '+name);
  return {hash,agree,disagree:votes.filter(v=>v==='disagree').length,idle:votes.filter(v=>v==='idle').length};
}
async function main(){
  assert(await rpc('eth_chainId',[])==='0xf22f','Wrong chain');
  const local=fs.readFileSync(path.join(root,'contracts',repo.replaceAll('-','_')+'.py'));
  const remote=Buffer.from(await rpc('gen_getContractCode',[config.address]),'base64');
  assert(local.equals(remote),'Deployed source bytes differ from local source');
  const cli=process.env.GENLAYER_CLI_PATH;
  if(!cli||!fs.existsSync(cli))throw Error('Set GENLAYER_CLI_PATH to the installed genlayer/dist/index.js');
  let liveState;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const output=cp.execFileSync(process.execPath,['--require',path.join(__dirname,'cli-json.cjs'),cli,'call',config.address,config.view],{cwd:root,windowsHide:true,timeout:60000,maxBuffer:8000000,encoding:'utf8',stdio:['ignore','pipe','pipe']});
      const i=output.indexOf('Result:');assert(i>=0,'No state read result');liveState=JSON.parse(output.slice(i+7).trim());break;
    }catch(error){if(attempt===2)throw error;await new Promise(r=>setTimeout(r,5000));}
  }
  const summary={network:'studionet',chain_id:61999,contract:config.address,source_sha256:digest(remote),exact_source_match:true,live_receipts_and_state_match:true,verified_at:new Date().toISOString(),deployment:await receipt('deployment',config.deploy_tx),scenarios:[]};
  for(const s of config.scenarios){
    const p=load(s.name),row=p.state[s.index];
    assert(p.contract===config.address && p.observed_status===s.expected,'State metadata mismatch '+s.name);
    assert(p.state.length===s.index+1,'Unexpected append count '+s.name);
    assert(same(liveState.slice(0,s.index+1),p.state),'Live state differs from snapshot '+s.name);
    const r=await receipt(s.name,p.transaction);
    if(repo==='fact-triad'){
      assert(row.status===s.expected && row.sources.length===3 && row.topic===config.topic,'Wrong fact result '+s.name);
      const expectedStances={'v2-corroborated':['SUPPORTED','SUPPORTED','SUPPORTED'],'v2-conflict':['SUPPORTED','SUPPORTED','REFUTED'],'v2-insufficient':['SUPPORTED','SUPPORTED','UNKNOWN']};
      assert(same(row.sources.map(x=>x.analysis.claim),expectedStances[s.name]),'Unexpected source stance '+s.name);
      for(let i=0;i<3;i++){
        const bytes=fs.readFileSync(path.join(root,config.directory,s.files[i]+'.json'));
        const entry=row.sources[i],input=p.inputs[i];
        assert(entry.url===input.url && entry.hash===input.sha256 && entry.hash===digest(bytes),'Fact input binding '+s.name);
        const source=JSON.parse(bytes);
        assert(same(entry.source,source),'Fact source contents '+s.name);
        assert(source.text.includes(entry.analysis.quote),'Unanchored fact quote '+s.name);
      }
    }else{
      assert(row.analysis.status===s.expected,'Wrong drift result '+s.name);
      for(const [i,side] of [[0,'old'],[1,'new']]){
        const bytes=fs.readFileSync(path.join(root,config.directory,s.files[i]+'.json'));
        assert(row[side+'_url']===p.inputs[i].url && row[side+'_hash']===p.inputs[i].sha256 && row[side+'_hash']===digest(bytes),'Drift input binding '+s.name);
        for(const pointer of row.analysis['evidence_'+side]){
          let value=JSON.parse(bytes);
          if(pointer) for(const key of pointer.slice(1).split('/').map(k=>k.replaceAll('~1','/').replaceAll('~0','~'))) {assert(value!==null && typeof value==='object' && Object.hasOwn(value,key),'Bad pointer '+s.name);value=value[key];}
        }
      }
    }
    summary.scenarios.push({name:s.name,status:s.expected,...r});
  }
  fs.writeFileSync(path.join(root,'proofs','verification.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1});
