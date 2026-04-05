/* ═══════════════════════════════════════
   BCB FINANCEIRO — Dashboard Power BI
   ═══════════════════════════════════════ */

const APP = {
    data: {},
    charts: {},
    activeSection: 'resumo',
    filters: {
        trimestre: null,
        segmento: 'todos',
        instituicao: '',
        drillDown: false,
    },
};

const SEG_HEX = { grande: '#58a6ff', outro_banco: '#d29922', cooperativa: '#5eead4' };
const SEG_LABELS = { grande: 'Grandes Bancos', outro_banco: 'Outros Bancos', cooperativa: 'Cooperativas' };
const PAL = ['#58a6ff','#5eead4','#d29922','#bc8cff','#3fb950','#f85149','#f0a050','#60a5fa','#a78bfa','#4ade80','#fb923c','#38bdf8','#e879f9','#facc15','#34d399'];

const SECTIONS = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'rentabilidade', label: 'Rentabilidade' },
    { id: 'credito', label: 'Crédito' },
    { id: 'taxas', label: 'Taxas de Juros' },
    { id: 'concentracao', label: 'Concentração' },
    { id: 'comparativo', label: 'Bancos vs Coops' },
    { id: 'geografico', label: 'Mapa' },
    { id: 'reclamacoes', label: 'Reclamações' },
];

const FMT = {
    brl: v => v >= 1e12 ? `R$ ${(v/1e12).toFixed(1)} tri` : v >= 1e9 ? `R$ ${(v/1e9).toFixed(1)} bi` : v >= 1e6 ? `R$ ${(v/1e6).toFixed(0)} mi` : `R$ ${v.toLocaleString('pt-BR')}`,
    pct: (v,d=2) => `${v.toFixed(d)}%`,
    tri: dt => { const q={'03':'1T','06':'2T','09':'3T','12':'4T'}[dt.slice(4)]||''; return `${q}/${dt.slice(0,4)}`; },
};

function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function segC(s) { return SEG_HEX[s]||'#6e7681'; }

/* ─── Data helpers ─────────────────────── */

function getTris() {
    const ind = APP.data.indicadores?.trimestres;
    return ind ? Object.keys(ind).sort() : [];
}

function activeTri() {
    const tris = getTris();
    const f = APP.filters.trimestre;
    return (f && tris.includes(f)) ? f : tris[tris.length-1] || null;
}

function getAgregado(tri) {
    const t = APP.data.indicadores?.trimestres?.[tri];
    return t?.agregado || [];
}

function getSingulares(tri, sistema) {
    const t = APP.data.indicadores?.trimestres?.[tri];
    return t?.singulares?.[sistema] || [];
}

function filtered(tri) {
    let data = getAgregado(tri).filter(i => i.ativo_total > 0);
    const f = APP.filters;
    if (f.segmento !== 'todos') data = data.filter(i => i.segmento === f.segmento);
    if (f.instituicao) data = data.filter(i => i.nome === f.instituicao);
    return data;
}

function allInstNames() {
    const tri = activeTri();
    if (!tri) return [];
    let data = getAgregado(tri);
    if (APP.filters.segmento !== 'todos') data = data.filter(i => i.segmento === APP.filters.segmento);
    return [...new Set(data.map(i => i.nome))].sort();
}

/* ─── Init ─────────────────────────────── */

async function init() {
    const files = ['credito','taxas','resultados','indicadores','concentracao','estban','reclamacoes','instituicoes'];
    try {
        const results = await Promise.allSettled(files.map(f => fetch(`data/${f}.json`).then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })));
        let n = 0;
        files.forEach((f,i) => { if(results[i].status==='fulfilled') { APP.data[f]=results[i].value; n++; } else { APP.data[f]=null; }});
        if (n===0) { document.getElementById('app').innerHTML='<div class="loading" style="color:var(--accent-red)"><p>Erro ao carregar dados.</p></div>'; return; }
    } catch(e) { return; }
    render();
}

/* ─── Render ───────────────────────────── */

