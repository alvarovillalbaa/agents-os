"""Independent read-only verification of Shared Harness CI originals and Git/package vectors."""
import base64,hashlib,json,pathlib,re,subprocess,sys,tarfile
packet=pathlib.Path(sys.argv[1]).resolve();source,workflow=sys.argv[2:4]
if '--repo'in sys.argv:
 repo=pathlib.Path(sys.argv[sys.argv.index('--repo')+1]).resolve()
else:
 roots=[*pathlib.Path(__file__).resolve().parents,pathlib.Path.cwd(),pathlib.Path.cwd()/'agents-os']
 repo=next((p for p in roots if(p/'.git').exists()),None)
 if repo is None:raise SystemExit('Run inside the source repository or pass --repo PATH.')
sha=lambda raw:hashlib.sha256(raw).hexdigest()
load=lambda name:json.loads((packet/name).read_bytes())
compact=lambda value:json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()
manifest,receipt=load('packet-manifest.json'),load('receipt.json')
assert manifest['sourceCommit']==receipt['sourceCommit']==source and manifest['workflowCommit']==receipt['workflowCommit']==workflow
names=[row['name']for row in manifest['files']];assert len(names)==len(set(names))
assert sorted(names+['packet-manifest.json'])==sorted(p.name for p in packet.iterdir())
total=0
for row in manifest['files']:
 assert pathlib.PurePosixPath(row['name']).name==row['name'];file=packet/row['name'];assert file.is_file()and not file.is_symlink()
 raw=file.read_bytes();assert len(raw)==row['bytes']and sha(raw)==row['sha256'];total+=len(raw)
assert total<=24*1024**2
for command in receipt['commands']:
 for stream in command['streams']:
  raw=(packet/stream['name']).read_bytes();assert len(raw)==stream['bytes']and sha(raw)==stream['sha256']
def git(*args,body=None):return subprocess.check_output(['git',*args],cwd=repo,input=body)
records=[]
for raw in git('ls-tree','-rz',source).split(b'\0'):
 if raw:
  head,name=raw.split(b'\t',1);mode,kind,blob=head.decode().split();assert kind=='blob';records.append((name.decode(),mode,blob))
batch=git('cat-file','--batch',body=('\n'.join(r[2]for r in records)+'\n').encode());cursor=0;vector=[];source_bytes={}
for name,mode,blob in records:
 end=batch.index(b'\n',cursor);head=batch[cursor:end].decode().split();assert head[:2]==[blob,'blob'];size=int(head[2]);raw=batch[end+1:end+1+size];assert batch[end+1+size:end+2+size]==b'\n';cursor=end+size+2
 assert mode in ['100644','100755','120000'];vector.append({'path':name,'kind':'symlink'if mode=='120000'else'file','bytes':len(raw),'mode':{'100644':420,'100755':493,'120000':511}[mode],'sha256':sha(raw)});source_bytes[name]=raw
assert cursor==len(batch);vector.sort(key=lambda r:r['path']);prefix='extensions/agents-os-harness/'
protected=[{**r,'path':r['path'][len(prefix):]}for r in vector if r['path'].startswith(prefix)];assert len(vector)<=2000 and 0<len(protected)<=100
for guard in receipt['guards']:
 assert guard['canonicalFiles']==len(vector)and guard['protectedFiles']==len(protected)
 assert guard['canonicalVectorSha256']==sha(compact(vector))and guard['protectedVectorSha256']==guard['workingSourceVectorSha256']==sha(compact(protected))
