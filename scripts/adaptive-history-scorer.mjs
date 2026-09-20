// Conservative historical comparison scorer for adaptive-v4 shadow evaluation.
// It measures observable archive properties; it does not claim the counterfactual
// adaptive run would have discovered the same findings.

function norm(s) {
  return String(s ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(w => w.length > 2);
}
function jaccard(a,b) {
  const A=new Set(norm(a)), B=new Set(norm(b));
  if (!A.size || !B.size) return 0;
  let n=0; for(const x of A) if(B.has(x)) n++;
  return n / (A.size+B.size-n);
}
export function parseJudgeFindings(text) {
  const out=[];
  const lines=text.split("\n");
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const m=line.match(/^#{2,5}\s+(.+)$/);
    if(!m || !/(upheld|demoted|finding|ruling|p[0-3])/i.test(m[1])) continue;
    const chunk=[line];
    for(let j=i+1;j<Math.min(lines.length,i+40) && !/^#{2,5}\s+/.test(lines[j]);j++) chunk.push(lines[j]);
    const sev=(chunk.join("\n").match(/\bP[0-3]\b/i)?.[0] ?? "P2").toUpperCase();
    out.push({title:m[1].slice(0,240),severity:sev,text:chunk.join("\n").slice(0,3000)});
  }
  return out;
}
export function compareArchive({round1Findings=[],round2Findings=[],judgeFindings=[],shadow}) {
  const matchedJudge=judgeFindings.map(j=>{
    const candidates=[...round1Findings,...round2Findings].map(f=>({phase:f.phase,title:f.title,score:jaccard(j.title+" "+j.text,f.title)})).sort((a,b)=>b.score-a.score);
    return {...j,best_match:candidates[0] ?? null};
  });
  const firstSeen={round1:0,round2:0,unmatched:0};
  for(const j of matchedJudge){
    if(!j.best_match || j.best_match.score < .12) firstSeen.unmatched++;
    else firstSeen[j.best_match.phase]++;
  }
  const round2Novel=round2Findings.filter(f=>!round1Findings.some(r=>jaccard(r.title,f.title)>=.35));
  const changed=round2Findings.filter(f=>round1Findings.some(r=>jaccard(r.title,f.title)>=.35 && r.severity!==f.severity));
  let evidenceStrength="weak";
  if(round1Findings.length && judgeFindings.length) evidenceStrength="moderate";
  if(round1Findings.length && round2Findings.length && judgeFindings.length) evidenceStrength="stronger";
  return {
    archive_observation_only:true,
    counterfactual_claim:false,
    evidence_strength:evidenceStrength,
    historical:{round1_findings:round1Findings.length,round2_findings:round2Findings.length,judge_findings:judgeFindings.length,
      judge_best_match_first_seen:firstSeen,round2_novel_candidate_count:round2Novel.length,round2_severity_change_candidate_count:changed.length},
    shadow:{debate_decision:shadow?.debate_decision ?? null,judge_needed:shadow?.judge_needed ?? null,full_escalation:shadow?.full_escalation ?? null},
    interpretation:firstSeen.round2>0 || round2Novel.length>0
      ? "Later debate contains candidate information not obviously present in round 1; do not treat it as redundant."
      : "No judge-carried finding was clearly first-seen in round 2 by this lexical check. This supports a replay candidate, not a proof that round 2 was unnecessary.",
    limitations:[
      "Lexical matching is heuristic and can miss paraphrases or falsely merge related findings.",
      "Historical reviewers saw different context than a future adaptive panel would see.",
      "A finding absent from the archive cannot be treated as evidence that adaptive would not discover it."
    ]
  };
}