function render() {
    try {
        const el = document.getElementById('app');
        el.innerHTML = renderHeader() + renderNav() + renderToolbar() + renderKPIs() + renderSections() + renderFooter();
        bindEvents();
        showSection(APP.activeSection);
    } catch(e) { console.error('Render error:', e); }
}

function renderHeader() {
    const ts = APP.data.credito?.last_updated?.slice(0,10)||'';
    return `<header class="header">
        <div class="header-left"><div class="header-logo"><span>BCB</span> Financeiro</div><span class="header-badge">SFN</span></div>
        <div class="header-right"><span class="header-timestamp">Atualizado: ${ts}</span><button class="theme-toggle" id="themeToggle">☀</button></div>
    </header>`;
}

function renderNav() {
    return `<nav class="nav">${SECTIONS.map(s => `<button class="nav-btn${s.id===APP.activeSection?' active':''}" data-section="${s.id}">${s.label}</button>`).join('')}</nav>`;
}

function renderToolbar() {
    const tris = getTris();
    const at = activeTri();
    const insts = allInstNames();
    const f = APP.filters;
    return `<div class="filter-toolbar">
        <div class="filter-field">
            <label>Período</label>
            <select class="filter-select" id="fTri">
                ${tris.map(t => `<option value="${t}"${t===at?' selected':''}>${FMT.tri(t)}</option>`).join('')}
            </select>
        </div>
        <div class="filter-field">
            <label>Segmento</label>
            <select class="filter-select" id="fSeg">
                <option value="todos"${f.segmento==='todos'?' selected':''}>Todos</option>
                ${Object.entries(SEG_LABELS).map(([k,v]) => `<option value="${k}"${f.segmento===k?' selected':''}>${v}</option>`).join('')}
            </select>
        </div>
        <div class="filter-divider"></div>
        <div class="filter-field">
            <label>Instituição</label>
            <select class="filter-select" id="fInst" style="min-width:200px">
                <option value="">Todas</option>
                ${insts.map(n => `<option value="${n}"${f.instituicao===n?' selected':''}>${n}</option>`).join('')}
            </select>
        </div>
        <button class="filter-toggle${f.drillDown?' active':''}" id="fDrill" title="Expandir cooperativas singulares">Singulares</button>
    </div>`;
}

function renderKPIs() {
    const cred = APP.data.credito?.series;
    const tri = activeTri();
    const conc = APP.data.concentracao?.trimestres?.[tri];
    const ct = cred?.credito_total?.ultimo?.valor;
    const inad = cred?.inadimplencia?.ultimo?.valor;
    const spr = cred?.spread_total?.ultimo?.valor;
    const t5 = conc?.top5_share_ativo;
    return `<div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">Crédito Total SFN</div><div class="kpi-value">${ct?FMT.brl(ct*1e6):'—'}</div><div class="kpi-detail">Saldo total do sistema</div></div>
        <div class="kpi-card"><div class="kpi-label">Inadimplência</div><div class="kpi-value">${inad?FMT.pct(inad):'—'}</div><div class="kpi-detail">Atraso &gt;90 dias</div></div>
        <div class="kpi-card"><div class="kpi-label">Spread Bancário</div><div class="kpi-value">${spr?FMT.pct(spr,1):'—'}</div><div class="kpi-detail">Diferença captação vs empréstimo</div></div>
        <div class="kpi-card"><div class="kpi-label">Top 5 — Share</div><div class="kpi-value">${t5?FMT.pct(t5,1):'—'}</div><div class="kpi-detail">Concentração por ativo (${tri?FMT.tri(tri):''})</div></div>
    </div>`;
}

function renderFooter() {
    return `<footer class="footer">Fonte: <a href="https://www.bcb.gov.br" target="_blank">Banco Central do Brasil</a> — IF.data, SGS, Olinda<br><a href="https://github.com/Fexndev/bcb-financeiro" target="_blank">GitHub</a></footer>`;
}

function renderSections() { return SECTIONS.map(s => `<div class="section" id="sec-${s.id}">${renderSection(s.id)}</div>`).join(''); }

