import {validateDiagram} from './diagram-schema.js';
export function diagramSkeleton(diagram,batchId,sourceText,elements){
  validateDiagram(diagram);
  if(typeof batchId!=='string'||!/^[\w-]{1,80}$/.test(batchId)||typeof sourceText!=='string'||sourceText.length>1500)throw Error('Invalid diagram batch');
  const wrap=text=>text.match(/.{1,12}/gu)?.join('\n')||text;
  const top=Math.max(40,...elements.map(e=>e.y+e.height+100));
  const rows=[];let y=top;
  for(let i=0;i<diagram.nodes.length;i+=3){rows.push(y);y+=Math.max(...diagram.nodes.slice(i,i+3).map(n=>Math.ceil(n.title.length/12)*28+60))+110;}
  const nodes=diagram.nodes.map((node,i)=>({id:`${batchId}-node-${node.id}`,type:node.appearance==='box'?'rectangle':'text',x:60+i%3*370,y:rows[Math.floor(i/3)],width:280,height:Math.ceil(node.title.length/12)*28+60,...(node.appearance==='box'?{label:{text:wrap(node.title),fontSize:20},roundness:{type:3}}:{text:wrap(node.title),fontSize:20}),customData:{batchId,sourceText}}));
  const edges=diagram.edges.map((edge,i)=>{const a=nodes.find(n=>n.id===`${batchId}-node-${edge.from}`),b=nodes.find(n=>n.id===`${batchId}-node-${edge.to}`);return {id:`${batchId}-edge-${i}`,type:'arrow',x:a.x+a.width,y:a.y+a.height/2,points:[[0,0],[b.x-a.x-a.width,b.y+b.height/2-a.y-a.height/2]],start:{id:a.id},end:{id:b.id},...(edge.label?{label:{text:wrap(edge.label),fontSize:16}}:{}),customData:{batchId,sourceText}};});
  return [...nodes,...edges];
}
