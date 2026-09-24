import {validateDiagram} from './diagram-schema.js';
export function parseModelDiagram(content){
  if(typeof content!=='string')throw Error('模型未返回文本 JSON');
  let text=content.trim();
  // Some compatible providers place a separate reasoning block before the JSON.
  if(text.startsWith('<think>')){const end=text.indexOf('</think>');if(end<0)throw Error('模型推理段未结束，请重试');text=text.slice(end+8).trim();}
  const fenced=text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);if(fenced)text=fenced[1];
  let value;try{value=JSON.parse(text);}catch{throw Error('模型没有返回完整的结构化 JSON，请重试');}
  return validateDiagram(value);
}