function renderSection(id) {
    const fn = { resumo:renderResumo, rentabilidade:renderRentabilidade, credito:renderCredito, taxas:renderTaxas, concentracao:renderConcentracao, comparativo:renderComparativo, geografico:renderGeografico, reclamacoes:renderReclamacoes };
    return fn[id]?.() || '';
}

/* ─── RESUMO ───────────────────────────── */

function renderResumo() {
    const tri = activeTri();
    if (!tri) return '<p>Dados indisponíveis</p>';
    const data = filtered(tri).sort((a,b)=>b.ativo_total-a.ativo_total).slice(0,20);
    return `
    <div class="section-title">Visão Geral — ${FMT.tri(tri)}</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">Top 10 ROE (%)</div><div class="chart-container-sm"><canvas id="c-roe-top"></canvas></div></div>
        <div class="card"><div class="card-title">Evolução do Crédito Total</div><div class="chart-container-sm"><canvas id="c-cred-evo"></canvas></div></div>
    </div>
    <div class="card"><div class="card-title">Principais Instituições</div><div class="table-wrap">
        <table><thead><tr><th>#</th><th>Instituição</th><th>Segmento</th><th class="td-right">Ativo Total</th><th class="td-right">ROE</th><th class="td-right">ROA</th><th class="td-right">Basileia</th></tr></thead>
        <tbody>${data.map((i,x) => `<tr><td class="td-mono">${x+1}</td><td class="td-name">${i.nome}${i.qtd_singulares>1?' <span style="color:var(--text-muted);font-size:.7rem">('+i.qtd_singulares+')</span>':''}</td><td><span class="td-seg seg-${i.segmento}">${SEG_LABELS[i.segmento]||i.segmento}</span></td><td class="td-mono td-right">${FMT.brl(i.ativo_total)}</td><td class="td-mono td-right ${i.roe>0?'badge-positive':'badge-negative'}">${i.roe!=null?FMT.pct(i.roe):'—'}</td><td class="td-mono td-right">${i.roa!=null?FMT.pct(i.roa,3):'—'}</td><td class="td-mono td-right">${i.indice_basileia!=null?FMT.pct(i.indice_basileia*100,1):'—'}</td></tr>`).join('')}</tbody></table>
    </div></div>
    ${APP.filters.drillDown && APP.filters.instituicao ? renderDrillDown(tri) : ''}`;
}

function renderDrillDown(tri) {
    const nome = APP.filters.instituicao;
    const sings = getSingulares(tri, nome);
    if (!sings.length) return '';
    return `<div class="card"><div class="card-title">Singulares — ${nome} (${sings.length})</div><div class="table-wrap">
        <table><thead><tr><th>#</th><th>Nome</th><th>UF</th><th class="td-right">Ativo</th><th class="td-right">Crédito</th><th class="td-right">ROE</th></tr></thead>
        <tbody>${sings.map((s,i) => `<tr><td class="td-mono">${i+1}</td><td class="td-name">${s.nome}</td><td>${s.uf||''}</td><td class="td-mono td-right">${FMT.brl(s.ativo_total)}</td><td class="td-mono td-right">${FMT.brl(s.carteira_credito)}</td><td class="td-mono td-right">${s.roe!=null?FMT.pct(s.roe):'—'}</td></tr>`).join('')}</tbody></table>
    </div></div>`;
}

/* ─── RENTABILIDADE ────────────────────── */

function renderRentabilidade() {
    const tri = activeTri();
    if (!tri) return '<p>Dados indisponíveis</p>';
    return `<div class="section-title">Rentabilidade — ${FMT.tri(tri)}</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">ROE por Instituição</div><div class="chart-container"><canvas id="c-roe"></canvas></div></div>
        <div class="card"><div class="card-title">Evolução ROE Médio por Segmento</div><div class="chart-container"><canvas id="c-roe-evo"></canvas></div></div>
    </div>`;
}

/* ─── CRÉDITO ──────────────────────────── */

