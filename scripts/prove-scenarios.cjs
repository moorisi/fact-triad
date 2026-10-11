const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const repo = 'fact-triad';
if (!['fact-triad', 'drift-fence'].includes(repo)) throw Error('Unknown repository');
const root = path.resolve(__dirname, '..');
const cli = process.env.GENLAYER_CLI_PATH;
if (!cli || !fs.existsSync(cli)) throw Error('Set GENLAYER_CLI_PATH to the installed genlayer/dist/index.js');
const hook = path.join(__dirname, 'cli-json.cjs');
const journal = path.join(root, '.proof-journal');
const proofs = path.join(root, 'proofs');
for (const dir of [journal, proofs]) fs.mkdirSync(dir, {recursive:true});
const config = JSON.parse(fs.readFileSync(path.join(root, 'proof-config.json')));
const sanitize = x => Array.isArray(x) ? x.map(sanitize) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'node_config').map(([k,v]) => [k,/private.?key|api.?key|password|secret|authorization/i.test(k) ? 'REDACTED' : sanitize(v)])) : x;
const save = (name, x) => fs.writeFileSync(path.join(proofs, name+'.json'), JSON.stringify(sanitize(x), null, 2)+'\n');
const parse = output => { const i=output.indexOf('Result:'); if(i<0) throw Error('No CLI result: '+output.slice(-300)); return JSON.parse(output.slice(i+7).trim()); };
const delay = ms => new Promise(r=>setTimeout(r,ms));
async function invoke(label,args) {
  const file = path.join(journal,label+'.json');
  const prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};
  if(args[0]==='write' && prior.hash) {
    if(JSON.stringify(prior.args)!==JSON.stringify(args))throw Error('Saved write arguments differ; refuse unsafe recovery '+label);
    return 'Write Transaction Hash: '+prior.hash;
  }
  if(args[0]==='write' && prior.started) throw Error('Ambiguous prior send; inspect journal before retrying '+label);
  console.log('RUN',label);
  if(args[0]==='write') fs.writeFileSync(file,JSON.stringify({started:true,args}));
  return new Promise((resolve,reject)=>{
    const child=cp.spawn(process.execPath,['--require',hook,cli,...args],{cwd:root,windowsHide:true,env:{...process.env,NO_COLOR:'1'},stdio:['pipe','pipe','pipe']});
    child.stdin.end();
    let stdout='',stderr='',hash;
    const timeout=setTimeout(()=>{
      if(hash) { console.log('RECOVER VIA HASH',label,hash); child.kill(); }
    },90000);
    child.stdout.on('data',chunk=>{
      stdout+=String(chunk);
      const found=stdout.match(/Write Transaction Hash:\s*(0x[0-9a-f]{64})/i)?.[1];
      if(found && !hash){hash=found;fs.writeFileSync(file,JSON.stringify({started:true,args,hash}));console.log('SUBMITTED',label,hash);}
    });
    child.stderr.on('data',chunk=>stderr+=String(chunk));
    child.on('error',reject);
    child.on('close',code=>{
      clearTimeout(timeout);
      fs.writeFileSync(file,JSON.stringify({started:true,args,hash,stdout,stderr,code}));
      if(code && !hash) reject(Error(label+': '+stderr.slice(-900)));
      else resolve(hash && code ? 'Write Transaction Hash: '+hash : stdout);
    });
  });
}
async function read(label,args){
  for(let attempt=0;attempt<3;attempt++){
    try{return parse(await invoke(label,args));}
    catch(error){if(attempt===2)throw error;console.log('READ RETRY',label,error.message.slice(0,100));await delay(10000);}
  }
}
async function receipt(label,hash){
  let value;
  for(let attempt=0;attempt<100;attempt++){
    try {
      const response=await fetch('https://studio.genlayer.com/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getTransactionByHash',params:[hash]}),signal:AbortSignal.timeout(30000)});
      const data=await response.json();
      if(!response.ok||data.error)throw Error(JSON.stringify(data.error||response.status));
      value=data.result;
      if(value){
        value.status_name=value.status_name||value.statusName||(typeof value.status==='string'?value.status:undefined);
        value.result_name=value.result_name||(typeof value.result==='string'?value.result:undefined);
        value.hash=value.hash||value.tx_id;
        value.to_address=value.to_address||value.recipient;
      }
      if(value?.status_name==='FINALIZED')break;
    }catch(error){console.log('RECEIPT READ RETRY',label,error.message.slice(0,100));}
    await delay(6000);
  }
  save(label+'-receipt',value);
  const status=value.statusName||value.status_name;
  const execution=value.txExecutionResultName||value.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log('RECEIPT',label,status,execution,value.result_name,JSON.stringify(value.consensus_data?.votes));
  if(status!=='FINALIZED')throw Error('Not finalized '+label);
  return value;
}
async function main(){
  if(process.argv[2]==='recover'){
    await receipt('deployment',config.deploy_tx);
    for(const s of config.scenarios.filter(x=>x.tx)) await receipt(s.name,s.tx);
    const state=await read('recovered-state',['call',config.address,config.view]);save('recovered-state',{contract:config.address,state});
    console.log('STATE',JSON.stringify(state));return;
  }
  for(const s of config.scenarios){
    const known=path.join(proofs,s.name+'.json');
    if(fs.existsSync(known)){
      const recorded=JSON.parse(fs.readFileSync(known));
      if(recorded.contract!==config.address||recorded.observed_status!==s.expected)throw Error('Existing proof differs; preserve and inspect '+s.name);
      console.log('ALREADY RECORDED',s.name);continue;
    }
    const revision=s.revision||config.revision;
    const docs=s.files.map(name=>{
      const bytes=fs.readFileSync(path.join(root,config.directory,name+'.json'));
      return {url:`https://raw.githubusercontent.com/moorisi/${repo}/${revision}/${config.directory}/${name}.json`,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes};
    });
    for(const d of docs){const r=await fetch(d.url,{signal:AbortSignal.timeout(30000)});if(!r.ok||!d.bytes.equals(Buffer.from(await r.arrayBuffer())))throw Error('Public fixture mismatch '+d.url);}
    const args=repo==='fact-triad'?[JSON.stringify(docs.map(d=>d.url)),JSON.stringify(docs.map(d=>d.sha256))]:docs.flatMap(d=>[d.url,d.sha256]);
    const priorWrite=path.join(journal,s.name+'.json');
    const resumed=Boolean(s.tx||(fs.existsSync(priorWrite)&&JSON.parse(fs.readFileSync(priorWrite)).hash));
    const before=await read(s.name+'-before',['call',config.address,config.view]);
    if(!resumed && before.length!==s.index)throw Error('Unexpected pre-write append count '+s.name);
    const output=s.tx?'Write Transaction Hash: '+s.tx:await invoke(s.name,['write',config.address,config.method,'--args',...args]);
    const hash=output.match(/Write Transaction Hash:\s*(0x[0-9a-f]{64})/i)?.[1];if(!hash)throw Error('Missing hash');
    const r=await receipt(s.name,hash);
    const state=await read(s.name+'-state',['call',config.address,config.view]);
    const entry=state[s.index];
    const status=repo==='fact-triad'?entry?.status:entry?.analysis?.status;
    save(s.name,{network:'studionet',chain_id:61999,contract:config.address,transaction:hash,expected_status:s.expected,observed_status:status,inputs:docs.map(({bytes,...d})=>d),state_before:resumed?null:before,state});
    const execution=r.txExecutionResultName||r.consensus_data?.leader_receipt?.[0]?.execution_result;
    if(!['SUCCESS','FINISHED_WITH_RETURN'].includes(execution)||r.result_name!=='MAJORITY_AGREE'||status!==s.expected)throw Error('Scenario failed '+s.name+' expected '+s.expected+' got '+status);
    console.log('VERIFIED',s.name,status);
    await delay(4000);
  }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
