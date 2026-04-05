/* ═══════════════════════════════════════
   BCB FINANCEIRO — Dashboard v3
   ═══════════════════════════════════════ */

/* ─── PLUGIN: EIXO HIERÁRQUICO ─────────── */
const _hAxisCfg = {};
function setHAxis(id, cfg) { _hAxisCfg[id] = cfg; }
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const AXIS_MONTH = { key: d => d.getFullYear()+'-'+d.getMonth(), label: d => MESES[d.getMonth()] };
const AXIS_YEAR = { key: d => d.getFullYear(), label: d => String(d.getFullYear()), bold: true };

const hierarchicalAxisPlugin = {
    id: 'hierarchicalAxis',
    afterDraw(chart) {
        try {
            const config = _hAxisCfg[chart.canvas.id];
            if (!config?.levels) return;
            const { ctx } = chart;
            const xScale = chart.scales.x;
            if (!xScale) return;
            const labels = chart.data.labels;
            if (!labels?.length) return;
            const bottom = chart.chartArea.bottom;
            const left = chart.chartArea.left;
            const right = chart.chartArea.right;
            const dates = labels.map(l => { const p = String(l).split('-'); return new Date(+p[0]||2024, (+p[1]||1)-1, +p[2]||1); });
            const totalH = config.levels.length * 22;
            const lv0 = config.levels[0];
            const slots = [];
            let lastK = null;
            dates.forEach(d => { const k = lv0.key(d); if (k !== lastK) { slots.push({key:k, label:lv0.label(d), date:d}); lastK=k; }});
            if (!slots.length) return;
            const sw = (right - left) / slots.length;
            slots.forEach((s,i) => { s.x0 = left+sw*i; s.x1 = left+sw*(i+1); s.cx = s.x0+sw/2; });
            const y0 = bottom + 14;
            ctx.save(); ctx.textAlign='center'; ctx.textBaseline='top';
            ctx.font = lv0.bold ? "bold 11px 'Inter',sans-serif" : "11px 'Inter',sans-serif";
            ctx.fillStyle = config.color || '#8b949e';
            slots.forEach((s,i) => {
                ctx.fillText(s.label, s.cx, y0);
                if (i > 0) { ctx.beginPath(); ctx.strokeStyle=config.lineColor||'#30363d60'; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.moveTo(Math.round(s.x0)+.5, bottom+4); ctx.lineTo(Math.round(s.x0)+.5, bottom+10+totalH); ctx.stroke(); ctx.setLineDash([]); }
            });
            ctx.restore();
            for (let li = 1; li < config.levels.length; li++) {
                const lv = config.levels[li]; const y = bottom + 14 + li * 22;
                const groups = []; let cur = null;
                slots.forEach(s => { const k = lv.key(s.date); if (!cur||cur.key!==k) { cur={key:k,label:lv.label(s.date),x0:s.x0,x1:s.x1}; groups.push(cur); } else { cur.x1=s.x1; }});
                ctx.save(); ctx.textAlign='center'; ctx.textBaseline='top';
                ctx.font = lv.bold ? "bold 11px 'Inter',sans-serif" : "11px 'Inter',sans-serif";
                ctx.fillStyle = config.color || '#8b949e';
                groups.forEach((g,gi) => {
                    ctx.fillText(g.label, (g.x0+g.x1)/2, y);
                    if (gi > 0) { ctx.beginPath(); ctx.strokeStyle=config.lineColor||'#30363d60'; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.moveTo(Math.round(g.x0)+.5, bottom+4); ctx.lineTo(Math.round(g.x0)+.5, bottom+10+totalH); ctx.stroke(); ctx.setLineDash([]); }
                });
                ctx.restore();
            }
        } catch(e) { console.warn('hAxis:', e); }
    }
};

/* ─── DISCLAIMER TOOLTIPS ──────────────── */
const FORMULAS = {
    roe: '<strong>ROE</strong> = Lucro Líquido / Patrimônio Líquido &times; 100',
    roa: '<strong>ROA</strong> = Lucro Líquido / Ativo Total &times; 100',
    basileia: '<strong>Índice de Basileia</strong> = Patrimônio de Referência / Ativos Ponderados pelo Risco',
    inadimplencia: '<strong>Inadimplência</strong> = % da carteira de crédito com atraso &gt; 90 dias (fonte: SGS/BCB)',
    spread: '<strong>Spread Bancário</strong> = Taxa média de empréstimo &minus; Taxa média de captação (p.p.)',
    hhi: '<strong>HHI</strong> = &Sigma;(share&sup2;) &mdash; Índice Herfindahl-Hirschman. Acima de 1.500 = mercado concentrado',
    share: '<strong>Market Share</strong> = Ativo da instituição / Ativo total do SFN &times; 100',
    credpc: '<strong>Crédito Per Capita</strong> = Carteira de crédito / População. Dados agregados por sede da instituição.',
    credito: '<strong>Crédito Total</strong> = Saldo de todas as operações de crédito do SFN (fonte: SGS série 20539)',
};
function tip(key) { return `<span class="info-tip">?<span class="info-box">${FORMULAS[key]||''}</span></span>`; }