function renderCredito() {
    return `<div class="section-title">Crédito e Inadimplência</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">Crédito PF vs PJ</div><div class="chart-container"><canvas id="c-cred-pfpj"></canvas></div></div>
        <div class="card"><div class="card-title">Inadimplência (%)</div><div class="chart-container"><canvas id="c-inad"></canvas></div></div>
    </div>
    <div class="card"><div class="card-title">Spread Bancário</div><div class="chart-container-sm"><canvas id="c-spread"></canvas></div></div>`;
}

/* ─── TAXAS ────────────────────────────── */

function renderTaxas() {
    const tx = APP.data.taxas?.modalidades;
    if (!tx) return '<p>Dados indisponíveis</p>';
    const mods = Object.entries(tx).filter(([,v])=>!v.erro);
    return `<div class="section-title">Taxas de Juros</div>
    <div class="card"><div class="card-title">Taxa Média Anual por Modalidade</div><div class="chart-container"><canvas id="c-taxas"></canvas></div></div>
    <div class="card"><div class="card-title">Comparativo por Segmento (% a.a.)</div><div class="table-wrap"><table>
        <thead><tr><th>Modalidade</th>${Object.values(SEG_LABELS).map(v=>`<th class="td-right">${v}</th>`).join('')}</tr></thead>
        <tbody>${mods.map(([,m])=>`<tr><td class="td-name">${m.descricao}</td>${Object.keys(SEG_LABELS).map(s=>{const v=m.media_por_segmento?.[s]; return `<td class="td-mono td-right">${v?FMT.pct(v,1):'—'}</td>`;}).join('')}</tr>`).join('')}</tbody>
    </table></div></div>`;
}

/* ─── CONCENTRAÇÃO ─────────────────────── */

function renderConcentracao() {
    const tri = activeTri();
    if (!tri) return '<p>Dados indisponíveis</p>';
    return `<div class="section-title">Concentração — ${FMT.tri(tri)}</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">Market Share — Ativo</div><div class="chart-container"><canvas id="c-share"></canvas></div></div>
        <div class="card"><div class="card-title">Share por Segmento</div><div class="chart-container"><canvas id="c-share-seg"></canvas></div></div>
    </div>
    <div class="card"><div class="card-title">Evolução HHI e Top 5</div><div class="chart-container-sm"><canvas id="c-hhi"></canvas></div></div>`;
}

/* ─── COMPARATIVO ──────────────────────── */

function renderComparativo() {
    return `<div class="section-title">Grandes Bancos vs Cooperativas</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">ROE Médio por Segmento</div><div class="chart-container"><canvas id="c-comp-roe"></canvas></div></div>
        <div class="card"><div class="card-title">Taxas Comparadas (% a.a.)</div><div class="chart-container"><canvas id="c-comp-tx"></canvas></div></div>
    </div>`;
}

/* ─── GEOGRÁFICO ───────────────────────── */

function renderGeografico() {
    const e = APP.data.estban;
    if (!e?.por_uf) return '<p>Dados indisponíveis</p>';
    const ufs = [...e.por_uf].sort((a,b)=>b.credito_per_capita-a.credito_per_capita);
    const mx = ufs[0]?.credito_per_capita||1;
    return `<div class="section-title">Crédito por UF</div>
    <div class="card"><div class="card-title">Crédito Per Capita (R$ mil / hab)</div><div class="chart-container"><canvas id="c-geo"></canvas></div></div>
    <div class="card"><div class="card-title">Ranking por UF</div><div class="map-legend">${ufs.map(u=>`<div class="legend-item"><span class="legend-uf">${u.uf}</span><span class="legend-value">R$ ${u.credito_per_capita.toLocaleString('pt-BR',{maximumFractionDigits:0})} mil</span><div style="flex:1;margin-left:12px"><div class="legend-bar" style="width:${(u.credito_per_capita/mx*100).toFixed(0)}%"></div></div></div>`).join('')}</div></div>`;
}

/* ─── RECLAMAÇÕES ──────────────────────── */

