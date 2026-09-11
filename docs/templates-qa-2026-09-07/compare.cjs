/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node QA utility */
const sharp = require('sharp');
const path = require('path');
(async()=>{
 const files=['selected.png','04-implemented.png'];
 const buffers=await Promise.all(files.map(f=>sharp(path.join(__dirname,f)).resize(1488,1058,{fit:'fill'}).toBuffer()));
 await sharp({create:{width:2976,height:1058,channels:3,background:'#ffffff'}}).composite(buffers.map((input,i)=>({input,left:i*1488,top:0}))).png().toFile(path.join(__dirname,'07-comparison.png'));
})();