/* ─── STATE ────────────────────────────── */
const APP = {
    data: {}, charts: {}, activeSection: 'resumo',
    filters: { trimestre: null, segmento: 'todos', instituicao: '' },
    sort: { col: null, dir: 'desc' },
};

const SEG_HEX = { grande:'#58a6ff', cooperativa:'#5eead4', outro:'#d29922' };
const SEG_LABELS = { grande:'Grandes Bancos', cooperativa:'Cooperativas', outro:'Outros' };
const PAL = ['#58a6ff','#5eead4','#d29922','#bc8cff','#3fb950','#f85149','#f0a050','#60a5fa','#a78bfa','#4ade80','#fb923c','#38bdf8','#e879f9','#facc15','#34d399'];
const SECTIONS = [
    {id:'resumo',label:'Resumo'},{id:'rentabilidade',label:'Rentabilidade'},
    {id:'credito',label:'Crédito'},{id:'taxas',label:'Taxas de Juros'},
    {id:'concentracao',label:'Concentração'},{id:'comparativo',label:'Bancos vs Coops'},
    {id:'geografico',label:'Mapa'},{id:'reclamacoes',label:'Reclamações'},
];

const FMT = {
    brl: v => v>=1e12?`R$ ${(v/1e12).toFixed(1)} tri`:v>=1e9?`R$ ${(v/1e9).toFixed(1)} bi`:v>=1e6?`R$ ${(v/1e6).toFixed(0)} mi`:`R$ ${v.toLocaleString('pt-BR')}`,
    pct: (v,d=2) => `${v.toFixed(d)}%`,
    tri: dt => { const q={'03':'1T','06':'2T','09':'3T','12':'4T'}[dt.slice(4)]||''; return `${q}/${dt.slice(0,4)}`; },
};

function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function segC(s) { return SEG_HEX[s]||'#6e7681'; }

function getTris() { const i=APP.data.indicadores?.trimestres; return i?Object.keys(i).sort():[]; }
function activeTri() { const t=getTris(), f=APP.filters.trimestre; return (f&&t.includes(f))?f:t[t.length-1]||null; }
function getAg(tri) { return APP.data.indicadores?.trimestres?.[tri]?.agregado || []; }
function getSing(tri, nome) { return APP.data.indicadores?.trimestres?.[tri]?.singulares?.[nome] || []; }
function filtered(tri) {
    let d = getAg(tri).filter(i=>i.ativo_total>0);
    const f = APP.filters;
    if (f.segmento !== 'todos') d = d.filter(i=>i.segmento===f.segmento);
    if (f.instituicao) d = d.filter(i=>i.nome===f.instituicao);
    return d;
}
function allNames() {
    const tri = activeTri(); if (!tri) return [];
    let d = getAg(tri);
    if (APP.filters.segmento !== 'todos') d = d.filter(i=>i.segmento===APP.filters.segmento);
    return [...new Set(d.map(i=>i.nome))].sort();
}

/* ─── Sortable table helper ────────────── */
function sortData(data, col, dir) {
    return [...data].sort((a,b) => {
        let va = a[col], vb = b[col];
        if (va == null) va = -Infinity; if (vb == null) vb = -Infinity;
        return dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
}
function sortHeader(col, label, extraClass='') {
    const s = APP.sort;
    const cls = s.col===col ? (s.dir==='asc' ? 'sort-asc' : 'sort-desc') : '';
    return `<th class="sortable ${cls} ${extraClass}" data-sort="${col}">${label}</th>`;
}

/* ─── Init ─────────────────────────────── */
async function init() {
    const files = ['credito','taxas','resultados','indicadores','concentracao','estban','reclamacoes','instituicoes'];
    try {
        const res = await Promise.allSettled(files.map(f=>fetch(`data/${f}.json`).then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})));
        let n=0; files.forEach((f,i)=>{if(res[i].status==='fulfilled'){APP.data[f]=res[i].value;n++;}else{APP.data[f]=null;}});
        if(n===0){document.getElementById('app').innerHTML='<div class="loading" style="color:var(--accent-red)"><p>Erro ao carregar dados.</p></div>';return;}
    } catch(e) { return; }
    render();
}

/* ─── Render ───────────────────────────── */
function render() {
    try {
        document.getElementById('app').innerHTML = renderHeader()+renderNav()+renderToolbar()+renderKPIs()+renderSections()+renderFooter();
        bindEvents(); showSection(APP.activeSection);
    } catch(e) { console.error('Render:', e); }
}

function renderHeader() {
    const ts = APP.data.credito?.last_updated?.slice(0,10)||'';
    return `<header class="header"><div class="header-left"><div class="header-logo"><span>BCB</span> Financeiro</div><span class="header-badge">SFN</span></div><div class="header-right"><span class="header-timestamp">Atualizado: ${ts}</span><button class="theme-toggle" id="themeToggle">☀</button></div></header>`;
}