function renderReclamacoes() {
    if (!APP.data.reclamacoes) return '<p>Dados indisponíveis</p>';
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
    const t=css('--text-secondary'), m=css('--text-muted'), b=css('--border');
    return {
        responsive:true, maintainAspectRatio:false,
        plugins: { legend:{labels:{color:t,font:{family:"'Inter'",size:11}}}, datalabels:{display:false} },
        scales: {
            x: { ticks:{color:m,font:{size:10}}, grid:{color:b+'30'}, border:{display:false} },
            y: hideY ? {display:false} : { ticks:{color:m,font:{size:10}}, grid:{color:b+'30'}, border:{display:false} },
        },
    };
}

function dlabel(fmt) {
    return { display:true, color:css('--text-primary'), font:{family:"'JetBrains Mono'",size:10,weight:600}, anchor:'end', align:'end', offset:2, formatter:fmt||(v=>v?.toFixed?.(1)) };
}

function hbar(labels, values, colors, fmtFn) {
    return {
        type:'bar', data:{ labels, datasets:[{ data:values, backgroundColor:colors, borderRadius:6 }] },
        options: { ...defs(), indexAxis:'y',
            plugins: { ...defs().plugins, legend:{display:false}, datalabels:dlabel(fmtFn) },
            scales: { x:{display:false}, y:{display:true, ticks:{color:css('--text-primary'),font:{size:10}}, grid:{display:false}, border:{display:false}} },
        },
    };
}

function destroyCharts() { Object.values(APP.charts).forEach(c=>c.destroy()); APP.charts={}; }

function mountCharts() {
    destroyCharts();
    try { ({resumo:mResumo,rentabilidade:mRent,credito:mCred,taxas:mTaxas,concentracao:mConc,comparativo:mComp,geografico:mGeo,reclamacoes:mRec})[APP.activeSection]?.(); } catch(e) { console.error('Chart:',e); }
}

/* ─── Resumo charts ────────────────────── */

function mResumo() {
    const tri = activeTri();
    const data = filtered(tri).filter(i=>i.roe!=null&&i.ativo_total>1e9).sort((a,b)=>b.roe-a.roe).slice(0,10);
    const ctx = document.getElementById('c-roe-top');
    if (ctx && data.length) APP.charts.a = new Chart(ctx, hbar(data.map(i=>i.nome), data.map(i=>i.roe), data.map((_,i)=>PAL[i%PAL.length]), v=>v.toFixed(1)+'%'));

    const cr = APP.data.credito?.series?.credito_total?.monthly;
    if (cr) {
        const d = cr.slice(-24);
        const ctx2 = document.getElementById('c-cred-evo');
        if (ctx2) APP.charts.b = new Chart(ctx2, { type:'line', data:{ labels:d.map(m=>m.data), datasets:[{data:d.map(m=>m.valor),borderColor:'#5eead4',backgroundColor:'rgba(94,234,212,.1)',fill:true,tension:.3,pointRadius:0}] }, options:{...defs(false),plugins:{legend:{display:false},datalabels:{display:false}},scales:{x:{...defs().scales.x},y:{ticks:{color:css('--text-muted'),callback:v=>(v/1e6).toFixed(1)+' tri'},grid:{color:css('--border')+'30'},border:{display:false}}}} });
    }
}

/* ─── Rentabilidade charts ─────────────── */

function mRent() {
    const tri = activeTri();
    const data = filtered(tri).filter(i=>i.roe!=null&&i.ativo_total>1e9).sort((a,b)=>b.roe-a.roe).slice(0,15);
    const ctx = document.getElementById('c-roe');
    if (ctx && data.length) APP.charts.c = new Chart(ctx, hbar(data.map(i=>i.nome), data.map(i=>i.roe), data.map(i=>segC(i.segmento)), v=>v.toFixed(1)+'%'));

    const tris = getTris();
    const ind = APP.data.indicadores?.trimestres;
    const segs = Object.keys(SEG_LABELS);
    const ds = segs.map(seg=>({ label:SEG_LABELS[seg], data:tris.map(t=>{const a=(ind[t]?.agregado||[]).filter(i=>i.segmento===seg&&i.roe!=null); return a.length?+(a.reduce((s,i)=>s+i.roe,0)/a.length).toFixed(2):null;}), borderColor:segC(seg), backgroundColor:'transparent', tension:.3, pointRadius:3 }));
    const ctx2 = document.getElementById('c-roe-evo');
    if (ctx2) APP.charts.d = new Chart(ctx2, { type:'line', data:{labels:tris.map(FMT.tri),datasets:ds}, options:{...defs(false),plugins:{...defs(false).plugins,datalabels:{display:false}},scales:{x:{...defs().scales.x},y:{ticks:{color:css('--text-muted'),callback:v=>v+'%'},grid:{color:css('--border')+'30'},border:{display:false}}}} });
}