if receipt['status']=='passed':
 expected=[f'H{n:02}'for n in range(1,13)]+[f'J{n:02}'for n in range(1,12)]+[f'HB{n:02}'for n in range(1,5)]
 assert [r['id']for r in receipt['cases']]==expected and len(expected)==27 and all(r['passed']for r in receipt['cases'])and not receipt['errors']
 assert len(receipt['commands'])==17 and len(receipt['guards'])==7 and receipt['unit']=={'tests':12,'passed':12,'failed':0}
 expected_labels=['tools-install','chromium-install','plugin-dependencies','plugin-typecheck','plugin-domain','plugin-build','plugin-pack','package-list','package-extract','previous-package-download','previous-package-list','previous-package-extract','paperclip-first','harness-api-core','paperclip-restarted','harness-api-restart','harness-browser']
 assert [r['label']for r in receipt['commands']]==expected_labels
 for command in receipt['commands']:
  assert command['closeObserved']and command['originalGroupAbsent']and not any(command.get(n)for n in ['overflow','timedOut','uncertainOwnership','spawnError'])
  assert len(command['streams'])==2 and all(r['complete']for r in command['streams']);identity=command['identity'];assert identity['pid']==identity['pgid']==identity['sid']==command['pid']
  if command['label']in ['paperclip-first','paperclip-restarted']:assert 'SIGTERM'in command['signals']and(command['exitCode'],command['signal'])in[(0,None),(None,'SIGTERM')]
  else:assert command['exitCode']==0 and command['signal']is None
 tap=(packet/'plugin-domain.stdout.txt').read_text()
 test_names=[]
 for name,raw in source_bytes.items():
  if name.startswith(prefix+'tests/')and name.endswith('.test.ts'):test_names+=re.findall(r"test\('([^']+)'",raw.decode())
 assert len(test_names)==len(set(test_names))==12
 assert all(re.search(r'^ok \d+ - '+re.escape(name)+r'\s*$',tap,re.M)for name in test_names)
 cleanup=receipt['cleanup'];assert cleanup['activeChildren']==cleanup['remainingOwnedProcesses']==cleanup['remainingOriginalWorkers']==0 and cleanup['remainingOriginalGroups']==[]
 assert all(cleanup[n]for n in ['allStreamsComplete','databaseRemoved','listenerClosed','rootRemoved'])
 assert receipt['database']['created']and receipt['database']['removed']and receipt['database']['bytes']<=256*1024**2
 assert receipt['runtime']['bytes']<=4*1024**3 and receipt['runtime']['files']<=128000
 reports={name:load(name+'.json')for name in ['harness-api-core','harness-api-restart','browser-setup']};withheld=[]
 for name,data in reports.items():
  assert data['sourceCommit']==source and data['passed']and not data['errors']
  for request in data['requests']:
   raw=(packet/request['capture']).read_bytes();assert len(raw)==request['capturedBytes']
   if request['originalBodyRetained']:assert len(raw)==request['responseBytes']and sha(raw)==request['responseSha256']
   else:
    value=json.loads(raw);assert value['sensitiveBodyWithheld']and value['responseSha256']==request['responseSha256']and request['status']==201;withheld.append(request)
 assert len(withheld)==1
 core=reports['harness-api-core'];assert len(core['cases'])==9
 assert core['cases'][2]['pausedAndHeartbeatsOff']and core['cases'][3]['attachedAgents']==2 and core['cases'][3]['nativeSkillSnapshots']==2
 assert all(core['cases'][5][k]for k in ['changedInstructionsPreserved','forkContentPreserved','alternativeSelectionPreserved','packagedSkillReadOnly','deliberateDeselectionPreserved','privateAdapterCanaryWithheld'])
 assert core['cases'][6]['nativeHireApprovals']==2 and core['cases'][6]['deniedAgentRoutes']==4 and core['cases'][6]['keyRevoked']
 assert core['cases'][8]['noHeartbeatRuns']
 restarted=reports['harness-api-restart'];assert len(restarted['cases'])==2 and restarted['cases'][0]['nativeWorkersReplaced']==2
 browser=load('harness-browser.json');assert browser['sourceCommit']==source and browser['passed']and browser['browserClosed']and not browser['errors']and len(browser['cases'])==4
 for index,case in enumerate(browser['cases'],1):
  assert case['id']==f'HB{index:02}'and case['passed']and not case['errors']and case['contextsClosed']==1
  assert len(case['captures'])==2 and sum(bool(c['png'])for c in case['captures'])==1
  assert case['width']==(390 if index==2 else 1280)and case['settlements']
  assert all(r['url'].startswith('http://127.0.0.1:4315/')or r['url'].startswith('data:')for r in case['requests'])
  for capture in case['captures']:
   dom=load(capture['dom']);assert dom['geometry']==capture['geometry'];assert dom['geometry']['scroll']<=case['width']+1 and dom['geometry']['body']<=case['width']+1
   assert 'Shared Harness'in dom['html']and 'aos-harness'in dom['html']
   if capture['png']:assert(packet/capture['png']).read_bytes().startswith(bytes([137,80,78,71,13,10,26,10]))
  assert len(case['expectedFailures'])==(1 if index==4 else 0)
 repair=browser['cases'][2]['repair'];assert repair['retiredOperator']!=repair['newOperator']!=repair['retainedPlanner']
 replay=browser['cases'][3]['replay'];assert replay['sameRequestBytes']and replay['attempts']==2 and replay['sameBindings']
 raw=(packet/'harness-hb04-committed-response.json').read_bytes();meta=browser['cases'][3]['committedResponse'];assert len(raw)==meta['bytes']and sha(raw)==meta['sha256']
 package=load('packaged-files.json');archive=(packet/'agents-os-harness-0.1.0.tgz').read_bytes();assert package['sourceCommit']==source and package['version']=='0.1.0'
 assert len(archive)==package['archiveBytes']and sha(archive)==package['archiveSha256']and 'sha512-'+base64.b64encode(hashlib.sha512(archive).digest()).decode()==package['integrity']
 with tarfile.open(packet/'agents-os-harness-0.1.0.tgz','r:gz')as tar:
  assert sorted(m.name for m in tar.getmembers())==sorted('package/'+r['path']for r in package['files'])
  for member in tar.getmembers():
   assert member.isfile()and member.name.startswith('package/')and '..'not in pathlib.PurePosixPath(member.name).parts
   raw=tar.extractfile(member).read();relative=member.name[8:];r=next(r for r in package['files']if r['path']==relative)
   assert len(raw)==r['bytes']and sha(raw)==r['sha256']and member.mode==r['mode']
   if not relative.startswith('dist/'):assert raw==source_bytes[prefix+relative]
 old=(packet/'previous-agents-os-0.2.0.tgz').read_bytes();assert len(old)==230638 and sha(old)=='354c175bb5ca7739e7c0dd70e44e3b08b18762ad49fa943ea8970136264a2cda'
else:assert '--allow-failure'in sys.argv[4:],receipt['errors']
result={'verified':True,'status':receipt['status'],'sourceCommit':source,'workflowCommit':workflow,'files':len(names)+1,'bytes':total+(packet/'packet-manifest.json').stat().st_size,'cases':len(receipt['cases']),'errors':receipt['errors'],'cleanup':receipt['cleanup']}
if '--save'in sys.argv[4:]:
 target=pathlib.Path(sys.argv[sys.argv.index('--save')+1]);assert not target.exists();target.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
