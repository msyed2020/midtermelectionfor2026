// Registry for per-race issue guides. Each file in data/guides/ calls G(id, sourceUrl, data).
// Positions are paraphrased from guides.vote voter guides (nonpartisan, fiscally sponsored
// by Youth Service America). Labels ("Ban", "Tighten", ...) are guides.vote's own.
window.GUIDES = {};
function G(id, src, data) {
  window.GUIDES[id] = { src: src, candidates: data.candidates, issues: data.issues };
}