/* ─── Crédito charts ───────────────────── */

function mCred() {
    const s = APP.data.credito?.series;
    if (!s) return;
    const lineOpts = (yFmt) => ({...defs(false),plugins:{legend:{labels:{color:css('--text-secondary')}},datalabels:{display:false}},scales:{x:{...defs().scales.x},y:{ticks:{color:css('--text-muted'),callback:yFmt},grid:{color:css('--border')+'30'},border:{display:false}}}});

    const pf=s.credito_pf?.monthly?.slice(-24)||[], pj=s.credito_pj?.monthly?.slice(-24)||[];
    const c1=document.getElementById('c-cred-pfpj');
    if(c1&&pf.length) APP.charts.e=new Chart(c1,{type:'line',data:{labels:pf.map(m=>m.data),datasets:[{label:'PF',data:pf.map(m=>m.valor),borderColor:'#58a6ff',tension:.3,pointRadius:0},{label:'PJ',data:pj.map(m=>m.valor),borderColor:'#d29922',tension:.3,pointRadius:0}]},options:lineOpts(v=>(v/1e6).toFixed(1)+' tri')});

    const i=s.inadimplencia?.monthly?.slice(-24)||[],ipf=s.inadimplencia_pf?.monthly?.slice(-24)||[],ipj=s.inadimplencia_pj?.monthly?.slice(-24)||[];
    const c2=document.getElementById('c-inad');
    if(c2&&i.length) APP.charts.f=new Chart(c2,{type:'line',data:{labels:i.map(m=>m.data),datasets:[{label:'Total',data:i.map(m=>m.valor),borderColor:'#f85149',tension:.3,pointRadius:0,borderWidth:2},{label:'PF',data:ipf.map(m=>m.valor),borderColor:'#58a6ff',tension:.3,pointRadius:0,borderDash:[5,3]},{label:'PJ',data:ipj.map(m=>m.valor),borderColor:'#d29922',tension:.3,pointRadius:0,borderDash:[5,3]}]},options:lineOpts(v=>v+'%')});

    const sp=s.spread_total?.monthly?.slice(-24)||[],spf=s.spread_pf?.monthly?.slice(-24)||[];
    const c3=document.getElementById('c-spread');
    if(c3&&sp.length) APP.charts.g=new Chart(c3,{type:'line',data:{labels:sp.map(m=>m.data),datasets:[{label:'Total',data:sp.map(m=>m.valor),borderColor:'#5eead4',tension:.3,pointRadius:0},{label:'PF',data:spf.map(m=>m.valor),borderColor:'#bc8cff',tension:.3,pointRadius:0}]},options:lineOpts(v=>v+' p.p.')});
}

/* ─── Taxas charts ─────────────────────── */

function mTaxas() {
    const tx = APP.data.taxas?.modalidades;
    if (!tx) return;
    const mods = Object.entries(tx).filter(([,v])=>!v.erro&&v.media_geral);
    const ctx = document.getElementById('c-taxas');
    if (ctx) APP.charts.h = new Chart(ctx, hbar(mods.map(([,v])=>v.descricao), mods.map(([,v])=>v.media_geral), mods.map((_,i)=>PAL[i%PAL.length]), v=>v.toFixed(1)+'%'));
}

/* ─── Concentração charts ──────────────── */

