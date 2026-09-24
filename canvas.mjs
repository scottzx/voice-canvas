#!/usr/bin/env node
const [op, ...args] = process.argv.slice(2);
if (!op || op === '--help' || op === 'help') {
  console.log(`canvas list | state
canvas add "文字" [--x 100 --y 100]
canvas rename ID "新文字"
canvas move ID --x 400 --y 200
canvas connect FROM_ID TO_ID
canvas select ID
canvas delete ID
canvas undo | redo
canvas json '{"op":"add","text":"内容"}'
Use node canvas.mjs, or ./canvas after setup. All responses are JSON.
Requires one open canvas at http://127.0.0.1:5178/.`);
  process.exit(0);
}
try {
  let command = { op };
  const positional = [];
  for (let i=0;i<args.length;i++) {
    if (args[i].startsWith('--')) {
      const name = args[i].slice(2);
      if (!['x','y'].includes(name) || args[i+1] === undefined || !Number.isFinite(Number(args[i+1]))) throw Error('Expected --x NUMBER or --y NUMBER');
      command[name] = Number(args[++i]);
    } else positional.push(args[i]);
  }
  if (op === 'json') command = JSON.parse(positional[0]);
  else if (op === 'add') command.text = positional.join(' ');
  else { command.id = positional[0]; if (op === 'rename') command.text = positional.slice(1).join(' '); if (op === 'connect') command.to = positional[1]; }
  const response = await fetch('http://127.0.0.1:5178/api/canvas', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(command), signal:AbortSignal.timeout(12000) });
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok) process.exitCode = 1;
} catch (error) { console.error(JSON.stringify({error:error.message})); process.exitCode=1; }
