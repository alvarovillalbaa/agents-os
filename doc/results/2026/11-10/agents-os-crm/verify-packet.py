"""Read-only independent check of CRM originals, Git vectors and packed payload."""
import base64
import hashlib
import json
import pathlib
import subprocess
import sys
import tarfile

packet = pathlib.Path(sys.argv[1]).resolve()
source, workflow = sys.argv[2:4]
repo = next(parent for parent in pathlib.Path(__file__).resolve().parents if (parent/'.git').exists())
allow_failure = '--allow-failure' in sys.argv[4:]
digest = lambda raw: hashlib.sha256(raw).hexdigest()
load = lambda name: json.loads((packet/name).read_bytes())
compact = lambda value: json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()
manifest, receipt = load('packet-manifest.json'), load('receipt.json')
assert manifest['sourceCommit'] == receipt['sourceCommit'] == source
assert manifest['workflowCommit'] == receipt['workflowCommit'] == workflow
names = [row['name'] for row in manifest['files']]
assert len(names) == len(set(names))
assert sorted(names+['packet-manifest.json']) == sorted(file.name for file in packet.iterdir())
total = 0
for row in manifest['files']:
    assert pathlib.PurePosixPath(row['name']).name == row['name']
    file=packet/row['name']; assert file.is_file() and not file.is_symlink()
    raw=file.read_bytes(); assert len(raw) == row['bytes'] and digest(raw) == row['sha256']
    total += len(raw)
assert total <= 24*1024*1024
for command in receipt['commands']:
    for stream in command['streams']:
        raw=(packet/stream['name']).read_bytes()
        assert len(raw) == stream['bytes'] and digest(raw) == stream['sha256']