function mConc() {
    const conc = APP.data.concentracao?.trimestres;
    if (!conc) return;
    const tri = activeTri(); const last = conc[tri]; if (!last) return;

    const top10 = last.ranking_ativo.slice(0,10);
    const outros = 100 - top10.reduce((s,i)=>s+i.share,0);
    const c1 = document.getElementById('c-share');
    if(c1) APP.charts.i=new Chart(c1,{type:'doughnut',data:{labels:[...top10.map(i=>i.nome),'Outros'],datasets:[{data:[...top10.map(i=>i.share),outros],backgroundColor:[...PAL.slice(0,10),'#3b4654'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:css('--text-secondary'),font:{size:10},boxWidth:10,padding:6}},datalabels:{color:'#fff',font:{size:9,weight:700},formatter:v=>v>3?v.toFixed(1)+'%':''}}}});

    const ss = last.share_por_segmento;
    const segs = Object.entries(ss).sort((a,b)=>b[1]-a[1]);
    const c2 = document.getElementById('c-share-seg');
    if(c2) APP.charts.j=new Chart(c2,{type:'doughnut',data:{labels:segs.map(([s])=>SEG_LABELS[s]||s),datasets:[{data:segs.map(([,v])=>v),backgroundColor:segs.map(([s])=>segC(s)),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:css('--text-secondary'),font:{size:11},boxWidth:10,padding:6}},datalabels:{color:'#fff',font:{size:11,weight:700},formatter:v=>v>3?v.toFixed(1)+'%':''}}}});

    const tris = Object.keys(conc).sort();
    const c3 = document.getElementById('c-hhi');
    if(c3) APP.charts.k=new Chart(c3,{type:'line',data:{labels:tris.map(FMT.tri),datasets:[{label:'HHI',data:tris.map(t=>conc[t].hhi_ativo),borderColor:'#5eead4',tension:.3,pointRadius:3,yAxisID:'y'},{label:'Top 5 %',data:tris.map(t=>conc[t].top5_share_ativo),borderColor:'#58a6ff',tension:.3,pointRadius:3,yAxisID:'y1'}]},options:{...defs(false),plugins:{...defs(false).plugins,datalabels:{display:false}},scales:{x:{...defs().scales.x},y:{position:'left',ticks:{color:css('--text-muted')},grid:{color:css('--border')+'30'},border:{display:false}},y1:{position:'right',ticks:{color:css('--text-muted')},grid:{display:false},border:{display:false}}}}});
}

/* ─── Comparativo charts ───────────────── */

function mComp() {
    const ind = APP.data.indicadores?.trimestres; if (!ind) return;
    const tris = getTris();
    const segs = Object.keys(SEG_LABELS);
    const ds = segs.map(seg=>({ label:SEG_LABELS[seg], data:tris.map(t=>{const a=(ind[t]?.agregado||[]).filter(i=>i.segmento===seg&&i.roe!=null); return a.length?+(a.reduce((s,i)=>s+i.roe,0)/a.length).toFixed(2):null;}), borderColor:segC(seg), backgroundColor:'transparent', tension:.3, pointRadius:3 }));
    const c1=document.getElementById('c-comp-roe');
    if(c1) APP.charts.l=new Chart(c1,{type:'line',data:{labels:tris.map(FMT.tri),datasets:ds},options:{...defs(false),plugins:{...defs(false).plugins,datalabels:{display:false}},scales:{x:{...defs().scales.x},y:{ticks:{color:css('--text-muted'),callback:v=>v+'%'},grid:{color:css('--border')+'30'},border:{display:false}}}}});

    const tx = APP.data.taxas?.modalidades; if(!tx) return;
    const mc = ['consignado_inss','credito_pessoal','veiculos','cheque_especial','capital_giro_curto'];
    const ml = mc.map(m=>tx[m]?.descricao?.slice(0,18)||m);
    const tds = segs.map(seg=>({label:SEG_LABELS[seg],data:mc.map(m=>tx[m]?.media_por_segmento?.[seg]||null),backgroundColor:segC(seg),borderRadius:6}));
    const c2=document.getElementById('c-comp-tx');
    if(c2) APP.charts.m=new Chart(c2,{type:'bar',data:{labels:ml,datasets:tds},options:{...defs(false),plugins:{...defs(false).plugins,datalabels:{display:false}},scales:{x:{...defs().scales.x},y:{ticks:{color:css('--text-muted'),callback:v=>v+'%'},grid:{color:css('--border')+'30'},border:{display:false}}}}});
}

