import sharp from 'sharp';
const [source, implementation, output] = process.argv.slice(2);
if (!source || !implementation || !output) throw new Error('source implementation output required');
const left=await sharp(source).resize(1488,1058,{fit:'fill'}).png().toBuffer();
const right=await sharp(implementation).resize(1488,1058,{fit:'fill'}).png().toBuffer();
await sharp({create:{width:2976,height:1058,channels:3,background:'#ffffff'}}).composite([{input:left,left:0,top:0},{input:right,left:1488,top:0}]).png().toFile(output);
const focusLeft=await sharp(left).extract({left:274,top:350,width:1170,height:560}).png().toBuffer();
const focusRight=await sharp(right).extract({left:274,top:350,width:1170,height:560}).png().toBuffer();
await sharp({create:{width:2340,height:560,channels:3,background:'#ffffff'}}).composite([{input:focusLeft,left:0,top:0},{input:focusRight,left:1170,top:0}]).png().toFile(output.replace('.png','-focus.png'));
