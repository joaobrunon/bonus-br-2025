(() => {
  "use strict";

  const PAGE = 60;
  const $ = (id) => document.getElementById(id);
  const els = {
    q: $("q"), ure: $("ure"), sort: $("sort"), list: $("list"), count: $("count"),
    more: $("more"), stats: $("stats"), dlg: $("dlg"), body: $("dlg-body"),
  };
  const chips = [...document.querySelectorAll(".chip")];

  let schools = [];
  let ures = {};
  let filtered = [];
  let shown = 0;
  let status = "";

  const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const fmt = (v, d = 2) => (v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const pct = (v) => (v == null ? "—" : fmt(v, 1) + "%");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const statusOf = (icm) => (icm >= 1 ? "diam" : icm > 0 ? "parc" : "zero");
  const LABEL = { diam: "Diamante", parc: "Parcial", zero: "Não atingiu" };

  function badge(s) {
    const st = statusOf(s.icm);
    return `<span class="badge ${st}"><b>${Math.round(s.icm * 100)}%</b><small>${LABEL[st]}</small></span>`;
  }

  function stats() {
    const c = { diam: 0, parc: 0, zero: 0 };
    schools.forEach((s) => c[s._st]++);
    const seduc = ures.SEDUC;
    els.stats.innerHTML = [
      `<div class="stat"><b>${seduc ? Math.round(seduc.icm * 100) + "%" : "—"}</b><span>IACM da SEDUC</span></div>`,
      `<div class="stat diam"><b>${c.diam.toLocaleString("pt-BR")}</b><span>Diamante (ICM 1,00)</span></div>`,
      `<div class="stat parc"><b>${c.parc.toLocaleString("pt-BR")}</b><span>Parcial (0 &lt; ICM &lt; 1)</span></div>`,
      `<div class="stat zero"><b>${c.zero.toLocaleString("pt-BR")}</b><span>Não atingiram (ICM 0)</span></div>`,
    ].join("");
  }

  function apply() {
    const raw = els.q.value.trim();
    const q = fold(raw);
    const digits = /^\d+$/.test(raw);
    const ure = els.ure.value;
    filtered = schools.filter((s) => {
      if (ure && s.ure !== ure) return false;
      if (status && s._st !== status) return false;
      if (!q) return true;
      if (digits) return String(s.cie) === raw || s.inep === raw || s.inep.startsWith(raw) || String(s.cie).startsWith(raw);
      return q.split(/\s+/).every((w) => s._k.includes(w));
    });
    const sort = els.sort.value;
    if (sort === "nome") filtered.sort((a, b) => a._k.localeCompare(b._k));
    else if (sort === "icm-desc") filtered.sort((a, b) => b.icm - a.icm || a._k.localeCompare(b._k));
    else filtered.sort((a, b) => a.icm - b.icm || a._k.localeCompare(b._k));
    shown = 0;
    els.list.innerHTML = "";
    render();
  }

  function render() {
    const n = filtered.length;
    els.count.textContent = n === 1 ? "1 escola encontrada" : `${n.toLocaleString("pt-BR")} escolas encontradas`;
    if (!n) {
      els.list.innerHTML = `<li class="empty">Nenhuma escola encontrada. Confira a grafia ou busque pelo código CIE.<br>CEEJA, escolas indígenas, quilombolas e vinculadas não constam do anexo.</li>`;
      els.more.hidden = true;
      return;
    }
    const slice = filtered.slice(shown, shown + PAGE);
    els.list.insertAdjacentHTML("beforeend", slice.map((s) => `
      <li><button class="card" data-cie="${s.cie}">
        <span class="name">${esc(s.nome)}</span>
        ${badge(s)}
        <span class="meta">CIE ${s.cie} · INEP ${s.inep} · URE ${esc(s.ure)}</span>
      </button></li>`).join(""));
    shown += slice.length;
    els.more.hidden = shown >= n;
    els.more.textContent = `Mostrar mais (${(n - shown).toLocaleString("pt-BR")} restantes)`;
  }

  function gate(ok, val, meta) {
    return `<span class="${ok ? "ok" : "no"}">${ok ? "✓" : "✗"} ${pct(val)}</span>${meta ? ` <small>(meta ${pct(meta)})</small>` : ""}`;
  }

  function why(icm, ic, iq, gates) {
    const failed = gates.filter((g) => !g.ok).map((g) => g.name);
    if (failed.length && ic != null && ic > 0) return `Índice zerado: gatilho ${failed.join(" e ")} não cumprido (índice sem gatilho seria ${fmt(Math.min(ic, 0.5))}).`;
    if (failed.length) return `Gatilho ${failed.join(" e ")} não cumprido.`;
    if (icm >= 0.5) return "Componente no teto (Ouro).";
    if (icm === 0) return "Nota não superou a linha de base nem atingiu o piso de qualidade (IQ).";
    return "Evolução parcial em direção à meta Ouro.";
  }

  function detail(s) {
    const st = s._st;
    const u = ures[s.ure];
    const msg = st === "diam"
      ? "A escola atingiu o patamar Diamante: ICM 1,00 (100%)."
      : st === "parc"
        ? `A escola atingiu parcialmente: ICM ${fmt(s.icm)} (${Math.round(s.icm * 100)}%).`
        : "A escola não atingiu índice nesta apuração: ICM 0,00.";

    const ifaG = { name: "IFA (frequência)", ok: s.ifaOk };
    const srspGates = [ifaG, { name: "TPS SARESP", ok: s.tpsSrspOk }];
    const srspMax = s.base === "SARESP" ? 1 : 0.5;

    let html = `
      <div class="dlg-head">
        <div>
          <h2 id="dlg-title">${esc(s.nome)}</h2>
          <p>${esc(s.tipo)} · CIE ${s.cie} · INEP ${s.inep}<br>URE ${esc(s.ure)} · ${esc(s.jornada)} · Ciclos ${esc(s.ciclos || "—")}</p>
        </div>
        ${badge(s)}
      </div>
      <div class="verdict ${st}">${msg}</div>`;

    if (s.base === "SARESP/SAEB") {
      html += `
      <div class="sum">
        <div><b>${fmt(s.icmSrsp)}</b><span>ICM SARESP</span></div><i>+</i>
        <div><b>${fmt(s.icmSaeb)}</b><span>ICM SAEB</span></div><i>=</i>
        <div><b>${fmt(s.icm)}</b><span>ICM escola</span></div>
      </div>`;
    }

    html += `
      <section class="comp">
        <h3>SARESP / Provão Paulista <span>${fmt(s.icmSrsp)} / ${fmt(srspMax)}</span></h3>
        <div class="meter"><i style="width:${Math.min(100, (s.icmSrsp / srspMax) * 100)}%"></i></div>
        <dl class="kv">
          <dt>Nota final 2024 (linha de base)</dt><dd>${fmt(s.nfSrsp24, 1)}</dd>
          <dt>Nota final 2025 (ciclos comparáveis)</dt><dd>${fmt(s.nfSrsp, 1)}</dd>
          <dt>Meta Ouro</dt><dd>${fmt(s.metaSrsp, 1)}</dd>
          ${s.metaSrspDiam != null ? `<dt>Meta Diamante</dt><dd>${fmt(s.metaSrspDiam, 1)}</dd>` : ""}
          <dt>Piso de qualidade (IQ)</dt><dd>${fmt(s.iqSrsp, 1)}</dd>
          <dt>IC SARESP</dt><dd>${fmt(s.icSrsp, 3)}</dd>
          <dt>Frequência (IFA)</dt><dd>${gate(s.ifaOk, s.ifa, s.ifaMeta)}</dd>
          <dt>Participação SARESP</dt><dd>${gate(s.tpsSrspOk, s.tpsSrsp, 80)}</dd>
        </dl>
        <p class="why">${why(s.icmSrsp, s.icSrsp, s.iqSrsp, srspGates)}</p>
      </section>`;

    if (s.base === "SARESP/SAEB") {
      html += `
      <section class="comp">
        <h3>SAEB <span>${fmt(s.icmSaeb)} / 0,50</span></h3>
        <div class="meter"><i style="width:${Math.min(100, (s.icmSaeb / 0.5) * 100)}%"></i></div>
        <dl class="kv">
          <dt>Nota final 2023 (linha de base)</dt><dd>${fmt(s.nfSaeb23)}</dd>
          <dt>Nota final 2025 (ciclos comparáveis)</dt><dd>${fmt(s.nfSaeb)}</dd>
          <dt>Meta Ouro</dt><dd>${fmt(s.metaSaeb)}</dd>
          <dt>Piso de qualidade (IQ)</dt><dd>${fmt(s.iqSaeb)}</dd>
          <dt>IC SAEB</dt><dd>${fmt(s.icSaeb, 3)}</dd>
          <dt>Frequência (IFA)</dt><dd>${gate(s.ifaOk, s.ifa, s.ifaMeta)}</dd>
          <dt>Participação SAEB</dt><dd>${gate(s.tpsSaebOk, s.tpsSaeb, 80)}</dd>
        </dl>
        <p class="why">${why(s.icmSaeb, s.icSaeb, s.iqSaeb, [ifaG, { name: "TPS SAEB", ok: s.tpsSaebOk }])}</p>
      </section>`;
    } else {
      html += `<p class="why">Escola sem universo de avaliação do SAEB: apurada somente pelo SARESP/Provão Paulista, com meta Diamante própria (ICM até 1,00).</p>`;
    }

    if (u) {
      html += `<p class="ure-box">ICM da URE ${esc(s.ure)}: <strong>${fmt(u.icm)}</strong> (SARESP ${fmt(u.icmSrsp)} + SAEB ${fmt(u.icmSaeb)}) — valor atribuído às escolas sem meta própria da região (CEEJA, indígenas, quilombolas).</p>`;
    }

    els.body.innerHTML = html;
    if (!els.dlg.open) els.dlg.showModal();
    try { history.replaceState(null, "", "#" + s.cie); } catch (e) { /* ignore */ }
  }

  els.list.addEventListener("click", (e) => {
    const b = e.target.closest(".card");
    if (!b) return;
    const s = schools.find((x) => x.cie === +b.dataset.cie);
    if (s) detail(s);
  });
  els.dlg.addEventListener("close", () => {
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
  });
  els.dlg.addEventListener("click", (e) => { if (e.target === els.dlg) els.dlg.close(); });
  els.more.addEventListener("click", render);

  let t;
  els.q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(apply, 120); });
  els.ure.addEventListener("change", apply);
  els.sort.addEventListener("change", apply);
  chips.forEach((c) => c.addEventListener("click", () => {
    status = c.dataset.st;
    chips.forEach((x) => { x.classList.toggle("on", x === c); x.setAttribute("aria-checked", x === c); });
    apply();
  }));

  Promise.all([
    fetch("data/escolas.json").then((r) => r.json()),
    fetch("data/ures.json").then((r) => r.json()),
  ]).then(([e, u]) => {
    schools = e;
    ures = u;
    schools.forEach((s) => {
      s._st = statusOf(s.icm);
      s._k = fold(s.nome);
    });
    const names = [...new Set(schools.map((s) => s.ure))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    els.ure.insertAdjacentHTML("beforeend", names.map((n) => `<option>${esc(n)}</option>`).join(""));
    stats();
    apply();
    const fromHash = () => {
      const h = +location.hash.slice(1);
      const s = h && schools.find((x) => x.cie === h);
      if (s) detail(s);
    };
    window.addEventListener("hashchange", fromHash);
    fromHash();
  }).catch(() => {
    els.count.textContent = "Não foi possível carregar os dados. Abra a página por um servidor (GitHub Pages ou python -m http.server).";
  });
})();