/* ─── Geográfico charts ────────────────── */

function mGeo() {
    const e = APP.data.estban; if(!e?.por_uf) return;
    const ufs = [...e.por_uf].sort((a,b)=>b.credito_per_capita-a.credito_per_capita);
    const ctx = document.getElementById('c-geo');
    if(ctx) APP.charts.n=new Chart(ctx,{type:'bar',data:{labels:ufs.map(u=>u.uf),datasets:[{data:ufs.map(u=>u.credito_per_capita),backgroundColor:ufs.map((_,i)=>`rgba(94,234,212,${.3+((ufs.length-i)/ufs.length)*.7})`),borderRadius:6}]},options:{...defs(),plugins:{...defs().plugins,legend:{display:false},datalabels:dlabel(v=>'R$ '+v.toLocaleString('pt-BR',{maximumFractionDigits:0}))},scales:{x:{...defs().scales.x,ticks:{color:css('--text-primary'),font:{size:9,weight:600}}},y:{display:false}}}});
}

/* ─── Reclamações charts ───────────────── */

function mRec() {
    const r = APP.data.reclamacoes; if(!r) return;
    const rk = [...r.ranking].sort((a,b)=>b.indice-a.indice);
    const c1=document.getElementById('c-rec');
    if(c1) APP.charts.o=new Chart(c1, hbar(rk.map(r=>r.instituicao), rk.map(r=>r.indice), rk.map(r=>segC(r.segmento)), v=>v.toFixed(1)));

    const sd = Object.entries(r.media_por_segmento).sort((a,b)=>b[1]-a[1]);
    const c2=document.getElementById('c-rec-seg');
    if(c2) APP.charts.p=new Chart(c2,{type:'bar',data:{labels:sd.map(([s])=>SEG_LABELS[s]||s),datasets:[{data:sd.map(([,v])=>v),backgroundColor:sd.map(([s])=>segC(s)),borderRadius:6}]},options:{...defs(),plugins:{...defs().plugins,legend:{display:false},datalabels:dlabel(v=>v.toFixed(1))},scales:{x:{...defs().scales.x},y:{display:false}}}});
}

/* ═══════════════════════════════════════
   EVENTS
   ═══════════════════════════════════════ */

function bindEvents() {
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        const h = document.documentElement;
        const isDark = h.getAttribute('data-theme')!=='light';
        h.setAttribute('data-theme', isDark?'light':'dark');
        localStorage.setItem('theme', isDark?'light':'dark');
        document.getElementById('themeToggle').textContent = isDark?'☾':'☀';
        mountCharts();
    });
    document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', ()=>showSection(b.dataset.section)));
    document.getElementById('fTri')?.addEventListener('change', e=>{ APP.filters.trimestre=e.target.value; render(); });
    document.getElementById('fSeg')?.addEventListener('change', e=>{ APP.filters.segmento=e.target.value; APP.filters.instituicao=''; render(); });
    document.getElementById('fInst')?.addEventListener('change', e=>{ APP.filters.instituicao=e.target.value; render(); });
    document.getElementById('fDrill')?.addEventListener('click', ()=>{ APP.filters.drillDown=!APP.filters.drillDown; render(); });
}

function showSection(id) {
    APP.activeSection = id;
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    document.getElementById(`sec-${id}`)?.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.section===id));
    mountCharts();
}

/* ─── Boot ─────────────────────────────── */

Chart.register(ChartDataLabels);

(function(){ const s=localStorage.getItem('theme'); if(s) document.documentElement.setAttribute('data-theme',s); })();

init();
