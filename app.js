(function () {
  "use strict";

  // ---------- Reference data ----------
  const STATES = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
    DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
    KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
    MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
    NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
    OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
    TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming"
  };
  const OFFICE_LABEL = { senate: "U.S. Senate", governor: "Governor", house: "U.S. House" };
  const PARTY_NAME = { D: "Democrat", R: "Republican", I: "Independent", L: "Libertarian", G: "Green" };

  // Display order and the question each guide label answers.
  const ISSUES = [
    ["Economy", "Increase or cut government spending and investment?"],
    ["Taxes", "Raise or lower taxes (especially on corporations and the wealthy)?"],
    ["Tariffs", "Support or oppose the current tariffs?"],
    ["Minimum Wage", "Raise the federal minimum wage?"],
    ["Health Care", "Increase or decrease government's role in health coverage?"],
    ["Abortion", "Should abortion be legal or banned?"],
    ["Immigration", "Approach to border security, deportation and legal status."],
    ["Climate Change", "Make addressing climate change a priority?"],
    ["Environment", "Tighten or loosen environmental regulation?"],
    ["Data Centers", "Tighten or loosen rules on data centers?"],
    ["Gun Laws", "Tighten or loosen gun laws?"],
    ["Criminal Justice", "Approach to policing and criminal justice."],
    ["Education", "Use public funds for private or for-profit schools?"],
    ["Curriculum Limits", "Limit teaching about racism and gender identity?"],
    ["Housing", "Approach to housing costs."],
    ["Labor", "Make it easier or harder for unions to organize?"],
    ["LGBTQ Rights", "Expand or limit LGBTQ rights?"],
    ["Marijuana", "Legalize marijuana?"],
    ["Voting Rules", "Make voting easier or harder?"],
    ["Iran", "Support the U.S. military action against Iran?"]
  ];
  const ISSUE_Q = Object.fromEntries(ISSUES);
  const ISSUE_ORDER = ISSUES.map(i => i[0]);

  // ---------- Helpers ----------
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function partyKey(p) {
    if (p === "D" || p === "DFL" || /^democrat/i.test(p)) return "D";
    if (p === "R" || /^republican/i.test(p)) return "R";
    if (p === "I" || /^independent/i.test(p)) return "I";
    if (p === "L" || /^libertarian/i.test(p)) return "L";
    if (p === "G" || /green/i.test(p)) return "G";
    return "O";
  }
  const partyName = p => PARTY_NAME[p] || p;

  function cleanLabel(l) {
    l = String(l || "").trim().replace(/\.$/, "");
    if (/no (recent )?position|not captured/i.test(l)) return "";
    return l;
  }
  function isNoPosition(pos) {
    return !pos || /^(no (recent )?position found|not captured)/i.test(pos.detail || "") && !cleanLabel(pos.label);
  }

  function ratingClass(r) {
    if (!r) return "";
    if (/toss/i.test(r)) return "toss";
    const side = /\bD\b/.test(r) ? "D" : /\bR\b/.test(r) ? "R" : "";
    if (/lean/i.test(r)) return "lean" + side;
    if (/likely/i.test(r)) return "likely" + side;
    return "safe" + side;
  }
  const isCompetitive = race => race.rating && /toss|lean/i.test((race.rating.cook || "") + " " + (race.rating.sabato || ""));

  function raceTitle(r) {
    const st = STATES[r.state];
    if (r.office === "house") return `${st} ${r.district === 0 ? "At-large" : "District " + r.district}`;
    return `${st}${r.special ? " (special)" : ""}`;
  }
  function raceShort(r) {
    if (r.office === "house") return `${r.state}-${String(r.district).padStart(2, "0")}`;
    return `${r.state} ${r.office === "senate" ? "Sen" : "Gov"}${r.special ? "*" : ""}`;
  }
  function ballotpediaUrl(r) {
    const st = STATES[r.state].replace(/ /g, "_");
    if (r.office === "senate") return `https://ballotpedia.org/United_States_Senate_${r.special ? "special_" : ""}election_in_${st},_2026`;
    if (r.office === "governor") return `https://ballotpedia.org/${st}_gubernatorial_election,_2026`;
    const n = r.district, sfx = (n % 100 >= 11 && n % 100 <= 13) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
    return `https://ballotpedia.org/${st}%27s_${n}${sfx}_Congressional_District_election,_2026`;
  }

  // ---------- Build model ----------
  // Each race gets .candidates [{id,name,party,partyKey,inc,positions|null}] and .guide.
  const RACES = window.RACES.map(r => {
    const guide = window.GUIDES[r.id] || null;
    const candidates = r.cands.map(([name, party, flags]) => {
      const pk = partyKey(party);
      let positions = null;
      if (guide) {
        positions = {};
        guide.issues.forEach(iss => {
          const p = iss.positions[name];
          if (p) positions[iss.issue] = { label: cleanLabel(p.label), detail: p.detail };
        });
        if (!Object.keys(positions).length) positions = null;
      }
      return { id: r.id + "|" + name, name, party, partyKey: pk, inc: (flags || "").includes("i"), positions, race: null };
    });
    const race = Object.assign({}, r, { guide, candidates });
    candidates.forEach(c => (c.race = race));
    return race;
  });
  // Warn in console if a guide candidate doesn't match the roster (helps when editing data).
  RACES.forEach(r => {
    if (!r.guide) return;
    r.guide.candidates.forEach(gc => {
      if (!r.candidates.some(c => c.name === gc.name)) console.warn("Guide candidate not in roster:", r.id, gc.name);
    });
  });
  const RACE_BY_ID = Object.fromEntries(RACES.map(r => [r.id, r]));
  const ALL_CANDS = RACES.flatMap(r => r.candidates);
  const CAND_BY_ID = Object.fromEntries(ALL_CANDS.map(c => [c.id, c]));
  const DATA_CANDS = ALL_CANDS.filter(c => c.positions);
  const issuesFor = race => {
    if (!race.guide) return [];
    const present = new Set(race.guide.issues.map(i => i.issue));
    return ISSUE_ORDER.filter(i => present.has(i)).concat([...present].filter(i => !ISSUE_ORDER.includes(i)));
  };
  const OFFICE_RANK = { senate: 0, governor: 1, house: 2 };
  RACES.sort((a, b) => OFFICE_RANK[a.office] - OFFICE_RANK[b.office] || STATES[a.state].localeCompare(STATES[b.state]) || (a.district || 0) - (b.district || 0) || (a.special ? 1 : 0) - (b.special ? 1 : 0));

  // ---------- State ----------
  const state = {
    view: "races",
    office: "all",
    stateFilter: "",
    q: "",
    competitive: false,
    onlyData: false,
    raceId: null,
    hiddenIssues: new Set(),
    diffOnly: false,
    issue: "Abortion",
    ioffice: "all",
    tray: []
  };
  try {
    const saved = JSON.parse(localStorage.getItem("mid26-tray") || "[]");
    state.tray = saved.filter(id => CAND_BY_ID[id] && CAND_BY_ID[id].positions).slice(0, 4);
  } catch (e) { /* storage unavailable */ }
  const saveTray = () => { try { localStorage.setItem("mid26-tray", JSON.stringify(state.tray)); } catch (e) { /* ignore */ } };

  // ---------- Header ----------
  (function subtitle() {
    const election = new Date(2026, 10, 3);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((election - today) / 86400000);
    let tail = "";
    if (days > 1) tail = ` · ${days} days away`;
    else if (days === 1) tail = " · tomorrow";
    else if (days === 0) tail = " · today";
    $("#subtitle").textContent = `General election · Tuesday, November 3, 2026${tail}`;
  })();

  // ---------- Views / routing ----------
  function setView(v, push = true) {
    state.view = v;
    $$(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.view === v)));
    $$(".view").forEach(s => (s.hidden = s.id !== "view-" + v));
    if (v === "issues") renderIssues();
    if (v === "compare") renderCompare();
    if (v === "about") renderAbout();
    if (push) writeHash();
  }
  function writeHash() {
    let h = "";
    if (state.view === "races" && state.raceId) h = "race=" + state.raceId;
    else if (state.view === "issues") h = "issue=" + encodeURIComponent(state.issue);
    else if (state.view === "compare") h = "compare";
    else if (state.view === "about") h = "about";
    history.replaceState(null, "", h ? "#" + h : location.pathname + location.search);
  }
  function readHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith("race=") && RACE_BY_ID[h.slice(5)]) { state.raceId = h.slice(5); return "races"; }
    if (h.startsWith("issue=")) { state.issue = h.slice(6); return "issues"; }
    if (h === "compare" || h === "about") return h;
    return "races";
  }
  $$(".tabs button").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));

  // ---------- Races: sidebar ----------
  const stateSel = $("#stateSel");
  [...new Set(RACES.map(r => r.state))].sort((a, b) => STATES[a].localeCompare(STATES[b]))
    .forEach(s => stateSel.insertAdjacentHTML("beforeend", `<option value="${s}">${esc(STATES[s])}</option>`));

  function filteredRaces() {
    const q = norm(state.q.trim());
    return RACES.filter(r => {
      if (state.office !== "all" && r.office !== state.office) return false;
      if (state.stateFilter && r.state !== state.stateFilter) return false;
      if (state.competitive && !isCompetitive(r)) return false;
      if (state.onlyData && !r.guide) return false;
      if (q) {
        const hay = norm([STATES[r.state], r.state, raceShort(r), OFFICE_LABEL[r.office], ...r.candidates.map(c => c.name)].join(" "));
        if (!q.split(/\s+/).every(t => hay.includes(t))) return false;
      }
      return true;
    });
  }

  function renderList() {
    const list = filteredRaces();
    $("#raceCount").textContent = `${list.length} race${list.length === 1 ? "" : "s"} · ${list.filter(r => r.guide).length} with stance data`;
    $("#raceList").innerHTML = list.map(r => {
      const rating = r.rating ? r.rating.cook : "";
      const majors = r.candidates.filter(c => ["D", "R"].includes(c.partyKey) || c.positions).slice(0, 4);
      return `<li><button data-race="${r.id}" aria-current="${r.id === state.raceId}">
        <span class="race-title"><span>${esc(raceTitle(r))} <span class="muted" style="font-weight:400">· ${esc(OFFICE_LABEL[r.office])}</span></span>
          ${rating ? `<span class="pill ${ratingClass(rating)}">${esc(rating)}</span>` : ""}</span>
        <span class="race-cands">${majors.map(c => `<span><i class="dot p-${c.partyKey}"></i>${esc(c.name)}${c.inc ? "*" : ""}</span>`).join("")}</span>
        ${r.guide ? `<span class="badge-data">Stance comparison</span>` : ""}
      </button></li>`;
    }).join("") || `<li class="empty">No races match these filters.</li>`;
    $$("#raceList button[data-race]").forEach(b => b.addEventListener("click", () => selectRace(b.dataset.race)));
  }

  function selectRace(id, scroll = true) {
    state.raceId = id;
    state.hiddenIssues.clear();
    $$("#raceList button[data-race]").forEach(b => b.setAttribute("aria-current", String(b.dataset.race === id)));
    renderDetail();
    writeHash();
    if (scroll && window.matchMedia("(max-width: 860px)").matches) $("#raceDetail").scrollIntoView({ behavior: "smooth" });
  }

  $("#q").addEventListener("input", e => { state.q = e.target.value; renderList(); });
  stateSel.addEventListener("change", e => { state.stateFilter = e.target.value; renderList(); });
  $("#fCompetitive").addEventListener("change", e => { state.competitive = e.target.checked; renderList(); });
  $("#fData").addEventListener("change", e => { state.onlyData = e.target.checked; renderList(); });
  $$("[data-office]").forEach(b => b.addEventListener("click", () => {
    state.office = b.dataset.office;
    $$("[data-office]").forEach(x => x.classList.toggle("on", x === b));
    renderList();
  }));

  // ---------- Races: detail ----------
  function candHead(c, opts = {}) {
    const inTray = state.tray.includes(c.id);
    return `<div class="cand-head p-${c.partyKey}">
      <span class="cand-name">${esc(c.name)}</span>
      <span class="cand-sub"><i class="dot p-${c.partyKey}"></i>${esc(partyName(c.party))}${c.inc ? ` <span class="inc">Incumbent</span>` : ""}</span>
      ${opts.raceLabel ? `<span class="cand-sub"><button class="race-link" data-goto="${c.race.id}">${esc(raceTitle(c.race))} · ${esc(OFFICE_LABEL[c.race.office])}</button></span>` : ""}
      ${opts.remove ? `<span><button class="rm" data-rm="${esc(c.id)}">Remove</button></span>`
        : c.positions ? `<span><button class="btn small ${inTray ? "ghost" : ""}" data-tray="${esc(c.id)}">${inTray ? "✓ In compare" : "+ Compare"}</button></span>` : ""}
    </div>`;
  }
  function stanceCell(pos) {
    if (!pos || isNoPosition(pos)) return `<span class="none">No position found</span>`;
    return `${pos.label ? `<span class="label">${esc(pos.label)}</span><br>` : ""}<span class="stance">${esc(pos.detail)}</span>`;
  }
  function labelsDiffer(cands, issue) {
    const labels = cands.map(c => (c.positions[issue] && c.positions[issue].label) || "").filter(Boolean);
    return labels.length >= 2 && new Set(labels.map(l => l.toLowerCase())).size > 1;
  }

  // opts: { hidden: Set of issues to skip, diffOnly: bool, head: options for candHead }
  function comparisonTable(cands, issues, opts = {}) {
    const hidden = opts.hidden || new Set();
    const rows = issues.filter(i => !hidden.has(i)).map(issue => {
      if (opts.diffOnly && !labelsDiffer(cands, issue)) return "";
      return `<tr>
        <th scope="row">${esc(issue)}${ISSUE_Q[issue] ? `<span class="q">${esc(ISSUE_Q[issue])}</span>` : ""}</th>
        ${cands.map(c => `<td>${stanceCell(c.positions[issue])}</td>`).join("")}
      </tr>`;
    }).join("");
    return `<div class="table-scroll"><table class="cmp${cands.length <= 2 ? " fit" : ""}" style="--n:${cands.length};min-width:${170 + cands.length * 220}px">
      <thead><tr><th class="issue-col" scope="col"><span class="muted">Issue</span></th>${cands.map(c => `<th scope="col">${candHead(c, opts.head || {})}</th>`).join("")}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${cands.length + 1}" class="empty">No issues to show with the current filters.</td></tr>`}</tbody>
    </table></div>`;
  }

  function renderDetail() {
    const el = $("#raceDetail");
    const r = RACE_BY_ID[state.raceId];
    if (!r) {
      el.innerHTML = `<div class="card empty">Select a race to compare the candidates side by side.</div>`;
      return;
    }
    const ratings = r.rating ? [r.rating.cook && `Cook: <strong>${esc(r.rating.cook)}</strong>`, r.rating.sabato && `Sabato: <strong>${esc(r.rating.sabato)}</strong>`].filter(Boolean).join(" · ") : "";
    const head = `<div class="race-head">
      <h2>${esc(raceTitle(r))} — ${esc(OFFICE_LABEL[r.office])}${r.special ? " special election" : ""}</h2>
      <div class="meta">
        ${r.incumbent ? `<span>Incumbent: <strong>${esc(r.incumbent)}</strong></span>` : ""}
        ${r.open ? `<span><strong>Open seat</strong></span>` : ""}
        ${ratings ? `<span>${ratings}</span>` : ""}
      </div>
      ${r.note ? `<div class="note">${esc(r.note)}</div>` : ""}
    </div>`;

    if (!r.guide) {
      el.innerHTML = `<div class="card">${head}
        <div class="nodata">
          <div class="cand-cards">${r.candidates.map(c => `<div class="cand-card p-${c.partyKey}">
            <div class="cand-name">${esc(c.name)}</div>
            <div class="cand-sub">${esc(partyName(c.party))}${c.inc ? ` <span class="inc">Incumbent</span>` : ""}</div></div>`).join("")}</div>
          <p class="muted">No issue-by-issue guide is available for this race yet. See <a href="${ballotpediaUrl(r)}" target="_blank" rel="noopener">Ballotpedia's race page</a> for candidate websites and survey responses.</p>
        </div></div>`;
      return;
    }

    const withData = r.candidates.filter(c => c.positions);
    const without = r.candidates.filter(c => !c.positions);
    const issues = issuesFor(r);
    const diffCount = issues.filter(i => labelsDiffer(withData, i)).length;
    el.innerHTML = `<div class="card">${head}
      <div class="toolbar">
        <div class="issue-chips" aria-label="Show or hide issues">${issues.map(i => `<button data-issue-toggle="${esc(i)}" class="${state.hiddenIssues.has(i) ? "" : "on"}" aria-pressed="${!state.hiddenIssues.has(i)}">${esc(i)}</button>`).join("")}</div>
        <label class="check"><input type="checkbox" id="diffOnly" ${state.diffOnly ? "checked" : ""}> Only issues where labels differ (${diffCount})</label>
      </div>
      ${comparisonTable(withData, issues, { hidden: state.hiddenIssues, diffOnly: state.diffOnly })}
      ${without.length ? `<div class="others">Also on the ballot (no stance data in source guide):
        <ul>${without.map(c => `<li><i class="dot p-${c.partyKey}"></i>${esc(c.name)} (${esc(partyName(c.party))})${c.inc ? " · incumbent" : ""}</li>`).join("")}</ul></div>` : ""}
      <div class="src">Stances paraphrased from <a href="${esc(r.guide.src)}" target="_blank" rel="noopener">the guides.vote voter guide for this race</a>, which cites each claim. Labels are the guide's. · <a href="${ballotpediaUrl(r)}" target="_blank" rel="noopener">Ballotpedia</a></div>
    </div>`;

    $$("[data-issue-toggle]").forEach(b => b.addEventListener("click", () => {
      const i = b.dataset.issueToggle;
      state.hiddenIssues.has(i) ? state.hiddenIssues.delete(i) : state.hiddenIssues.add(i);
      renderDetail();
    }));
    $("#diffOnly").addEventListener("change", e => { state.diffOnly = e.target.checked; renderDetail(); });
    bindTrayButtons(el);
  }

  // ---------- Compare tray ----------
  function updateTrayCount() {
    const n = state.tray.length, el = $("#trayCount");
    el.hidden = n === 0;
    el.textContent = n;
  }
  function toggleTray(id) {
    const i = state.tray.indexOf(id);
    if (i >= 0) state.tray.splice(i, 1);
    else {
      if (state.tray.length >= 4) { alert("You can compare up to 4 candidates. Remove one first."); return; }
      state.tray.push(id);
    }
    saveTray();
    updateTrayCount();
  }
  function bindTrayButtons(root) {
    root.querySelectorAll("[data-tray]").forEach(b => b.addEventListener("click", () => {
      toggleTray(b.dataset.tray);
      if (state.view === "races") renderDetail(); else renderCompare();
    }));
    root.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => { toggleTray(b.dataset.rm); renderCompare(); }));
    root.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => goToRace(b.dataset.goto)));
  }
  function goToRace(id) {
    setView("races", false);
    selectRace(id, false);
    const btn = document.querySelector(`#raceList button[data-race="${id}"]`);
    if (btn) btn.scrollIntoView({ block: "nearest" });
    window.scrollTo({ top: 0 });
  }

  const candList = $("#candList");
  const candKey = c => `${c.name} — ${raceShort(c.race)} (${c.partyKey === "O" ? c.party : c.partyKey})`;
  candList.innerHTML = DATA_CANDS.map(c => `<option value="${esc(candKey(c))}"></option>`).join("");
  function addFromPicker() {
    const v = $("#candPick").value.trim();
    if (!v) return;
    let c = DATA_CANDS.find(x => candKey(x) === v);
    if (!c) {
      const nv = norm(v);
      const matches = DATA_CANDS.filter(x => norm(x.name).includes(nv));
      if (matches.length === 1) c = matches[0];
    }
    if (!c) { alert("Pick a candidate from the suggestions list."); return; }
    if (!state.tray.includes(c.id)) toggleTray(c.id);
    $("#candPick").value = "";
    renderCompare();
  }
  $("#candAdd").addEventListener("click", addFromPicker);
  $("#candPick").addEventListener("keydown", e => { if (e.key === "Enter") addFromPicker(); });
  $("#candClear").addEventListener("click", () => { state.tray = []; saveTray(); updateTrayCount(); renderCompare(); });

  function renderCompare() {
    const out = $("#compareOut");
    const cands = state.tray.map(id => CAND_BY_ID[id]).filter(Boolean);
    if (!cands.length) {
      out.innerHTML = `<div class="card empty">No candidates selected yet. Add some above, or click “+ Compare” on a race page.</div>`;
      return;
    }
    const issueSet = new Set(cands.flatMap(c => Object.keys(c.positions)));
    const issues = ISSUE_ORDER.filter(i => issueSet.has(i)).concat([...issueSet].filter(i => !ISSUE_ORDER.includes(i)));
    out.innerHTML = `<div class="card">${comparisonTable(cands, issues, { head: { raceLabel: true, remove: true } })}
      <div class="src">Positions come from each race's guides.vote guide; candidates in different races were assessed on the same issue questions, but evidence differs by office.</div></div>`;
    bindTrayButtons(out);
  }

  // ---------- By issue ----------
  const allIssues = ISSUE_ORDER.filter(i => DATA_CANDS.some(c => c.positions[i]));
  $("#issueSel").innerHTML = allIssues.map(i => {
    const n = DATA_CANDS.filter(c => c.positions[i]).length;
    return `<option value="${esc(i)}">${esc(i)} (${n})</option>`;
  }).join("");
  $("#issueSel").addEventListener("change", e => { state.issue = e.target.value; renderIssues(); writeHash(); });
  $$("[data-ioffice]").forEach(b => b.addEventListener("click", () => {
    state.ioffice = b.dataset.ioffice;
    $$("[data-ioffice]").forEach(x => x.classList.toggle("on", x === b));
    renderIssues();
  }));

  function renderIssues() {
    if (!allIssues.includes(state.issue)) state.issue = "Abortion";
    $("#issueSel").value = state.issue;
    const issue = state.issue;
    $("#issueQ").textContent = ISSUE_Q[issue] || "";
    const races = RACES.filter(r => r.guide && (state.ioffice === "all" || r.office === state.ioffice))
      .filter(r => r.candidates.some(c => c.positions && c.positions[issue]));

    // Label distribution per party
    const byParty = {};
    races.forEach(r => r.candidates.forEach(c => {
      if (!c.positions || !c.positions[issue]) return;
      const pos = c.positions[issue];
      const lbl = isNoPosition(pos) ? "No position found" : (pos.label || "(descriptive)");
      const pk = c.partyKey;
      (byParty[pk] = byParty[pk] || {})[lbl] = (byParty[pk][lbl] || 0) + 1;
    }));
    const descriptiveOnly = Object.values(byParty).every(m => Object.keys(m).every(k => k === "(descriptive)" || k === "No position found"));
    $("#issueSummary").innerHTML = descriptiveOnly ? "" : ["D", "R", "I"].filter(p => byParty[p]).map(p => {
      const entries = Object.entries(byParty[p]).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((s, e) => s + e[1], 0);
      return `<div class="card sum-card p-${p}"><h3><i class="dot p-${p}"></i>${esc(partyName(p))} candidates (${total})</h3>
        ${entries.map(([l, n]) => `<div class="bar-row"><span>${esc(l)}</span><span class="bar"><span style="width:${(n / total) * 100}%"></span></span><span>${n}</span></div>`).join("")}</div>`;
    }).join("");

    const cell = c => c ? `<span class="who"><i class="dot p-${c.partyKey}"></i>${esc(c.name)}${c.inc ? "*" : ""}</span>${stanceCell(c.positions[issue])}` : `<span class="none">—</span>`;
    $("#issueTable").innerHTML = `<thead><tr><th>Race</th><th>Democrat</th><th>Republican</th><th>Other</th></tr></thead>
      <tbody>${races.map(r => {
        const withPos = r.candidates.filter(c => c.positions && c.positions[issue]);
        const d = withPos.find(c => c.partyKey === "D"), rep = withPos.find(c => c.partyKey === "R");
        const others = withPos.filter(c => c !== d && c !== rep);
        return `<tr><td><button class="race-link" data-goto="${r.id}">${esc(raceTitle(r))}</button><br><span class="muted">${esc(OFFICE_LABEL[r.office])}${r.rating ? " · " + esc(r.rating.cook) : ""}</span></td>
          <td>${cell(d)}</td><td>${cell(rep)}</td><td>${others.length ? others.map(cell).join("<br><br>") : `<span class="none">—</span>`}</td></tr>`;
      }).join("")}</tbody>`;
    $$("#issueTable [data-goto]").forEach(b => b.addEventListener("click", () => goToRace(b.dataset.goto)));
  }

  // ---------- About ----------
  function renderAbout() {
    const count = o => RACES.filter(r => r.office === o).length;
    const countData = o => RACES.filter(r => r.office === o && r.guide).length;
    $("#aboutStats").innerHTML = `
      <li><strong>${count("senate")}</strong> U.S. Senate races (all seats up in 2026, including the Florida and Ohio specials). <strong>${countData("senate")}</strong> have side-by-side stance data.</li>
      <li><strong>${count("governor")}</strong> governor races (every state electing a governor in 2026). <strong>${countData("governor")}</strong> have stance data.</li>
      <li><strong>${count("house")}</strong> competitive U.S. House races, all with stance data.</li>
      <li><strong>${ALL_CANDS.length}</strong> candidates listed; <strong>${DATA_CANDS.length}</strong> with issue-by-issue positions.</li>
      <li>An asterisk (*) after a name in lists means incumbent.</li>`;
  }

  // ---------- Init ----------
  updateTrayCount();
  renderList();
  const startView = readHash();
  if (!state.raceId) {
    const first = RACES.find(r => r.id === "sen-TX") || RACES[0];
    state.raceId = first.id;
  }
  renderDetail();
  setView(startView, false);
  window.addEventListener("hashchange", () => {
    const v = readHash();
    if (v === "races") { renderList(); renderDetail(); }
    setView(v, false);
  });
})();
