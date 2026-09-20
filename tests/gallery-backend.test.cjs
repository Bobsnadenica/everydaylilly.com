const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');
const path = require('node:path');
const {fileURLToPath} = require('node:url');
const source = fs.readFileSync('app/backend/live/prod/lambda/gallery_manifest/index.mjs', 'utf8');
const privateKey = crypto.generateKeyPairSync('rsa', {modulusLength:1024}).privateKey.export({type:'pkcs8',format:'pem'});
function backend({objects, derived, existing = false} = {}) {
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
  const context=vm.createContext({S3Client,ListObjectsV2Command,HeadObjectCommand,crypto,path,fileURLToPath,fs:{readFileSync:()=>privateKey},process:{env:{AWS_ACCESS_KEY_ID:'test',AWS_SECRET_ACCESS_KEY:'test-secret',GALLERY_BUCKET:'private-test',GALLERY_TIMELINE_START_DATE:'2000-12-09',GALLERY_PUBLIC_BASE_URL:'https://media.example.com',GALLERY_SIGNER_KEY_PAIR_ID:'test-key'}},URL,console,Buffer});
  vm.runInContext(source.replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',JSON.stringify('file:///test/index.mjs')).replace(/^export /gm,'')+'\nglobalThis.api={handler,thumbnailKey};',context);
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

test('personal manifest uses verified subject ownership while family manifest includes shared memories',async()=>{
  const own=asset(`months/4/by/${ownerFor('grandmother')}/photo.jpg`);
  const others=[asset(`months/4/by/${ownerFor('another')}/photo.jpg`),asset('months/0/legacy.jpg')];
  const h=backend({objects:[own,...others],derived:[]});
  const family=JSON.parse((await h.handler(eventFor(claimsFor(['grandma'])))).body);
  assert.equal(family.photos.length,3);assert.equal(family.user.canUpload,true);assert.equal(family.user.isGrandma,true);
  assert.equal(family.photos.find(p=>p.key===own.Key).isMine,true);
  assert.equal(family.photos.filter(p=>p.isMine).length,1);
  const personal=JSON.parse((await h.handler(eventFor(claimsFor(['grandma']),{queryStringParameters:{scope:'mine',owner:ownerFor('another')}}))).body);
  assert.deepEqual(personal.photos.map(p=>p.key),[own.Key]);assert.equal(personal.scope,'mine');
  const viewer=JSON.parse((await h.handler(eventFor(claimsFor(['viewers'],'another')))).body);
  assert.equal(viewer.photos.length,3);assert.equal(viewer.user.canUpload,false);
});

test('grandma uploads HEIC only to her server-derived namespace and cannot impersonate another uploader',async()=>{
  const h=backend();
  const result=await h.handler(eventFor(claimsFor(['grandma']),{body:JSON.stringify({month:4,filename:'new.heic',contentType:'image/heic',owner:'another'})}));
  assert.equal(result.statusCode,200);
  const upload=JSON.parse(result.body);
  assert.equal(upload.key,`months/4/by/${ownerFor('grandmother')}/new.heic`);
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
  const result=await h.handler(eventFor(claimsFor(['grandma']),{body:JSON.stringify({month:0,filename:'same.jpg'})}));
  assert.equal(result.statusCode,409);
  for(const month of ['1oops',60,-1,'']){
    const result=await backend().handler(eventFor(claimsFor(['admin']),{body:JSON.stringify({month,filename:'image.jpg'})}));
    assert.equal(result.statusCode,400);
  }
});

test('HEIC is withheld until its display JPEG exists and the viewer receives a signed JPEG',async()=>{
  const source=asset(`months/4/by/${ownerFor('grandmother')}/image.heic`);
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
