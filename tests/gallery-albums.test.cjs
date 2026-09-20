const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');
const path = require('node:path');
const {fileURLToPath} = require('node:url');
const source = fs.readFileSync('app/backend/live/prod/lambda/gallery_manifest/index.mjs','utf8');
const privateKey = crypto.generateKeyPairSync('rsa',{modulusLength:1024}).privateKey.export({type:'pkcs8',format:'pem'});
const owner = crypto.createHash('sha256').update('grandma-account').digest('hex').slice(0,32);
const ownKey = 'albums/grandma/month-02/2001-01-12T09-00-00_abc.heic';
const sharedKey = 'albums/family/month-01/2000-12-12T10-00-00_def.jpg';
const coverKey = 'covers/family/month-01/cover.jpg';
const object = Key => ({Key,ETag:'"etag"',Size:100,LastModified:new Date('2026-01-01')});
function preview(key){return 'previews/'+key.replace(/^albums\//,'').replace(/\.[^.]+$/,'')+'-'+crypto.createHash('sha256').update('etag').digest('hex').slice(0,12)+'.jpg';}
function backend({races=0,malformed=false,existingSource=false}={}){
 const requests=[];let stored={version:1,photos:[{key:ownKey}]};let version=1;
 class DeleteObjectsCommand{constructor(input){this.input=input;}}
 class CreateInvalidationCommand{constructor(input){this.input=input;}}
 class CloudFrontClient{async send(command){requests.push(command);return {};}}
 class GetObjectCommand{constructor(input){this.input=input;}}
 class PutObjectCommand{constructor(input){this.input=input;}}
 class HeadObjectCommand{constructor(input){this.input=input;}}
 class ListObjectsV2Command{constructor(input){this.input=input;}}
 class S3Client{async send(command){
  requests.push(command);
  if(command instanceof GetObjectCommand)return {ETag:`"${version}"`,Body:{transformToString:async()=>malformed?'{}':JSON.stringify(stored)}};
  if(command instanceof PutObjectCommand){
   assert.equal(command.input.IfMatch,`"${version}"`);
   if(races-->0){stored.photos.push({key:'albums/grandma/month-03/concurrent.jpg'});version++;throw {$metadata:{httpStatusCode:412}};}
   stored=JSON.parse(command.input.Body);version++;return {};
  }
  if(command instanceof DeleteObjectsCommand)return {};
  if(command instanceof HeadObjectCommand && existingSource)return {ETag:'"etag"',VersionId:"source-version"};
  if(command instanceof HeadObjectCommand)throw {name:'NotFound',$metadata:{httpStatusCode:404}};
  const keys=[sharedKey,ownKey,coverKey,preview(sharedKey),preview(ownKey),preview(ownKey).replace('.jpg','.display.jpg'),preview(coverKey),'needs-review/family/undated.jpg'];
  return {Contents:keys.filter(key=>key.startsWith(command.input.Prefix)).map(object)};
 }}
 const env={GALLERY_DISTRIBUTION_ID:'test-distribution',GALLERY_STORAGE_LAYOUT:'albums',GALLERY_BUCKET:'test-bucket',GALLERY_TIMELINE_START_DATE:'2000-12-09',GALLERY_PUBLIC_BASE_URL:'https://media.example.com',GALLERY_SIGNER_KEY_PAIR_ID:'test-key',AWS_ACCESS_KEY_ID:'test',AWS_SECRET_ACCESS_KEY:'test'};
 const context=vm.createContext({CloudFrontClient,CreateInvalidationCommand,DeleteObjectsCommand,S3Client,GetObjectCommand,PutObjectCommand,HeadObjectCommand,ListObjectsV2Command,crypto,path,fileURLToPath,fs:{readFileSync:()=>privateKey},process:{env},URL,Buffer,console:{error(){},warn(){}}});
 vm.runInContext(source.replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',JSON.stringify('file:///test/index.mjs')).replace(/^export /gm,'')+'\nglobalThis.api={handler,thumbnailKey};',context);
 return {...context.api,requests,get stored(){return stored;}};
}
function event(groups,{scope='family',body}={}){return {rawPath:body?'/api/gallery/upload-url':'/api/gallery/manifest',requestContext:{http:{method:body?'POST':'GET'},authorizer:{jwt:{claims:{token_use:'id',sub:'grandma-account','cognito:groups':groups}}}},queryStringParameters:{scope},...(body?{body:JSON.stringify(body)}:{})};}

test('new layout returns one-based folders as zero-based UI months and private derivative URLs',async()=>{
 const h=backend();const result=await h.handler(event(['grandma','viewers'],{scope:'mine'}));assert.equal(result.statusCode,200);
 const body=JSON.parse(result.body);assert.equal(body.photos.length,1);const photo=body.photos[0];assert.equal(photo.key,ownKey);assert.equal(photo.month,1);assert.equal(photo.isMine,true);assert.equal(photo.audience,'grandma');assert.ok(photo.thumbnailUrl);assert.match(photo.url,/\.display\.jpg/);
});

test('ordinary viewer/admin requests never list grandma, review or legacy prefixes even if contributor index contains them',async()=>{
 for(const groups of [['viewers'],['admin'],['admin','test']]){
  const h=backend();const result=await h.handler(event(groups));assert.equal(result.statusCode,200);const body=JSON.parse(result.body);
  assert.ok(body.photos.every(photo=>photo.key===sharedKey));assert.ok(!JSON.stringify(body).includes(ownKey));
  for(const request of h.requests){const prefix=request.input.Prefix;if(prefix)assert.doesNotMatch(prefix,/grandma|needs-review|months/);}
 }
});

test('grandma combined authorized manifest retains family photos and covers',async()=>{
 const body=JSON.parse((await backend().handler(event(['grandma']))).body);
 assert.deepEqual(body.photos.map(p=>p.key),[sharedKey,ownKey]);assert.equal(body.heroPhotos[0].month,0);assert.equal(body.heroPhotos.length,1);
});

test('new upload hides owner hashes in contributor manifests and preserves concurrent attribution updates',async()=>{
 const h=backend({races:1});const response=await h.handler(event(['grandma'],{body:{filename:'IMG_1234.heic',capturedAt:'2001-01-12',month:1,owner:'someone-else',audience:'family'}}));
 assert.equal(response.statusCode,200);const body=JSON.parse(response.body);
 assert.match(body.key,/^albums\/grandma\/month-02\/2001-01-12T00-00-00_[a-f0-9]{20}\.heic$/);assert.ok(!body.key.includes(owner));
 assert.ok(h.stored.photos.some(p=>p.key===body.key));assert.ok(h.stored.photos.some(p=>p.key.includes('concurrent')));
 assert.ok(h.requests.filter(r=>r.input.Body).every(r=>r.input.Key===`manifests/contributors/${owner}.json`));
 assert.equal(body.headers['If-None-Match'],'*');
});

test('corrupt contributor index fails closed instead of claiming uploads or ownership were saved',async()=>{
 const h=backend({malformed:true});const response=await h.handler(event(['grandma'],{body:{filename:'IMG_1234.jpg',capturedAt:'2001-01-12',month:1}}));assert.equal(response.statusCode,500);
});

test('readable preview layout keeps replacement versions distinct',()=>{
 const h=backend();assert.equal(h.thumbnailKey({key:ownKey,etag:'etag'},'months'),preview(ownKey));assert.notEqual(h.thumbnailKey({key:ownKey,etag:'new'},'months'),preview(ownKey));
});


function manageEvent(groups,body){return {...event(groups,{body}),rawPath:'/api/gallery/manage'};}
test('family-only scope is identical to regular viewer media and disables grandma upload and board controls',async()=>{
 const h=backend();const body=JSON.parse((await h.handler(event(['grandma','viewers'],{scope:'family-only'}))).body);
 assert.deepEqual(body.photos.map(p=>p.key),[sharedKey]);assert.equal(body.heroPhotos.length,1);assert.equal(body.user.canUpload,false);assert.equal(body.user.canManage,false);assert.equal(body.board,null);
 assert.ok(!h.requests.some(r=>r.input.Prefix?.includes('grandma')));
});

test('grandma can save a private board order; stale or other-owner keys cannot overwrite it',async()=>{
 const h=backend();const saved=await h.handler(manageEvent(['grandma'],{action:'order',keys:[ownKey],version:'"1"'}));assert.equal(saved.statusCode,200);assert.deepEqual(h.stored.boardOrder,[ownKey]);
 const stale=await h.handler(manageEvent(['grandma'],{action:'order',keys:[],version:'"1"'}));assert.equal(stale.statusCode,409);
 const foreign=await h.handler(manageEvent(['grandma'],{action:'order',keys:[sharedKey],version:'"2"'}));assert.equal(foreign.statusCode,400);
});

test('delete removes only owned grandma media and derived views, with CDN revocation and recoverable versions',async()=>{
 const h=backend({existingSource:true});const result=await h.handler(manageEvent(['grandma'],{action:'delete',key:ownKey}));assert.equal(result.statusCode,200);
 const deletion=h.requests.find(r=>r.input.Delete).input.Delete.Objects;assert.deepEqual(Array.from(deletion,x=>x.Key),[ownKey,preview(ownKey),preview(ownKey).replace('.jpg','.display.jpg')]);assert.ok(deletion.every(x=>!x.VersionId));
 const invalidation=h.requests.find(r=>r.input.InvalidationBatch).input;assert.equal(invalidation.DistributionId,'test-distribution');assert.equal(invalidation.InvalidationBatch.Paths.Quantity,2);
});

test('viewer/admin/test claims and foreign or family keys cannot delete photos',async()=>{
 for(const groups of [['viewers'],['admin'],['grandma','test']]){const h=backend();assert.equal((await h.handler(manageEvent(groups,{action:'delete',key:ownKey}))).statusCode,403);assert.equal(h.requests.length,0);}
 for(const key of [sharedKey,'albums/grandma/month-01/foreign.jpg','needs-review/grandma/unknown.jpg']){const h=backend();assert.equal((await h.handler(manageEvent(['grandma'],{action:'delete',key}))).statusCode,403);assert.ok(!h.requests.some(r=>r.input.Delete));}
});
