export function parseVoiceCommand(transcript, selectedIds=[]) {
  const value=transcript.trim().replace(/[。！!？?]+$/u,'').trim();
  if(!value) throw Error('请先录音或输入口令');
  if(/^(撤销|撤销上一步|撤销刚才那步)$/.test(value)) return {op:'undo'};
  if(/^(重做|恢复上一步)$/.test(value)) return {op:'redo'};
  const add=value.match(/^(?:加一条|添加(?:一条)?|新增(?:一条)?)\s*[，,:：]?\s*(.+)$/s);
  if(add) return {op:'add',text:add[1]};
  const rename=value.match(/^(?:改成|改名为|改为)\s*[，,:：]?\s*(.+)$/s);
  if(rename) { if(selectedIds.length!==1) throw Error('请先在画布中选中一条文字'); return {op:'rename',id:selectedIds[0],text:rename[1]}; }
  if(/^(删除这个|删掉这个)$/.test(value)) {if(selectedIds.length!==1)throw Error('请先选中一个元素');return {op:'delete',id:selectedIds[0]};}
  if(/^(连起来|连接这两个)$/.test(value)) {if(selectedIds.length!==2)throw Error('请先选中两个元素');return {op:'connect',id:selectedIds[0],to:selectedIds[1]};}
  throw Error('暂未识别口令。支持：加一条…、改成…、删除这个、连起来、撤销、重做。普通讲话不会执行。');
}