if receipt['status'] == 'passed':
    expected=[f'D0{i}' for i in range(1,6)]+[f'I{i:02}' for i in range(1,12)]+[f'B0{i}' for i in range(1,5)]
    assert [row['id'] for row in receipt['cases']] == expected and all(row['passed'] for row in receipt['cases'])
    assert receipt['errors'] == [] and len(receipt['commands']) == 14 and len(receipt['guards']) == 7
    assert receipt['unit'] == {'tests':5,'passed':5,'failed':0}
    cleanup=receipt['cleanup']
    assert cleanup['activeChildren'] == cleanup['remainingOwnedProcesses'] == cleanup['remainingOriginalWorkers'] == 0
    assert cleanup['remainingOriginalGroups'] == []
    assert all(cleanup[name] for name in ['allStreamsComplete','databaseRemoved','listenerClosed','rootRemoved'])
    assert receipt['database']['created'] and receipt['database']['removed'] and receipt['database']['bytes'] <= 256*1024*1024
    assert receipt['runtime']['bytes'] <= 4*1024**3 and receipt['runtime']['files'] <= 128000
    for command in receipt['commands']:
        assert command['closeObserved'] and command['originalGroupAbsent']
        assert not any(command.get(name) for name in ['overflow','timedOut','uncertainOwnership','spawnError'])
        assert len(command['streams']) == 2 and all(stream['complete'] for stream in command['streams'])
        identity=command['identity']; assert identity['pid'] == identity['pgid'] == identity['sid'] == command['pid']
        if command['label'] in ['paperclip-first','paperclip-restarted']:
            assert 'SIGTERM' in command['signals'] and (command['exitCode'],command['signal']) in [(0,None),(None,'SIGTERM')]
        else: assert command['exitCode'] == 0 and command['signal'] is None
    def git(*args, body=None):
        return subprocess.check_output(['git',*args],cwd=repo,input=body)
    records=[]
    for raw in git('ls-tree','-rz',source).split(b'\0'):
        if raw:
            head,name=raw.split(b'\t',1);mode,kind,blob=head.decode().split();assert kind=='blob'
            records.append((name.decode(),mode,blob))
    batch=git('cat-file','--batch',body=('\n'.join(row[2] for row in records)+'\n').encode())
    cursor=0;vector=[];source_bytes={}
    for name,mode,blob in records:
        end=batch.index(b'\n',cursor);head=batch[cursor:end].decode().split();assert head[0]==blob and head[1]=='blob'
        size=int(head[2]);raw=batch[end+1:end+1+size];assert batch[end+1+size:end+2+size]==b'\n';cursor=end+2+size
        assert mode in ['100644','100755','120000']
        vector.append({'path':name,'kind':'symlink' if mode=='120000' else 'file','bytes':len(raw),'mode':{'100644':420,'100755':493,'120000':511}[mode],'sha256':digest(raw)})
        source_bytes[name]=raw
    assert cursor==len(batch)
    vector.sort(key=lambda row:row['path']);prefix='extensions/agents-os/'
    protected=[{**row,'path':row['path'][len(prefix):]} for row in vector if row['path'].startswith(prefix)]
    assert 0<len(protected)<=100 and len(vector)<=2000
    for guard in receipt['guards']:
        assert guard['canonicalFiles']==len(vector) and guard['protectedFiles']==len(protected)
        assert guard['canonicalVectorSha256']==digest(compact(vector))
        assert guard['protectedVectorSha256']==guard['workingSourceVectorSha256']==digest(compact(protected))
    core,restart,browser=load('crm-api-core.json'),load('crm-api-restart.json'),load('crm-browser.json')
    assert core['passed'] and restart['passed'] and browser['passed']
    assert len(core['cases'])==10 and len(restart['cases'])==1
    withheld=[]
    for data in [core,restart]:
        assert data['sourceCommit']==source and not data['errors']
        for request in data['requests']:
            raw=(packet/request['capture']).read_bytes();assert len(raw)==request['capturedBytes']
            if request['originalBodyRetained']:
                assert len(raw)==request['responseBytes'] and digest(raw)==request['responseSha256']
            else:
                value=json.loads(raw);assert value['sensitiveBodyWithheld'] and value['responseSha256']==request['responseSha256'] and request['status']==201
                withheld.append(request)
    assert len(withheld)==1
    assert core['cases'][5]['validAgentRead'] and core['cases'][5]['agentCrm403s']==2 and core['cases'][5]['disposableKeyRevoked']
    assert restart['cases'][0]['actualServerRestart'] and restart['cases'][0]['originalWorkerAbsent']
    assert browser['sourceCommit']==source and browser['browserClosed'] and not browser['errors']
    assert len(browser['cases'])==4
    for case in browser['cases']:
        assert case['passed'] and not case['errors'] and len(case['captures'])==2
        assert case['contextsClosed']==(2 if case['id']=='B03' else 1)
        assert sum(bool(capture['png']) for capture in case['captures'])==1
        for capture in case['captures']:
            dom=load(capture['dom']);assert dom['geometry']==capture['geometry']
            assert dom['geometry']['scroll']<=case['width']+1 and dom['geometry']['body']<=case['width']+1
            if capture['png']:assert (packet/capture['png']).read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
    assert len(browser['cases'][2]['expectedFailures'])==1 and browser['cases'][2]['expectedFailures'][0]['status']==409
    replay=browser['cases'][3]['replay'];assert replay['sameRequestBytes'] and replay['attempts']==2 and replay['revision']==1
    original=(packet/'crm-b04-committed-response.json').read_bytes();committed=browser['cases'][3]['committedResponse']
    assert len(original)==committed['bytes'] and digest(original)==committed['sha256']
    package=load('packaged-files.json');archive=(packet/'agents-os-0.1.0.tgz').read_bytes()
    assert package['sourceCommit']==source and package['version']=='0.1.0'
    assert len(archive)==package['archiveBytes'] and digest(archive)==package['archiveSha256']
    assert 'sha512-'+base64.b64encode(hashlib.sha512(archive).digest()).decode()==package['integrity']
    with tarfile.open(packet/'agents-os-0.1.0.tgz','r:gz') as tar:
        members=tar.getmembers();assert sorted(m.name for m in members)==sorted('package/'+row['path'] for row in package['files'])
        for member in members:
            assert member.isfile() and member.name.startswith('package/') and '..' not in pathlib.PurePosixPath(member.name).parts
            raw=tar.extractfile(member).read();relative=member.name[8:];row=next(item for item in package['files'] if item['path']==relative)
            assert len(raw)==row['bytes'] and digest(raw)==row['sha256'] and member.mode==row['mode']
            if not relative.startswith('dist/'):
                assert raw==source_bytes[prefix+relative]
else:
    assert allow_failure,receipt['errors']
result={'verified':True,'status':receipt['status'],'sourceCommit':source,'workflowCommit':workflow,'files':len(names)+1,'bytes':total+(packet/'packet-manifest.json').stat().st_size,'cases':len(receipt['cases']),'errors':receipt['errors'],'cleanup':receipt['cleanup']}
if '--save' in sys.argv[4:]:
    target=pathlib.Path(sys.argv[sys.argv.index('--save')+1]);assert not target.exists();target.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