function renderNav() {
    return `<nav class="nav">${SECTIONS.map(s=>`<button class="nav-btn${s.id===APP.activeSection?' active':''}" data-section="${s.id}">${s.label}</button>`).join('')}</nav>`;
}

function renderToolbar() {
    const tris=getTris(), at=activeTri(), names=allNames(), f=APP.filters;
    return `<div class="filter-toolbar">
        <div class="filter-field"><label>Período</label><select class="filter-select" id="fTri">${tris.map(t=>`<option value="${t}"${t===at?' selected':''}>${FMT.tri(t)}</option>`).join('')}</select></div>
        <div class="filter-field"><label>Segmento</label><select class="filter-select" id="fSeg"><option value="todos"${f.segmento==='todos'?' selected':''}>Todos</option>${Object.entries(SEG_LABELS).map(([k,v])=>`<option value="${k}"${f.segmento===k?' selected':''}>${v}</option>`).join('')}</select></div>
        <div class="filter-divider"></div>
        <div class="filter-field"><label>Instituição</label><select class="filter-select" id="fInst" style="min-width:200px"><option value="">Todas</option>${names.map(n=>`<option value="${n}"${f.instituicao===n?' selected':''}>${n}</option>`).join('')}</select></div>
    </div>`;
}

function renderKPIs() {
    const s=APP.data.credito?.series, tri=activeTri(), conc=APP.data.concentracao?.trimestres?.[tri];
    const ct=s?.credito_total?.ultimo?.valor, inad=s?.inadimplencia?.ultimo?.valor, spr=s?.spread_total?.ultimo?.valor, t5=conc?.top5_share_ativo;
    return `<div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">Crédito Total ${tip('credito')}</div><div class="kpi-value">${ct?FMT.brl(ct*1e6):'—'}</div><div class="kpi-detail">Saldo total do SFN</div></div>
        <div class="kpi-card"><div class="kpi-label">Inadimplência ${tip('inadimplencia')}</div><div class="kpi-value">${inad?FMT.pct(inad):'—'}</div><div class="kpi-detail">Atraso &gt;90 dias</div></div>
        <div class="kpi-card"><div class="kpi-label">Spread ${tip('spread')}</div><div class="kpi-value">${spr?FMT.pct(spr,1):'—'}</div><div class="kpi-detail">Captação vs empréstimo</div></div>
        <div class="kpi-card"><div class="kpi-label">Top 5 Share ${tip('share')}</div><div class="kpi-value">${t5?FMT.pct(t5,1):'—'}</div><div class="kpi-detail">Concentração (${tri?FMT.tri(tri):''})</div></div>
    </div>`;
}

function renderFooter() {
    return `<footer class="footer">Fonte: <a href="https://www.bcb.gov.br" target="_blank">Banco Central do Brasil</a> — IF.data, SGS, Olinda<br><a href="https://github.com/Fexndev/bcb-financeiro" target="_blank">GitHub</a></footer>`;
}

function renderSections() { return SECTIONS.map(s=>`<div class="section" id="sec-${s.id}">${({resumo:rResumo,rentabilidade:rRent,credito:rCred,taxas:rTaxas,concentracao:rConc,comparativo:rComp,geografico:rGeo,reclamacoes:rRec})[s.id]?.()??''}</div>`).join(''); }

/* ─── RESUMO ───────────────────────────── */
function rResumo() {
    const tri=activeTri(); if(!tri) return '<p>Dados indisponíveis</p>';
    let data = filtered(tri).sort((a,b)=>b.ativo_total-a.ativo_total);
    if (APP.sort.col) data = sortData(data, APP.sort.col, APP.sort.dir);
    data = data.slice(0,20);
    const hasSing = APP.filters.instituicao && getSing(tri, APP.filters.instituicao).length;
    return `<div class="section-title">Visão Geral — ${FMT.tri(tri)}</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">Top 10 ROE ${tip('roe')}</div><div class="chart-container-sm"><canvas id="c-roe-top"></canvas></div></div>
        <div class="card"><div class="card-title">Evolução do Crédito Total ${tip('credito')}</div><div class="chart-container-sm"><canvas id="c-cred-evo"></canvas></div></div>
    </div>
    <div class="card"><div class="card-title">Principais Instituições</div><div class="table-wrap">
        <table id="tbl-resumo"><thead><tr><th>#</th>${sortHeader('nome','Instituição')}${sortHeader('segmento','Segmento')}${sortHeader('ativo_total','Ativo Total','td-right')}${sortHeader('roe','ROE '+tip('roe'),'td-right')}${sortHeader('roa','ROA '+tip('roa'),'td-right')}${sortHeader('indice_basileia','Basileia '+tip('basileia'),'td-right')}</tr></thead>
        <tbody>${data.map((i,x)=>`<tr><td class="td-mono">${x+1}</td><td class="td-name">${i.nome}${i.qtd_singulares>1?' <span style="color:var(--text-muted);font-size:.65rem">(${i.qtd_singulares})</span>':''}</td><td><span class="td-seg seg-${i.segmento}">${SEG_LABELS[i.segmento]||i.segmento}</span></td><td class="td-mono td-right">${FMT.brl(i.ativo_total)}</td><td class="td-mono td-right ${i.roe>0?'badge-positive':'badge-negative'}">${i.roe!=null?FMT.pct(i.roe):'—'}</td><td class="td-mono td-right">${i.roa!=null?FMT.pct(i.roa,3):'—'}</td><td class="td-mono td-right">${i.indice_basileia!=null?FMT.pct(i.indice_basileia*100,1):'—'}</td></tr>`).join('')}</tbody></table>
    </div></div>
    ${hasSing ? rDrillDown(tri) : ''}`;
}

