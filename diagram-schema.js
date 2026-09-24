export const diagramSchema = {
  type:'object',additionalProperties:false,required:['nodes','edges'],properties:{
    nodes:{type:'array',minItems:1,maxItems:20,items:{type:'object',additionalProperties:false,required:['id','title','appearance'],properties:{id:{type:'string'},title:{type:'string'},appearance:{type:'string',enum:['box','text']}}}},
    edges:{type:'array',maxItems:40,items:{type:'object',additionalProperties:false,required:['from','to','label'],properties:{from:{type:'string'},to:{type:'string'},label:{type:'string'}}}}
  }
};
export function validateDiagram(value) {
  const object=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(v,k));
  if(!object(value,['nodes','edges'])||!Array.isArray(value.nodes)||value.nodes.length<1||value.nodes.length>20||!Array.isArray(value.edges)||value.edges.length>40)throw Error('结构必须包含 1–20 个节点和最多 40 条关系');
  const ids=new Set();
  for(const node of value.nodes){
    if(!object(node,['id','title','appearance'])||typeof node.id!=='string'||!/^\w[\w-]{0,49}$/.test(node.id)||ids.has(node.id)||typeof node.title!=='string'||!node.title.trim()||node.title.length>120||!['box','text'].includes(node.appearance))throw Error('节点格式无效、标题过长或 ID 重复');
    ids.add(node.id);
  }
  for(const edge of value.edges)if(!object(edge,['from','to','label'])||!ids.has(edge.from)||!ids.has(edge.to)||edge.from===edge.to||typeof edge.label!=='string'||edge.label.length>60)throw Error('关系必须引用本次结构中两个不同节点，标签最多 60 字');
  return value;
}
