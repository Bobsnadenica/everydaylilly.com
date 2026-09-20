const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');
const path = require('node:path');
const {fileURLToPath} = require('node:url');
const source = fs.readFileSync('app/backend/live/prod/lambda/gallery_manifest/index.mjs', 'utf8');
const privateKey = crypto.generateKeyPairSync('rsa', {modulusLength:1024}).privateKey.export({type:'pkcs8',format:'pem'});
function backend({objects, derived, existing = false, legacyOwners = ''} = {}) {
  const original={Key:'months/0/video.mov',ETag:'"abc123"',Size:123,LastModified:new Date('2025-05-10')};
  const hash=crypto.createHash('sha256').update('months/0/video.mov\nabc123').digest('hex');
  const requests=[];
  class ListObjectsV2Command {constructor(input){this.input=input;}}
  class HeadObjectCommand {constructor(input){this.input=input;}}
  class S3Client {async send(command){
    requests.push(command.input);
    if(command instanceof HeadObjectCommand){if(existing)return {};throw Object.assign(new Error('missing'),{name:'NotFound',$metadata:{httpStatusCode:404}});}
    return {Contents:command.input.Prefix==='months/'?(objects || [original]):command.input.Prefix==='test/'?[]:(derived || [{Key:`previews/months/${hash}.jpg`,Size:12,ETag:'"thumb"'}])};
  }}
  const context=vm.createContext({S3Client,ListObjectsV2Command,HeadObjectCommand,crypto,path,fileURLToPath,fs:{readFileSync:()=>privateKey},process:{env:{GALLERY_GRANDMA_LEGACY_CONTRIBUTORS:legacyOwners,AWS_ACCESS_KEY_ID:'test',AWS_SECRET_ACCESS_KEY:'test-secret',GALLERY_BUCKET:'private-test',GALLERY_TIMELINE_START_DATE:'2000-12-09',GALLERY_PUBLIC_BASE_URL:'https://media.example.com',GALLERY_SIGNER_KEY_PAIR_ID:'test-key'}},URL,console,Buffer});
  vm.runInContext(source.replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',JSON.stringify('file:///test/index.mjs')).replace(/^export /gm,'')+'\nglobalThis.api={handler,thumbnailKey,captureDate,captureMonth};',context);
  return {...context.api,requests,hash};
}
test('manifest signs a separate preview URL without adding derived images to photo counts',async()=>{
  const h=backend();
  const result=await h.handler({requestContext:{http:{method:'GET',path:'/api/gallery/manifest'},authorizer:{jwt:{claims:{token_use:'id','cognito:groups':['admin']}}}}});
  assert.equal(result.statusCode,200);
  const body=JSON.parse(result.body);
  assert.equal(body.timelineStartDate,'2000-12-09');
  assert.equal(body.photos.length,1);
  assert.equal(body.photos[0].kind,'movie');
  assert.equal(new URL(body.photos[0].thumbnailUrl).pathname,`/previews/months/${h.hash}.jpg`);
  assert.equal(new URL(body.photos[0].url).pathname,'/months/0/video.mov');
  assert.deepEqual(h.requests.map(r=>r.Prefix),['months/','previews/months/']);
});
test('unassigned accounts cannot list originals or previews',async()=>{
  const h=backend();
  const result=await h.handler({requestContext:{authorizer:{jwt:{claims:{token_use:'id'}}}}});
  assert.equal(result.statusCode,403);
  assert.equal(h.requests.length,0);
});
test('a replaced original receives a different immutable preview key',()=>{
  const h=backend();
  assert.notEqual(h.thumbnailKey({key:'months/0/video.mov',etag:'one'},'months'),h.thumbnailKey({key:'months/0/video.mov',etag:'two'},'months'));
});

const ownerFor = sub => crypto.createHash('sha256').update(sub).digest('hex').slice(0,32);
const claimsFor = (groups, sub='grandmother') => ({token_use:'id',sub,'cognito:groups':groups});
const eventFor = (claims, options={}) => ({requestContext:{authorizer:{jwt:{claims}},http:{method:options.body?'POST':'GET'}},rawPath:options.body?'/api/gallery/upload-url':'/api/gallery/manifest',...options});
const asset = key => ({Key:key,ETag:'"source"',Size:80,LastModified:new Date('2026-09-20')});

test('grandma sees personal and family memories; ordinary viewers cannot see grandma media',async()=>{
  const own=asset(`months/grandma/4/by/${ownerFor('grandmother')}/photo.jpg`);
  const others=[asset(`months/4/by/${ownerFor('another')}/photo.jpg`),asset('months/0/legacy.jpg')];
  const h=backend({objects:[own,...others],derived:[]});
  const family=JSON.parse((await h.handler(eventFor(claimsFor(['grandma'])))).body);
  assert.equal(family.photos.length,3);assert.equal(family.user.canUpload,true);assert.equal(family.user.isGrandma,true);
  assert.equal(family.photos.find(p=>p.key===own.Key).isMine,true);
  assert.equal(family.photos.filter(p=>p.isMine).length,1);
  const personal=JSON.parse((await h.handler(eventFor(claimsFor(['grandma']),{queryStringParameters:{scope:'mine',owner:ownerFor('another')}}))).body);
  assert.deepEqual(personal.photos.map(p=>p.key),[own.Key]);assert.equal(personal.scope,'mine');
  const viewer=JSON.parse((await h.handler(eventFor(claimsFor(['viewers'],'another')))).body);
  assert.equal(viewer.photos.length,2);assert.equal(viewer.user.canUpload,false);
});

test('grandma uploads HEIC only to her server-derived namespace and cannot impersonate another uploader',async()=>{
  const h=backend();
  const result=await h.handler(eventFor(claimsFor(['grandma']),{body:JSON.stringify({month:4,capturedAt:'2001-04-10',filename:'new.heic',contentType:'image/heic',owner:'another'})}));
  assert.equal(result.statusCode,200);
  const upload=JSON.parse(result.body);
  assert.equal(upload.key,`months/grandma/4/by/${ownerFor('grandmother')}/2001-04-10T00-00-00--new.heic`);
  assert.equal(upload.headers['If-None-Match'],'*');assert.equal(upload.contentType,'image/heic');
  assert.ok(new URL(upload.url).searchParams.get('X-Amz-SignedHeaders').includes('if-none-match'));
});

test('viewer, test and missing-identity uploads fail closed; grandma cannot replace covers or upload movies',async()=>{
  const scenarios=[
    [claimsFor(['viewers']),{}], [claimsFor(['test','admin']),{}], [claimsFor(['grandma'],''),{}],
    [claimsFor(['grandma']),{uploadKind:'hero'}], [claimsFor(['grandma']),{filename:'movie.mov'}]
  ];
  for(const [claims,change] of scenarios){
    const h=backend();const result=await h.handler(eventFor(claims,{body:JSON.stringify({month:0,filename:'image.jpg',...change})}));
    assert.equal(result.statusCode,403);assert.equal(h.requests.length,0);
  }
});

test('duplicate uploads cannot overwrite and invalid month strings are rejected',async()=>{
  const h=backend({existing:true});
  const result=await h.handler(eventFor(claimsFor(['grandma']),{body:JSON.stringify({month:0,capturedAt:'2000-12-10',filename:'same.jpg'})}));
  assert.equal(result.statusCode,409);
  for(const month of ['1oops',60,-1,'']){
    const result=await backend().handler(eventFor(claimsFor(['admin']),{body:JSON.stringify({month,filename:'image.jpg'})}));
    assert.equal(result.statusCode,400);
  }
});

test('HEIC is withheld until its display JPEG exists and the viewer receives a signed JPEG',async()=>{
  const source=asset(`months/grandma/4/by/${ownerFor('grandmother')}/image.heic`);
  const key=backend().thumbnailKey({key:source.Key,etag:'source'},'months');
  const pending=JSON.parse((await backend({objects:[source],derived:[]}).handler(eventFor(claimsFor(['grandma'])))).body);
  assert.equal(pending.pendingCount,1);assert.equal(pending.photos.length,0);
  const ready=JSON.parse((await backend({objects:[source],derived:[asset(key),asset(key.replace('.jpg','.display.jpg'))]}).handler(eventFor(claimsFor(['grandma'])))).body);
  assert.equal(ready.pendingCount,0);assert.equal(ready.photos[0].key,source.Key);
  assert.match(new URL(ready.photos[0].url).pathname,/\.display\.jpg$/);
  assert.ok(ready.photos[0].thumbnailUrl);assert.equal(ready.photos[0].isMine,true);
});

test('test collection stays isolated even when grandma membership is also present',async()=>{
  const h=backend();const result=JSON.parse((await h.handler(eventFor(claimsFor(['test','grandma'])))).body);
  assert.equal(result.collection,'test');assert.equal(result.user.isGrandma,false);assert.equal(result.user.canUpload,false);
  assert.equal(result.photos.length,0);assert.equal(h.requests[0].Prefix,'test/');
});


test('admin without grandma cannot see restricted originals or their preview and display URLs',async()=>{
  const owner=ownerFor('grandmother');
  const hidden=[asset(`months/grandma/1/by/${owner}/2001-01-12.jpg`),asset(`months/1/by/${owner}/2001-01-13.heic`)];
  const publicPhoto=asset('months/0/2000-12-10.jpg');
  const h=backend({objects:[...hidden,publicPhoto],derived:[],legacyOwners:owner});
  for(const groups of [['admin'],['viewers'],['admin','test']]){
    const body=JSON.parse((await h.handler(eventFor(claimsFor(groups,'grandmother')))).body);
    assert.equal(body.pendingCount,0);
    assert.ok(body.photos.every(p=>p.key===publicPhoto.Key));
    assert.ok(!JSON.stringify(body).includes(owner));
  }
  const grandma=JSON.parse((await h.handler(eventFor(claimsFor(['grandma'],'other-grandma')))).body);
  assert.equal(grandma.photos.length,2); assert.equal(grandma.pendingCount,1);
  const mine=JSON.parse((await h.handler(eventFor(claimsFor(['admin'],'grandmother'),{queryStringParameters:{scope:'mine'}}))).body);
  assert.equal(mine.photos.length,0);
});

test('date parsing is strict, retains capture time and never invents a date',()=>{
  const h=backend();
  assert.equal(h.captureDate('IMG_20010410_152233.JPG'),'2001-04-10T15:22:33Z');
  assert.equal(h.captureDate('2001-04-10T15-22-33--image.heic'),'2001-04-10T15:22:33Z');
  for(const name of ['IMG_5471.JPG','2001-02-29.jpg','20010431_100000.JPG','2001-04-10T25-00-00.jpg']) assert.equal(h.captureDate(name),null);
  assert.equal(h.captureMonth('2000-12-08T23:59:59Z'),null);
  assert.equal(h.captureMonth('2000-12-09T00:00:00Z'),0);
  assert.equal(h.captureMonth('2001-01-08T23:59:59Z'),0);
  assert.equal(h.captureMonth('2001-01-09T00:00:00Z'),1);
});

test('uploads reject missing, impossible, future, pre-birth, conflicting and wrong-month dates before signing',async()=>{
  for(const change of [{}, {capturedAt:'2001-02-29'}, {capturedAt:'2000-12-08'}, {capturedAt:'2099-01-01'}, {capturedAt:'2001-01-09'}, {filename:'2000-12-10.jpg',capturedAt:'2000-12-11'}]){
    const h=backend();
    const result=await h.handler(eventFor(claimsFor(['grandma']),{body:JSON.stringify({month:0,filename:'IMG_1234.jpg',...change})}));
    assert.equal(result.statusCode,400); assert.equal(h.requests.length,0);
  }
});

test('grandma role cannot bypass private uploads by also having admin or supplying audience',async()=>{
  const result=await backend().handler(eventFor(claimsFor(['admin','grandma']),{body:JSON.stringify({month:0,filename:'2000-12-10.jpg',audience:'family'})}));
  assert.equal(result.statusCode,200);assert.match(JSON.parse(result.body).key,/^months\/grandma\/0\/by\//);
  const hero=await backend().handler(eventFor(claimsFor(['admin','grandma']),{body:JSON.stringify({month:0,filename:'2000-12-10.jpg',uploadKind:'hero'})}));
  assert.equal(hero.statusCode,403);
});

test('manifest order follows capture timestamp, not reverse S3 upload timestamps',async()=>{
  const late={...asset('months/0/IMG_20001210_170000.jpg'),LastModified:new Date('2001-01-01')};
  const early={...asset('months/0/2000-12-10T09-00-00--image.jpg'),LastModified:new Date('2001-02-01')};
  const body=JSON.parse((await backend({objects:[late,early],derived:[]}).handler(eventFor(claimsFor(['admin'])))).body);
  assert.deepEqual(body.photos.map(p=>p.key),[early.Key,late.Key]);
  assert.equal(body.photos[0].capturedAt,'2000-12-10T09:00:00Z');
});