function rDrillDown(tri) {
    const nome = APP.filters.instituicao;
    let sings = getSing(tri, nome);
    if (!sings.length) return '';
    if (APP.sort.col) sings = sortData(sings, APP.sort.col, APP.sort.dir);
    return `<div class="card"><div class="card-title">Singulares — ${nome} (${sings.length})</div><div class="table-wrap">
        <table><thead><tr><th>#</th>${sortHeader('nome','Nome')}${sortHeader('uf','UF')}${sortHeader('ativo_total','Ativo','td-right')}${sortHeader('carteira_credito','Crédito','td-right')}${sortHeader('roe','ROE','td-right')}</tr></thead>
        <tbody>${sings.map((s,i)=>`<tr><td class="td-mono">${i+1}</td><td class="td-name">${s.nome}</td><td>${s.uf||''}</td><td class="td-mono td-right">${FMT.brl(s.ativo_total)}</td><td class="td-mono td-right">${FMT.brl(s.carteira_credito)}</td><td class="td-mono td-right">${s.roe!=null?FMT.pct(s.roe):'—'}</td></tr>`).join('')}</tbody></table>
    </div></div>`;
}

/* ─── RENTABILIDADE ────────────────────── */
function rRent() {
    const tri=activeTri(); if(!tri) return '<p>Dados indisponíveis</p>';
    return `<div class="section-title">Rentabilidade — ${FMT.tri(tri)}</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">ROE por Instituição ${tip('roe')}</div><div class="chart-container"><canvas id="c-roe"></canvas></div></div>
        <div class="card"><div class="card-title">Evolução ROE Médio ${tip('roe')}</div><div class="chart-container"><canvas id="c-roe-evo"></canvas></div></div>
    </div>`;
}

/* ─── CRÉDITO ──────────────────────────── */
function rCred() {
    return `<div class="section-title">Crédito e Inadimplência</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">Crédito PF vs PJ ${tip('credito')}</div><div class="chart-container"><canvas id="c-pfpj"></canvas></div></div>
        <div class="card"><div class="card-title">Inadimplência ${tip('inadimplencia')}</div><div class="chart-container"><canvas id="c-inad"></canvas></div></div>
    </div>
    <div class="card"><div class="card-title">Spread Bancário ${tip('spread')}</div><div class="chart-container-sm"><canvas id="c-spread"></canvas></div></div>`;
}

/* ─── TAXAS ────────────────────────────── */
function rTaxas() {
    const tx=APP.data.taxas?.modalidades; if(!tx) return '<p>Dados indisponíveis</p>';
    const mods=Object.entries(tx).filter(([,v])=>!v.erro);
    return `<div class="section-title">Taxas de Juros</div>
    <div class="card"><div class="card-title">Taxa Média Anual</div><div class="chart-container"><canvas id="c-taxas"></canvas></div></div>
    <div class="card"><div class="card-title">Comparativo por Segmento (% a.a.)</div><div class="table-wrap"><table>
        <thead><tr><th>Modalidade</th>${Object.values(SEG_LABELS).map(v=>`<th class="td-right">${v}</th>`).join('')}</tr></thead>
        <tbody>${mods.map(([,m])=>`<tr><td class="td-name">${m.descricao}</td>${Object.keys(SEG_LABELS).map(s=>{const v=m.media_por_segmento?.[s];return`<td class="td-mono td-right">${v?FMT.pct(v,1):'—'}</td>`;}).join('')}</tr>`).join('')}</tbody>
    </table></div></div>`;
}

/* ─── CONCENTRAÇÃO ─────────────────────── */
function rConc() {
    const tri=activeTri(); if(!tri) return '<p>Dados indisponíveis</p>';
    return `<div class="section-title">Concentração — ${FMT.tri(tri)} ${tip('hhi')}</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">Market Share — Ativo ${tip('share')}</div><div class="chart-container"><canvas id="c-share"></canvas></div></div>
        <div class="card"><div class="card-title">Share por Segmento</div><div class="chart-container"><canvas id="c-share-seg"></canvas></div></div>
    </div>
    <div class="card"><div class="card-title">Evolução HHI e Top 5</div><div class="chart-container-sm"><canvas id="c-hhi"></canvas></div></div>`;
}

/* ─── COMPARATIVO ──────────────────────── */
function rComp() {
    return `<div class="section-title">Grandes Bancos vs Cooperativas</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">ROE Médio ${tip('roe')}</div><div class="chart-container"><canvas id="c-comp-roe"></canvas></div></div>
        <div class="card"><div class="card-title">Taxas Comparadas (% a.a.)</div><div class="chart-container"><canvas id="c-comp-tx"></canvas></div></div>
    </div>`;
}

