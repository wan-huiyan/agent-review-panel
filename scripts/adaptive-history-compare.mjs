#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { extractFindingsFromMarkdown, extractHistoricalState, inferPersona } from "./adaptive-history-extractor.mjs";
import { decideAdaptiveShadow } from "./adaptive-orchestrator.mjs";
import { compareArchive, parseJudgeFindings } from "./adaptive-history-scorer.mjs";

function dirs(root){return readdirSync(root).map(name=>({name,path:join(root,name)})).filter(x=>statSync(x.path).isDirectory()&&existsSync(join(x.path,"state")));}
function phase(state, regex, label){
 const rows=[];
 for(const name of readdirSync(state).filter(n=>regex.test(n)).sort()){
   const text=readFileSync(join(state,name),"utf8");
   for(const f of extractFindingsFromMarkdown(text,inferPersona(name),name)) rows.push({...f,phase:label});
 }
 return rows;
}
const root=resolve(process.argv[2]??"docs/reviews");
const rows=[];
for(const run of dirs(root)){
 try{
   const state=join(run.path,"state");
   const input=extractHistoricalState(state);
   if(!input.provenance.source_files.length) continue;
   const shadow=decideAdaptiveShadow(input);
   const r1=phase(state,/_phase_5_round1\.md$/,"round1");
   const r2=phase(state,/_phase_5_round2\.md$/,"round2");
   const judgePath=join(state,"phase_14_judge_ruling.md");
   const judge=existsSync(judgePath)?parseJudgeFindings(readFileSync(judgePath,"utf8")):[];
   rows.push({run:run.name,provenance:input.provenance,comparison:compareArchive({round1Findings:r1,round2Findings:r2,judgeFindings:judge,shadow})});
 }catch(error){rows.push({run:run.name,status:"unavailable",error_type:error?.constructor?.name??"Error"});}
}
process.stdout.write(JSON.stringify({historical_comparison:true,run_count:rows.length,rows},null,2)+"\n");