/* ─── GEOGRÁFICO ───────────────────────── */
function rGeo() {
    const e=APP.data.estban; if(!e?.por_uf) return '<p>Dados indisponíveis</p>';
    const ufs=[...e.por_uf].sort((a,b)=>b.credito_per_capita-a.credito_per_capita);
    const mx=ufs[0]?.credito_per_capita||1;
    return `<div class="section-title">Crédito por UF ${tip('credpc')}</div>
    <div class="note-box">Dados agregados por <strong>sede da instituição</strong>. UFs com sedes de grandes bancos (DF, SP) apresentam valores superestimados — BB, Caixa e BNDES têm sede no DF mas operam nacionalmente.</div>
    <div class="card"><div class="card-title">Crédito Per Capita (R$ mil / hab)</div><div class="chart-container"><canvas id="c-geo"></canvas></div></div>
    <div class="card"><div class="card-title">Ranking por UF</div><div class="map-legend">${ufs.map(u=>`<div class="legend-item"><span class="legend-uf">${u.uf}</span><span class="legend-value">R$ ${u.credito_per_capita.toLocaleString('pt-BR',{maximumFractionDigits:0})} mil</span><div style="flex:1;margin-left:12px"><div class="legend-bar" style="width:${(u.credito_per_capita/mx*100).toFixed(0)}%"></div></div></div>`).join('')}</div></div>`;
}

/* ─── RECLAMAÇÕES ──────────────────────── */
function rRec() {
    if(!APP.data.reclamacoes) return '<p>Dados indisponíveis</p>';
    return `<div class="section-title">Reclamações</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">Índice por Instituição</div><div class="chart-container"><canvas id="c-rec"></canvas></div></div>
        <div class="card"><div class="card-title">Média por Segmento</div><div class="chart-container"><canvas id="c-rec-seg"></canvas></div></div>
    </div>`;
}

/* ═══════════════════════════════════════
   CHARTS
   ═══════════════════════════════════════ */

function defs(hideY=true) {
    const t=css('--text-secondary'),m=css('--text-muted'),b=css('--border');
    return { responsive:true, maintainAspectRatio:false,
        plugins: { legend:{labels:{color:t,font:{family:"'Inter'",size:11}}}, datalabels:{display:false} },
        scales: { x:{display:false}, y:hideY?{display:false}:{ticks:{color:m,font:{size:10}},grid:{color:b+'30'},border:{display:false}} },
    };
}

function dlabel(fmt) {
    return { display:true, color:css('--text-primary'), font:{family:"'JetBrains Mono'",size:10,weight:600}, anchor:'end', align:'end', offset:2, formatter:fmt||(v=>v?.toFixed?.(1)) };
}

// Datalabel for line charts — show every Nth point + last
function dlabelLine(fmt, every=6) {
    return { display: (ctx) => { const i=ctx.dataIndex, len=ctx.dataset.data.length; return i===len-1 || i%every===0; },
        color:css('--text-primary'), font:{family:"'JetBrains Mono'",size:9,weight:600}, anchor:'end', align:'top', offset:4, formatter:fmt };
}

function hbar(labels, values, colors, fmtFn) {
    return { type:'bar', data:{labels, datasets:[{data:values, backgroundColor:colors, borderRadius:6}]},
        options: { ...defs(), indexAxis:'y',
            plugins:{...defs().plugins, legend:{display:false}, datalabels:dlabel(fmtFn)},
            scales:{x:{display:false}, y:{display:true, ticks:{color:css('--text-primary'),font:{size:10}}, grid:{display:false}, border:{display:false}}},
        },
    };
}

// Line chart with hierarchical axis
function lineHAxis(canvasId, labels, datasets, yFmt) {
    setHAxis(canvasId, { color:css('--text-secondary'), lineColor:css('--border')+'60', levels:[AXIS_MONTH, AXIS_YEAR] });
    return { type:'line', data:{labels, datasets},
        options: { ...defs(false),
            plugins:{...defs(false).plugins, datalabels:{display:false}},
            scales: { x:{display:false}, y:{display:false} },
            layout: { padding: { bottom: 50 } },
        },
    };
}

function destroyCharts() { Object.values(APP.charts).forEach(c=>c.destroy()); APP.charts={}; }

function mountCharts() {
    destroyCharts();
    try { ({resumo:mResumo,rentabilidade:mRent,credito:mCred,taxas:mTaxas,concentracao:mConc,comparativo:mComp,geografico:mGeo,reclamacoes:mRec})[APP.activeSection]?.(); } catch(e) { console.error('Chart:',e); }
}

/* ─── Resumo ───────────────────────────── */
function mResumo() {
    const tri=activeTri();
    const data=filtered(tri).filter(i=>i.roe!=null&&i.ativo_total>1e9).sort((a,b)=>b.roe-a.roe).slice(0,10);
    const ctx1=document.getElementById('c-roe-top');
    if(ctx1&&data.length) APP.charts.a=new Chart(ctx1, hbar(data.map(i=>i.nome), data.map(i=>i.roe), data.map((_,i)=>PAL[i%PAL.length]), v=>v.toFixed(1)+'%'));

    const cr=APP.data.credito?.series?.credito_total?.monthly;
    if(cr) {
        const d=cr.slice(-24), id='c-cred-evo', ctx2=document.getElementById(id);
        if(ctx2) {
            setHAxis(id, {color:css('--text-secondary'), lineColor:css('--border')+'60', levels:[AXIS_MONTH,AXIS_YEAR]});
            APP.charts.b=new Chart(ctx2, { type:'line',
                data:{labels:d.map(m=>m.data+'-01'), datasets:[{data:d.map(m=>m.valor),borderColor:'#5eead4',backgroundColor:'rgba(94,234,212,.1)',fill:true,tension:.3,pointRadius:0}]},
                options:{...defs(false), plugins:{legend:{display:false}, datalabels:dlabelLine(v=>(v/1e6).toFixed(1)+' tri',6)}, scales:{x:{display:false},y:{display:false}}, layout:{padding:{bottom:50}}},
            });
        }
    }
}

/* ─── Rentabilidade ────────────────────── */
function mRent() {
    const tri=activeTri();
    const data=filtered(tri).filter(i=>i.roe!=null&&i.ativo_total>1e9).sort((a,b)=>b.roe-a.roe).slice(0,15);
    const ctx1=document.getElementById('c-roe');
    if(ctx1&&data.length) APP.charts.c=new Chart(ctx1, hbar(data.map(i=>i.nome), data.map(i=>i.roe), data.map(i=>segC(i.segmento)), v=>v.toFixed(1)+'%'));

    const tris=getTris(), ind=APP.data.indicadores?.trimestres, segs=Object.keys(SEG_LABELS);
    const ds=segs.map(seg=>({label:SEG_LABELS[seg], data:tris.map(t=>{const a=(ind[t]?.agregado||[]).filter(i=>i.segmento===seg&&i.roe!=null);return a.length?+(a.reduce((s,i)=>s+i.roe,0)/a.length).toFixed(2):null;}), borderColor:segC(seg), backgroundColor:'transparent', tension:.3, pointRadius:3}));
    const id='c-roe-evo', ctx2=document.getElementById(id);
    if(ctx2) {
        // Trimestres como datas para eixo hierárquico
        const tLabels = tris.map(t => t.slice(0,4)+'-'+t.slice(4)+'-01');
        setHAxis(id, {color:css('--text-secondary'), lineColor:css('--border')+'60', levels:[{key:d=>`${d.getFullYear()}-${d.getMonth()}`, label:d=>FMT.tri(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`)}, AXIS_YEAR]});
        APP.charts.d=new Chart(ctx2, {type:'line', data:{labels:tLabels, datasets:ds}, options:{...defs(false), plugins:{...defs(false).plugins,datalabels:{display:false}}, scales:{x:{display:false},y:{display:false}}, layout:{padding:{bottom:50}}}});
    }
}

/* ─── Crédito ──────────────────────────── */
function mCred() {
    const s=APP.data.credito?.series; if(!s) return;
    function lineTS(canvasId, datasets) {
        const id=canvasId, ctx=document.getElementById(id); if(!ctx) return;
        const labels = datasets[0].raw.map(m=>m.data+'-01');
        setHAxis(id, {color:css('--text-secondary'), lineColor:css('--border')+'60', levels:[AXIS_MONTH,AXIS_YEAR]});
        APP.charts[id]=new Chart(ctx, {type:'line', data:{labels, datasets:datasets.map(d=>({label:d.label, data:d.raw.map(m=>m.valor), borderColor:d.color, tension:.3, pointRadius:0, borderWidth:d.width||1.5, borderDash:d.dash||[]}))},
            options:{...defs(false), plugins:{legend:{labels:{color:css('--text-secondary')}}, datalabels:dlabelLine(datasets[0].fmt||null,8)}, scales:{x:{display:false},y:{display:false}}, layout:{padding:{bottom:50}}}});
    }
    const pf=s.credito_pf?.monthly?.slice(-24)||[], pj=s.credito_pj?.monthly?.slice(-24)||[];
    if(pf.length) lineTS('c-pfpj', [{label:'PF',raw:pf,color:'#58a6ff',fmt:v=>(v/1e6).toFixed(1)+' tri'},{label:'PJ',raw:pj,color:'#d29922'}]);
    const i=s.inadimplencia?.monthly?.slice(-24)||[], ipf=s.inadimplencia_pf?.monthly?.slice(-24)||[], ipj=s.inadimplencia_pj?.monthly?.slice(-24)||[];
    if(i.length) lineTS('c-inad', [{label:'Total',raw:i,color:'#f85149',width:2,fmt:v=>v.toFixed(2)+'%'},{label:'PF',raw:ipf,color:'#58a6ff',dash:[5,3]},{label:'PJ',raw:ipj,color:'#d29922',dash:[5,3]}]);
    const sp=s.spread_total?.monthly?.slice(-24)||[], spf=s.spread_pf?.monthly?.slice(-24)||[];
    if(sp.length) lineTS('c-spread', [{label:'Total',raw:sp,color:'#5eead4',fmt:v=>v.toFixed(1)+' p.p.'},{label:'PF',raw:spf,color:'#bc8cff'}]);
}

/* ─── Taxas ────────────────────────────── */
function mTaxas() {
    const tx=APP.data.taxas?.modalidades; if(!tx) return;
    const mods=Object.entries(tx).filter(([,v])=>!v.erro&&v.media_geral);
    const ctx=document.getElementById('c-taxas');
    if(ctx) APP.charts.h=new Chart(ctx, hbar(mods.map(([,v])=>v.descricao), mods.map(([,v])=>v.media_geral), mods.map((_,i)=>PAL[i%PAL.length]), v=>v.toFixed(1)+'%'));
}

/* ─── Concentração ─────────────────────── */
function mConc() {
    const conc=APP.data.concentracao?.trimestres; if(!conc) return;
    const tri=activeTri(), last=conc[tri]; if(!last) return;
    const top10=last.ranking_ativo.slice(0,10), outros=100-top10.reduce((s,i)=>s+i.share,0);
    const c1=document.getElementById('c-share');
    if(c1) APP.charts.i=new Chart(c1,{type:'doughnut',data:{labels:[...top10.map(i=>i.nome),'Outros'],datasets:[{data:[...top10.map(i=>i.share),outros],backgroundColor:[...PAL.slice(0,10),'#3b4654'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:css('--text-secondary'),font:{size:10},boxWidth:10,padding:6}},datalabels:{color:'#fff',font:{size:9,weight:700},formatter:v=>v>3?v.toFixed(1)+'%':''}}}});
    const ss=last.share_por_segmento, segs=Object.entries(ss).sort((a,b)=>b[1]-a[1]);
    const c2=document.getElementById('c-share-seg');
    if(c2) APP.charts.j=new Chart(c2,{type:'doughnut',data:{labels:segs.map(([s])=>SEG_LABELS[s]||s),datasets:[{data:segs.map(([,v])=>v),backgroundColor:segs.map(([s])=>segC(s)),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:css('--text-secondary'),font:{size:11},boxWidth:10,padding:6}},datalabels:{color:'#fff',font:{size:11,weight:700},formatter:v=>v>3?v.toFixed(1)+'%':''}}}});
    const tris=Object.keys(conc).sort(), id='c-hhi', c3=document.getElementById(id);
    if(c3) {
        const tLabels=tris.map(t=>t.slice(0,4)+'-'+t.slice(4)+'-01');
        setHAxis(id,{color:css('--text-secondary'),lineColor:css('--border')+'60',levels:[{key:d=>`${d.getFullYear()}-${d.getMonth()}`,label:d=>FMT.tri(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`)},AXIS_YEAR]});
        APP.charts.k=new Chart(c3,{type:'line',data:{labels:tLabels,datasets:[{label:'HHI',data:tris.map(t=>conc[t].hhi_ativo),borderColor:'#5eead4',tension:.3,pointRadius:3,yAxisID:'y'},{label:'Top 5 %',data:tris.map(t=>conc[t].top5_share_ativo),borderColor:'#58a6ff',tension:.3,pointRadius:3,yAxisID:'y1'}]},options:{...defs(false),plugins:{...defs(false).plugins,datalabels:{display:false}},scales:{x:{display:false},y:{position:'left',ticks:{color:css('--text-muted')},grid:{color:css('--border')+'30'},border:{display:false}},y1:{position:'right',ticks:{color:css('--text-muted')},grid:{display:false},border:{display:false}}},layout:{padding:{bottom:50}}}});
    }
}

/* ─── Comparativo ──────────────────────── */
function mComp() {
    const ind=APP.data.indicadores?.trimestres; if(!ind) return;
    const tris=getTris(), segs=Object.keys(SEG_LABELS);
    const ds=segs.map(seg=>({label:SEG_LABELS[seg], data:tris.map(t=>{const a=(ind[t]?.agregado||[]).filter(i=>i.segmento===seg&&i.roe!=null);return a.length?+(a.reduce((s,i)=>s+i.roe,0)/a.length).toFixed(2):null;}), borderColor:segC(seg), backgroundColor:'transparent', tension:.3, pointRadius:3}));
    const id='c-comp-roe', c1=document.getElementById(id);
    if(c1) {
        const tLabels=tris.map(t=>t.slice(0,4)+'-'+t.slice(4)+'-01');
        setHAxis(id,{color:css('--text-secondary'),lineColor:css('--border')+'60',levels:[{key:d=>`${d.getFullYear()}-${d.getMonth()}`,label:d=>FMT.tri(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`)},AXIS_YEAR]});
        APP.charts.l=new Chart(c1,{type:'line',data:{labels:tLabels,datasets:ds},options:{...defs(false),plugins:{...defs(false).plugins,datalabels:{display:false}},scales:{x:{display:false},y:{display:false}},layout:{padding:{bottom:50}}}});
    }
    const tx=APP.data.taxas?.modalidades; if(!tx) return;
    const mc=['consignado_inss','credito_pessoal','veiculos','cheque_especial','capital_giro_curto'];
    const ml=mc.map(m=>tx[m]?.descricao?.slice(0,18)||m);
    const tds=segs.map(seg=>({label:SEG_LABELS[seg],data:mc.map(m=>tx[m]?.media_por_segmento?.[seg]||null),backgroundColor:segC(seg),borderRadius:6}));
    const c2=document.getElementById('c-comp-tx');
    if(c2) APP.charts.m=new Chart(c2,{type:'bar',data:{labels:ml,datasets:tds},options:{...defs(false),plugins:{...defs(false).plugins,datalabels:{display:false}},scales:{x:{ticks:{color:css('--text-muted'),font:{size:9}},grid:{display:false},border:{display:false}},y:{display:false}}}});
}

/* ─── Geográfico ───────────────────────── */
function mGeo() {
    const e=APP.data.estban; if(!e?.por_uf) return;
    const ufs=[...e.por_uf].sort((a,b)=>b.credito_per_capita-a.credito_per_capita);
    const ctx=document.getElementById('c-geo');
    if(ctx) APP.charts.n=new Chart(ctx,{type:'bar',data:{labels:ufs.map(u=>u.uf),datasets:[{data:ufs.map(u=>u.credito_per_capita),backgroundColor:ufs.map((_,i)=>`rgba(94,234,212,${.3+((ufs.length-i)/ufs.length)*.7})`),borderRadius:6}]},options:{...defs(),plugins:{...defs().plugins,legend:{display:false},datalabels:dlabel(v=>'R$ '+v.toLocaleString('pt-BR',{maximumFractionDigits:0}))},scales:{x:{display:true,ticks:{color:css('--text-primary'),font:{size:9,weight:600}},grid:{display:false},border:{display:false}},y:{display:false}}}});
}

/* ─── Reclamações ──────────────────────── */
function mRec() {
    const r=APP.data.reclamacoes; if(!r) return;
    const rk=[...r.ranking].sort((a,b)=>b.indice-a.indice);
    const c1=document.getElementById('c-rec');
    if(c1) APP.charts.o=new Chart(c1, hbar(rk.map(r=>r.instituicao), rk.map(r=>r.indice), rk.map(r=>segC(r.segmento)), v=>v.toFixed(1)));
    const sd=Object.entries(r.media_por_segmento).sort((a,b)=>b[1]-a[1]);
    const c2=document.getElementById('c-rec-seg');
    if(c2) APP.charts.p=new Chart(c2,{type:'bar',data:{labels:sd.map(([s])=>SEG_LABELS[s]||s),datasets:[{data:sd.map(([,v])=>v),backgroundColor:sd.map(([s])=>segC(s)),borderRadius:6}]},options:{...defs(),plugins:{...defs().plugins,legend:{display:false},datalabels:dlabel(v=>v.toFixed(1))},scales:{x:{display:true,ticks:{color:css('--text-primary'),font:{size:10}},grid:{display:false},border:{display:false}},y:{display:false}}}});
}

/* ═══════════════════════════════════════
   EVENTS
   ═══════════════════════════════════════ */

function bindEvents() {
    document.getElementById('themeToggle')?.addEventListener('click', ()=>{
        const h=document.documentElement, isDark=h.getAttribute('data-theme')!=='light';
        h.setAttribute('data-theme',isDark?'light':'dark'); localStorage.setItem('theme',isDark?'light':'dark');
        document.getElementById('themeToggle').textContent=isDark?'☾':'☀'; mountCharts();
    });
    document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.section)));
    document.getElementById('fTri')?.addEventListener('change',e=>{APP.filters.trimestre=e.target.value;APP.sort={col:null,dir:'desc'};render();});
    document.getElementById('fSeg')?.addEventListener('change',e=>{APP.filters.segmento=e.target.value;APP.filters.instituicao='';APP.sort={col:null,dir:'desc'};render();});
    document.getElementById('fInst')?.addEventListener('change',e=>{APP.filters.instituicao=e.target.value;APP.sort={col:null,dir:'desc'};render();});
    // Sortable table headers
    document.querySelectorAll('th.sortable').forEach(th=>{
        th.addEventListener('click',()=>{
            const col=th.dataset.sort;
            if(APP.sort.col===col) APP.sort.dir=APP.sort.dir==='desc'?'asc':'desc';
            else { APP.sort.col=col; APP.sort.dir='desc'; }
            render();
        });
    });
}

function showSection(id) {
    APP.activeSection=id;
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    document.getElementById(`sec-${id}`)?.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.section===id));
    mountCharts();
}

/* ─── Boot ─────────────────────────────── */
Chart.register(ChartDataLabels);
Chart.register(hierarchicalAxisPlugin);
(function(){ const s=localStorage.getItem('theme'); if(s) document.documentElement.setAttribute('data-theme',s); })();
init();
