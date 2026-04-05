/* ═══════════════════════════════════════
   BCB FINANCEIRO — Dashboard
   ═══════════════════════════════════════ */

const APP = {
    data: {},
    charts: {},
    activeSection: 'resumo',
    segFilter: 'todos',
    triFilter: null,  // null = último disponível
};

const SEG_COLORS_HEX = {
    grande:       '#58a6ff',
    outro_banco:  '#d29922',
    cooperativa:  '#5eead4',
};

const SEG_LABELS = {
    grande:       'Grandes Bancos',
    outro_banco:  'Outros Bancos',
    cooperativa:  'Cooperativas',
};

const PALETTE = ['#58a6ff','#5eead4','#d29922','#bc8cff','#3fb950','#f85149','#f0a050','#60a5fa','#a78bfa','#4ade80','#fb923c','#38bdf8','#e879f9','#facc15','#34d399'];

const SECTIONS = [
    { id: 'resumo',        label: 'Resumo' },
    { id: 'rentabilidade', label: 'Rentabilidade' },
    { id: 'credito',       label: 'Crédito' },
    { id: 'taxas',         label: 'Taxas de Juros' },
    { id: 'concentracao',  label: 'Concentração' },
    { id: 'comparativo',   label: 'Bancos vs Coops' },
    { id: 'geografico',    label: 'Mapa' },
    { id: 'reclamacoes',   label: 'Reclamações' },
];

const FMT = {
    brl: v => v >= 1e12 ? `R$ ${(v/1e12).toFixed(1)} tri`
           : v >= 1e9  ? `R$ ${(v/1e9).toFixed(1)} bi`
           : v >= 1e6  ? `R$ ${(v/1e6).toFixed(0)} mi`
           : `R$ ${v.toLocaleString('pt-BR')}`,
    pct: (v, d=2) => `${v.toFixed(d)}%`,
    num: v => v.toLocaleString('pt-BR'),
    tri: dt => {
        const y = dt.slice(0,4);
        const q = {'03':'1T','06':'2T','09':'3T','12':'4T'}[dt.slice(4)] || dt.slice(4);
        return `${q}/${y}`;
    },
};

function segColor(seg) { return SEG_COLORS_HEX[seg] || '#6e7681'; }

function getActiveTri() {
    const ind = APP.data.indicadores?.trimestres;
    if (!ind) return null;
    const tris = Object.keys(ind).sort();
    return APP.triFilter && tris.includes(APP.triFilter) ? APP.triFilter : tris[tris.length - 1];
}

function getAllTris() {
    const ind = APP.data.indicadores?.trimestres;
    return ind ? Object.keys(ind).sort() : [];
}

/* ─── Init ─────────────────────────────── */

async function init() {
    const files = ['credito','taxas','resultados','indicadores','concentracao','estban','reclamacoes','instituicoes'];
    try {
        const results = await Promise.allSettled(
            files.map(f => fetch(`data/${f}.json`).then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status} for ${f}`);
                return r.json();
            }))
        );
        let loaded = 0;
        files.forEach((f, i) => {
            if (results[i].status === 'fulfilled') {
                APP.data[f] = results[i].value;
                loaded++;
            } else {
                APP.data[f] = null;
                console.error(`Erro ao carregar ${f}:`, results[i].reason);
            }
        });
        console.log(`BCB Financeiro: ${loaded}/${files.length} arquivos carregados`);
        if (loaded === 0) {
            document.getElementById('app').innerHTML = `
                <div class="loading" style="color:var(--accent-red)">
                    <p>Erro ao carregar dados.</p>
                    <p style="font-size:.8rem;color:var(--text-muted)">Acesse via servidor HTTP, não file://</p>
                </div>`;
            return;
        }
    } catch (e) {
        console.error('Erro fatal:', e);
        return;
    }
    render();
}

/* ─── Render ───────────────────────────── */

function render() {
    try {
        const el = document.getElementById('app');
        el.innerHTML = renderHeader() + renderNav() + renderGlobalFilters() + renderKPIs() + renderSections() + renderFooter();
        bindEvents();
        showSection(APP.activeSection);
    } catch (e) {
        console.error('Erro no render:', e);
        document.getElementById('app').innerHTML = `<div class="loading" style="color:var(--accent-red)"><p>Erro: ${e.message}</p></div>`;
    }
}

function renderHeader() {
    const ts = APP.data.credito?.last_updated?.slice(0,10) || '';
    return `
    <header class="header">
        <div class="header-left">
            <div class="header-logo"><span>BCB</span> Financeiro</div>
            <span class="header-badge">SFN</span>
        </div>
        <div class="header-right">
            <span class="header-timestamp">Atualizado: ${ts}</span>
            <button class="theme-toggle" id="themeToggle" title="Alternar tema">☀</button>
        </div>
    </header>`;
}

function renderNav() {
    return `<nav class="nav">${SECTIONS.map(s =>
        `<button class="nav-btn${s.id === APP.activeSection ? ' active' : ''}" data-section="${s.id}">${s.label}</button>`
    ).join('')}</nav>`;
}

function renderGlobalFilters() {
    const tris = getAllTris();
    const activeTri = getActiveTri();
    return `<div class="global-filters">
        <div class="filter-group">
            <span class="filter-label">Período:</span>
            <div class="filter-bar">
                ${tris.map(t => `<button class="filter-chip tri-filter${t === activeTri ? ' active' : ''}" data-tri="${t}">${FMT.tri(t)}</button>`).join('')}
            </div>
        </div>
        <div class="filter-group">
            <span class="filter-label">Segmento:</span>
            <div class="filter-bar">
                <button class="filter-chip seg-filter${APP.segFilter === 'todos' ? ' active' : ''}" data-seg="todos">Todos</button>
                ${Object.entries(SEG_LABELS).map(([k,v]) =>
                    `<button class="filter-chip seg-filter${APP.segFilter === k ? ' active' : ''}" data-seg="${k}">${v}</button>`
                ).join('')}
            </div>
        </div>
    </div>`;
}

function renderKPIs() {
    const cred = APP.data.credito?.series;
    const conc = APP.data.concentracao?.trimestres;
    const activeTri = getActiveTri();

    const creditoTotal = cred?.credito_total?.ultimo?.valor;
    const inadimplencia = cred?.inadimplencia?.ultimo?.valor;
    const spread = cred?.spread_total?.ultimo?.valor;
    const top5 = activeTri && conc?.[activeTri] ? conc[activeTri].top5_share_ativo : null;

    return `<div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-label">Crédito Total SFN</div>
            <div class="kpi-value">${creditoTotal ? FMT.brl(creditoTotal * 1e6) : '—'}</div>
            <div class="kpi-detail">Saldo total do sistema</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Inadimplência</div>
            <div class="kpi-value">${inadimplencia ? FMT.pct(inadimplencia) : '—'}</div>
            <div class="kpi-detail">Atraso &gt;90 dias</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Spread Bancário</div>
            <div class="kpi-value">${spread ? FMT.pct(spread, 1) : '—'}</div>
            <div class="kpi-detail">Diferença captação vs empréstimo</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Top 5 — Market Share</div>
            <div class="kpi-value">${top5 ? FMT.pct(top5, 1) : '—'}</div>
            <div class="kpi-detail">Concentração por ativo (${activeTri ? FMT.tri(activeTri) : ''})</div>
        </div>
    </div>`;
}

function renderFooter() {
    return `<footer class="footer">
        Fonte: <a href="https://www.bcb.gov.br" target="_blank">Banco Central do Brasil</a> — Dados públicos (IF.data, SGS, Olinda)<br>
        <a href="https://github.com/Fexndev/bcb-financeiro" target="_blank">GitHub</a>
    </footer>`;
}

function renderSections() {
    return SECTIONS.map(s => `<div class="section" id="sec-${s.id}">${renderSection(s.id)}</div>`).join('');
}

function renderSection(id) {
    switch(id) {
        case 'resumo':        return renderResumo();
        case 'rentabilidade': return renderRentabilidade();
        case 'credito':       return renderCredito();
        case 'taxas':         return renderTaxas();
        case 'concentracao':  return renderConcentracao();
        case 'comparativo':   return renderComparativo();
        case 'geografico':    return renderGeografico();
        case 'reclamacoes':   return renderReclamacoes();
        default: return '';
    }
}

/* ─── Filtered data helpers ────────────── */

function getFilteredInsts(tri) {
    const ind = APP.data.indicadores?.trimestres?.[tri];
    if (!ind) return [];
    let data = ind.filter(i => i.ativo_total > 0);
    if (APP.segFilter !== 'todos') data = data.filter(i => i.segmento === APP.segFilter);
    return data;
}

/* ─── RESUMO ───────────────────────────── */

function renderResumo() {
    const tri = getActiveTri();
    if (!tri) return '<p>Dados indisponíveis</p>';

    return `
    <div class="section-title">Visão Geral — ${FMT.tri(tri)}</div>
    <div class="grid-2">
        <div class="card">
            <div class="card-title">Top 10 Rentabilidade (ROE)</div>
            <div class="chart-container-sm"><canvas id="chart-resumo-roe"></canvas></div>
        </div>
        <div class="card">
            <div class="card-title">Evolução do Crédito Total</div>
            <div class="chart-container-sm"><canvas id="chart-resumo-credito"></canvas></div>
        </div>
    </div>
    <div class="card">
        <div class="card-title">Principais Instituições</div>
        <div class="table-wrap">${renderTabelaResumo(tri)}</div>
    </div>`;
}

function renderTabelaResumo(tri) {
    const data = getFilteredInsts(tri).sort((a,b) => b.ativo_total - a.ativo_total).slice(0, 20);
    return `<table>
        <thead><tr>
            <th>#</th><th>Instituição</th><th>Segmento</th>
            <th class="td-right">Ativo Total</th>
            <th class="td-right">ROE</th><th class="td-right">ROA</th>
            <th class="td-right">Basileia</th>
        </tr></thead>
        <tbody>${data.map((i, idx) => `<tr>
            <td class="td-mono">${idx+1}</td>
            <td class="td-name">${i.nome}</td>
            <td><span class="td-seg seg-${i.segmento}">${SEG_LABELS[i.segmento] || i.segmento}</span></td>
            <td class="td-mono td-right">${FMT.brl(i.ativo_total)}</td>
            <td class="td-mono td-right ${i.roe > 0 ? 'badge-positive' : 'badge-negative'}">${i.roe !== null ? FMT.pct(i.roe) : '—'}</td>
            <td class="td-mono td-right">${i.roa !== null ? FMT.pct(i.roa, 3) : '—'}</td>
            <td class="td-mono td-right">${i.indice_basileia !== null ? FMT.pct(i.indice_basileia * 100, 1) : '—'}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}

/* ─── RENTABILIDADE ────────────────────── */

function renderRentabilidade() {
    const tri = getActiveTri();
    if (!tri) return '<p>Dados indisponíveis</p>';
    return `
    <div class="section-title">Rentabilidade — ${FMT.tri(tri)}</div>
    <div class="grid-2">
        <div class="card">
            <div class="card-title">ROE por Instituição</div>
            <div class="chart-container"><canvas id="chart-roe"></canvas></div>
        </div>
        <div class="card">
            <div class="card-title">Evolução do ROE Médio por Segmento</div>
            <div class="chart-container"><canvas id="chart-roe-evolucao"></canvas></div>
        </div>
    </div>`;
}

/* ─── CRÉDITO ──────────────────────────── */

function renderCredito() {
    return `
    <div class="section-title">Crédito e Inadimplência</div>
    <div class="grid-2">
        <div class="card">
            <div class="card-title">Saldo de Crédito — PF vs PJ</div>
            <div class="chart-container"><canvas id="chart-credito-pf-pj"></canvas></div>
        </div>
        <div class="card">
            <div class="card-title">Inadimplência (%)</div>
            <div class="chart-container"><canvas id="chart-inadimplencia"></canvas></div>
        </div>
    </div>
    <div class="card">
        <div class="card-title">Spread Bancário</div>
        <div class="chart-container-sm"><canvas id="chart-spread"></canvas></div>
    </div>`;
}

/* ─── TAXAS DE JUROS ───────────────────── */

function renderTaxas() {
    const taxas = APP.data.taxas?.modalidades;
    if (!taxas) return '<p>Dados indisponíveis</p>';
    const mods = Object.entries(taxas).filter(([,v]) => !v.erro);
    return `
    <div class="section-title">Taxas de Juros por Modalidade</div>
    <div class="card">
        <div class="card-title">Taxa Média Anual por Modalidade</div>
        <div class="chart-container"><canvas id="chart-taxas-media"></canvas></div>
    </div>
    <div class="card">
        <div class="card-title">Comparativo por Segmento — Taxas Médias (% a.a.)</div>
        <div class="table-wrap"><table>
            <thead><tr><th>Modalidade</th>${Object.entries(SEG_LABELS).map(([k,v]) =>
                `<th class="td-right">${v}</th>`).join('')}
            </tr></thead>
            <tbody>${mods.map(([key, mod]) => `<tr>
                <td class="td-name">${mod.descricao}</td>
                ${Object.keys(SEG_LABELS).map(s => {
                    const v = mod.media_por_segmento?.[s];
                    return `<td class="td-mono td-right">${v ? FMT.pct(v, 1) : '—'}</td>`;
                }).join('')}
            </tr>`).join('')}</tbody>
        </table></div>
    </div>
    <div class="card">
        <div class="card-title">Top 10 Menores Taxas — Consignado INSS</div>
        <div class="table-wrap">${renderTabelaTaxas('consignado_inss')}</div>
    </div>`;
}

function renderTabelaTaxas(modalidade) {
    const mod = APP.data.taxas?.modalidades?.[modalidade];
    if (!mod?.ranking) return '';
    return `<table>
        <thead><tr><th>#</th><th>Instituição</th><th>Segmento</th>
            <th class="td-right">Taxa a.m.</th><th class="td-right">Taxa a.a.</th>
        </tr></thead>
        <tbody>${mod.ranking.slice(0,10).map((r, i) => `<tr>
            <td class="td-mono">${i+1}</td>
            <td class="td-name">${r.instituicao}</td>
            <td><span class="td-seg seg-${r.segmento}">${SEG_LABELS[r.segmento] || r.segmento}</span></td>
            <td class="td-mono td-right">${r.taxa_am ? FMT.pct(r.taxa_am, 2) : '—'}</td>
            <td class="td-mono td-right">${r.taxa_aa ? FMT.pct(r.taxa_aa, 1) : '—'}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}

/* ─── CONCENTRAÇÃO ─────────────────────── */

function renderConcentracao() {
    const tri = getActiveTri();
    if (!tri) return '<p>Dados indisponíveis</p>';
    return `
    <div class="section-title">Concentração Bancária — ${FMT.tri(tri)}</div>
    <div class="grid-2">
        <div class="card">
            <div class="card-title">Market Share — Ativo Total</div>
            <div class="chart-container"><canvas id="chart-share-ativo"></canvas></div>
        </div>
        <div class="card">
            <div class="card-title">Share por Segmento</div>
            <div class="chart-container"><canvas id="chart-share-segmento"></canvas></div>
        </div>
    </div>
    <div class="card">
        <div class="card-title">Evolução do HHI e Top 5 Share</div>
        <div class="chart-container-sm"><canvas id="chart-hhi-evolucao"></canvas></div>
    </div>`;
}

/* ─── COMPARATIVO ──────────────────────── */

function renderComparativo() {
    return `
    <div class="section-title">Grandes Bancos vs Cooperativas</div>
    <div class="grid-2">
        <div class="card">
            <div class="card-title">ROE Médio por Segmento</div>
            <div class="chart-container"><canvas id="chart-comp-roe"></canvas></div>
        </div>
        <div class="card">
            <div class="card-title">Taxas Médias Comparadas (% a.a.)</div>
            <div class="chart-container"><canvas id="chart-comp-taxas"></canvas></div>
        </div>
    </div>`;
}

/* ─── GEOGRÁFICO ───────────────────────── */

function renderGeografico() {
    const estban = APP.data.estban;
    if (!estban?.por_uf) return '<p>Dados indisponíveis</p>';
    const ufs = [...estban.por_uf].sort((a,b) => b.credito_per_capita - a.credito_per_capita);
    const maxVal = ufs[0]?.credito_per_capita || 1;
    return `
    <div class="section-title">Distribuição Geográfica do Crédito</div>
    <div class="card">
        <div class="card-title">Crédito Per Capita por UF (R$ mil / habitante)</div>
        <div class="chart-container"><canvas id="chart-mapa-credito"></canvas></div>
    </div>
    <div class="card">
        <div class="card-title">Ranking por UF</div>
        <div class="map-legend">${ufs.map(u => `
            <div class="legend-item">
                <span class="legend-uf">${u.uf}</span>
                <span class="legend-value">R$ ${u.credito_per_capita.toLocaleString('pt-BR',{maximumFractionDigits:0})} mil</span>
                <div style="flex:1;margin-left:12px"><div class="legend-bar" style="width:${(u.credito_per_capita/maxVal*100).toFixed(0)}%"></div></div>
            </div>`).join('')}
        </div>
    </div>`;
}

/* ─── RECLAMAÇÕES ──────────────────────── */

function renderReclamacoes() {
    if (!APP.data.reclamacoes) return '<p>Dados indisponíveis</p>';
    return `
    <div class="section-title">Ranking de Reclamações</div>
    <div class="grid-2">
        <div class="card">
            <div class="card-title">Índice por Instituição</div>
            <div class="chart-container"><canvas id="chart-reclamacoes"></canvas></div>
        </div>
        <div class="card">
            <div class="card-title">Média por Segmento</div>
            <div class="chart-container"><canvas id="chart-reclamacoes-seg"></canvas></div>
        </div>
    </div>`;
}

/* ═══════════════════════════════════════
   CHART DEFAULTS
   ═══════════════════════════════════════ */

function getCSSColor(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

function chartDefaults(hideY = true) {
    const text = getCSSColor('--text-secondary');
    const muted = getCSSColor('--text-muted');
    const border = getCSSColor('--border');
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: text, font: { family: "'Inter'", size: 12 } } },
            datalabels: {
                color: text,
                font: { family: "'JetBrains Mono'", size: 10, weight: 600 },
                anchor: 'end',
                align: 'end',
                offset: 2,
            },
        },
        scales: {
            x: { ticks: { color: muted, font: { size: 11 } }, grid: { color: border + '30' }, border: { display: false } },
            y: hideY
                ? { display: false }
                : { ticks: { color: muted, font: { size: 11 } }, grid: { color: border + '30' }, border: { display: false } },
        },
    };
}

function barDatalabels(fmt) {
    return {
        color: getCSSColor('--text-primary'),
        font: { family: "'JetBrains Mono'", size: 10, weight: 600 },
        anchor: 'end',
        align: 'end',
        offset: 2,
        formatter: fmt || (v => v?.toFixed?.(1)),
    };
}

function destroyCharts() {
    Object.values(APP.charts).forEach(c => c.destroy());
    APP.charts = {};
}

function mountCharts() {
    destroyCharts();
    try {
        const fn = {
            resumo: mountResumoCharts, rentabilidade: mountRentabilidadeCharts,
            credito: mountCreditoCharts, taxas: mountTaxasCharts,
            concentracao: mountConcentracaoCharts, comparativo: mountComparativoCharts,
            geografico: mountGeograficoCharts, reclamacoes: mountReclamacoesCharts,
        }[APP.activeSection];
        if (fn) fn();
    } catch (e) { console.error('Chart error:', e); }
}

/* ─── Charts: Resumo ───────────────────── */

function mountResumoCharts() {
    const tri = getActiveTri();
    const data = getFilteredInsts(tri).filter(i => i.roe !== null && i.ativo_total > 1e9)
        .sort((a,b) => b.roe - a.roe).slice(0, 10);

    const ctx1 = document.getElementById('chart-resumo-roe');
    if (ctx1 && data.length) {
        APP.charts.resumoRoe = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: data.map(i => i.nome),
                datasets: [{ data: data.map(i => i.roe), backgroundColor: data.map((d,i) => PALETTE[i % PALETTE.length]), borderRadius: 6 }],
            },
            options: { ...chartDefaults(), indexAxis: 'y',
                plugins: { ...chartDefaults().plugins, legend: { display: false },
                    datalabels: barDatalabels(v => v.toFixed(1) + '%') },
                scales: { x: { display: false }, y: { ...chartDefaults(false).scales.y, display: true, ticks: { color: getCSSColor('--text-primary'), font: { size: 11 } }, grid: { display: false } } },
            },
        });
    }

    const cred = APP.data.credito?.series?.credito_total?.monthly;
    if (cred) {
        const last24 = cred.slice(-24);
        const ctx2 = document.getElementById('chart-resumo-credito');
        if (ctx2) {
            APP.charts.resumoCredito = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: last24.map(m => m.data),
                    datasets: [{ data: last24.map(m => m.valor), borderColor: '#5eead4', backgroundColor: 'rgba(94,234,212,.1)', fill: true, tension: 0.3, pointRadius: 0 }],
                },
                options: { ...chartDefaults(false),
                    plugins: { legend: { display: false }, datalabels: { display: false } },
                    scales: {
                        x: { ...chartDefaults().scales.x },
                        y: { ticks: { color: getCSSColor('--text-muted'), callback: v => (v/1e6).toFixed(1)+' tri' }, grid: { color: getCSSColor('--border')+'30' }, border: { display: false } },
                    },
                },
            });
        }
    }
}

/* ─── Charts: Rentabilidade ────────────── */

function mountRentabilidadeCharts() {
    const tri = getActiveTri();
    const data = getFilteredInsts(tri).filter(i => i.roe !== null && i.ativo_total > 1e9)
        .sort((a,b) => b.roe - a.roe).slice(0, 15);

    const ctx1 = document.getElementById('chart-roe');
    if (ctx1 && data.length) {
        APP.charts.roe = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: data.map(i => i.nome),
                datasets: [{ data: data.map(i => i.roe), backgroundColor: data.map(i => segColor(i.segmento)), borderRadius: 6 }],
            },
            options: { ...chartDefaults(), indexAxis: 'y',
                plugins: { ...chartDefaults().plugins, legend: { display: false },
                    datalabels: barDatalabels(v => v.toFixed(1) + '%') },
                scales: { x: { display: false }, y: { display: true, ticks: { color: getCSSColor('--text-primary'), font: { size: 10 } }, grid: { display: false }, border: { display: false } } },
            },
        });
    }

    // ROE médio por segmento
    const tris = getAllTris();
    const ind = APP.data.indicadores?.trimestres;
    const segs = Object.keys(SEG_LABELS);
    const datasets = segs.map(seg => ({
        label: SEG_LABELS[seg],
        data: tris.map(t => {
            const insts = (ind[t]||[]).filter(i => i.segmento === seg && i.roe !== null);
            return insts.length ? +(insts.reduce((s,i) => s+i.roe, 0)/insts.length).toFixed(2) : null;
        }),
        borderColor: segColor(seg), backgroundColor: 'transparent', tension: 0.3, pointRadius: 3,
    }));
    const ctx2 = document.getElementById('chart-roe-evolucao');
    if (ctx2) {
        APP.charts.roeEvolucao = new Chart(ctx2, {
            type: 'line',
            data: { labels: tris.map(FMT.tri), datasets },
            options: { ...chartDefaults(false),
                plugins: { ...chartDefaults(false).plugins, datalabels: { display: false } },
                scales: {
                    x: { ...chartDefaults().scales.x },
                    y: { ticks: { color: getCSSColor('--text-muted'), callback: v => v+'%' }, grid: { color: getCSSColor('--border')+'30' }, border: { display: false } },
                },
            },
        });
    }
}

/* ─── Charts: Crédito ──────────────────── */

function mountCreditoCharts() {
    const cred = APP.data.credito?.series;
    if (!cred) return;
    const pf = cred.credito_pf?.monthly?.slice(-24)||[];
    const pj = cred.credito_pj?.monthly?.slice(-24)||[];
    const ctx1 = document.getElementById('chart-credito-pf-pj');
    if (ctx1 && pf.length) {
        APP.charts.creditoPfPj = new Chart(ctx1, {
            type: 'line',
            data: { labels: pf.map(m=>m.data), datasets: [
                { label:'Pessoa Física', data:pf.map(m=>m.valor), borderColor:'#58a6ff', tension:.3, pointRadius:0 },
                { label:'Pessoa Jurídica', data:pj.map(m=>m.valor), borderColor:'#d29922', tension:.3, pointRadius:0 },
            ]},
            options: { ...chartDefaults(false), plugins:{...chartDefaults(false).plugins, datalabels:{display:false}},
                scales: { x:{...chartDefaults().scales.x}, y:{ticks:{color:getCSSColor('--text-muted'),callback:v=>(v/1e6).toFixed(1)+' tri'},grid:{color:getCSSColor('--border')+'30'},border:{display:false}} } },
        });
    }
    const inad = cred.inadimplencia?.monthly?.slice(-24)||[];
    const inadPf = cred.inadimplencia_pf?.monthly?.slice(-24)||[];
    const inadPj = cred.inadimplencia_pj?.monthly?.slice(-24)||[];
    const ctx2 = document.getElementById('chart-inadimplencia');
    if (ctx2 && inad.length) {
        APP.charts.inadimplencia = new Chart(ctx2, {
            type: 'line',
            data: { labels:inad.map(m=>m.data), datasets: [
                { label:'Total', data:inad.map(m=>m.valor), borderColor:'#f85149', tension:.3, pointRadius:0, borderWidth:2 },
                { label:'PF', data:inadPf.map(m=>m.valor), borderColor:'#58a6ff', tension:.3, pointRadius:0, borderDash:[5,3] },
                { label:'PJ', data:inadPj.map(m=>m.valor), borderColor:'#d29922', tension:.3, pointRadius:0, borderDash:[5,3] },
            ]},
            options: { ...chartDefaults(false), plugins:{...chartDefaults(false).plugins, datalabels:{display:false}},
                scales: { x:{...chartDefaults().scales.x}, y:{ticks:{color:getCSSColor('--text-muted'),callback:v=>v+'%'},grid:{color:getCSSColor('--border')+'30'},border:{display:false}} } },
        });
    }
    const spr = cred.spread_total?.monthly?.slice(-24)||[];
    const sprPf = cred.spread_pf?.monthly?.slice(-24)||[];
    const ctx3 = document.getElementById('chart-spread');
    if (ctx3 && spr.length) {
        APP.charts.spread = new Chart(ctx3, {
            type: 'line',
            data: { labels:spr.map(m=>m.data), datasets: [
                { label:'Spread Total', data:spr.map(m=>m.valor), borderColor:'#5eead4', tension:.3, pointRadius:0 },
                { label:'Spread PF', data:sprPf.map(m=>m.valor), borderColor:'#bc8cff', tension:.3, pointRadius:0 },
            ]},
            options: { ...chartDefaults(false), plugins:{...chartDefaults(false).plugins, datalabels:{display:false}},
                scales: { x:{...chartDefaults().scales.x}, y:{ticks:{color:getCSSColor('--text-muted'),callback:v=>v+' p.p.'},grid:{color:getCSSColor('--border')+'30'},border:{display:false}} } },
        });
    }
}

/* ─── Charts: Taxas ────────────────────── */

function mountTaxasCharts() {
    const taxas = APP.data.taxas?.modalidades;
    if (!taxas) return;
    const mods = Object.entries(taxas).filter(([,v])=>!v.erro && v.media_geral);
    const ctx = document.getElementById('chart-taxas-media');
    if (ctx) {
        APP.charts.taxasMedia = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: mods.map(([,v])=>v.descricao),
                datasets: [{ data:mods.map(([,v])=>v.media_geral), backgroundColor:mods.map((_,i)=>PALETTE[i%PALETTE.length]), borderRadius:6 }],
            },
            options: { ...chartDefaults(), indexAxis:'y',
                plugins: { ...chartDefaults().plugins, legend:{display:false},
                    datalabels: barDatalabels(v => v.toFixed(1)+'%') },
                scales: { x:{display:false}, y:{display:true, ticks:{color:getCSSColor('--text-primary'),font:{size:10}}, grid:{display:false}, border:{display:false}} },
            },
        });
    }
}

/* ─── Charts: Concentração ─────────────── */

function mountConcentracaoCharts() {
    const conc = APP.data.concentracao?.trimestres;
    if (!conc) return;
    const tri = getActiveTri();
    const last = conc[tri];
    if (!last) return;

    const top10 = last.ranking_ativo.slice(0,10);
    const outrosShare = 100 - top10.reduce((s,i)=>s+i.share,0);
    const ctx1 = document.getElementById('chart-share-ativo');
    if (ctx1) {
        APP.charts.shareAtivo = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: [...top10.map(i=>i.nome),'Outros'],
                datasets: [{ data:[...top10.map(i=>i.share),outrosShare], backgroundColor:[...PALETTE.slice(0,10),'#3b4654'], borderWidth:0 }],
            },
            options: { responsive:true, maintainAspectRatio:false,
                plugins: { legend:{position:'right',labels:{color:getCSSColor('--text-secondary'),font:{size:11},boxWidth:12,padding:8}},
                    datalabels: { color:'#fff', font:{size:10,weight:700}, formatter:v=>v>3?v.toFixed(1)+'%':'' } },
            },
        });
    }
    const segShare = last.share_por_segmento;
    const segs = Object.entries(segShare).sort((a,b)=>b[1]-a[1]);
    const ctx2 = document.getElementById('chart-share-segmento');
    if (ctx2) {
        APP.charts.shareSegmento = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: segs.map(([s])=>SEG_LABELS[s]||s),
                datasets: [{ data:segs.map(([,v])=>v), backgroundColor:segs.map(([s])=>segColor(s)), borderWidth:0 }],
            },
            options: { responsive:true, maintainAspectRatio:false,
                plugins: { legend:{position:'right',labels:{color:getCSSColor('--text-secondary'),font:{size:11},boxWidth:12,padding:8}},
                    datalabels: { color:'#fff', font:{size:11,weight:700}, formatter:v=>v>3?v.toFixed(1)+'%':'' } },
            },
        });
    }
    const tris = Object.keys(conc).sort();
    const ctx3 = document.getElementById('chart-hhi-evolucao');
    if (ctx3) {
        APP.charts.hhiEvolucao = new Chart(ctx3, {
            type: 'line',
            data: { labels:tris.map(FMT.tri), datasets: [
                { label:'HHI Ativo', data:tris.map(t=>conc[t].hhi_ativo), borderColor:'#5eead4', tension:.3, pointRadius:3, yAxisID:'y' },
                { label:'Top 5 Share (%)', data:tris.map(t=>conc[t].top5_share_ativo), borderColor:'#58a6ff', tension:.3, pointRadius:3, yAxisID:'y1' },
            ]},
            options: { ...chartDefaults(false), plugins:{...chartDefaults(false).plugins, datalabels:{display:false}},
                scales: {
                    x:{...chartDefaults().scales.x},
                    y:{position:'left', ticks:{color:getCSSColor('--text-muted')}, grid:{color:getCSSColor('--border')+'30'}, border:{display:false}, title:{display:true,text:'HHI',color:getCSSColor('--text-muted')}},
                    y1:{position:'right', ticks:{color:getCSSColor('--text-muted')}, grid:{display:false}, border:{display:false}, title:{display:true,text:'Share (%)',color:getCSSColor('--text-muted')}},
                },
            },
        });
    }
}

/* ─── Charts: Comparativo ──────────────── */

function mountComparativoCharts() {
    const ind = APP.data.indicadores?.trimestres;
    if (!ind) return;
    const tris = getAllTris();
    const groups = Object.keys(SEG_LABELS);

    const datasets = groups.map(seg => ({
        label: SEG_LABELS[seg],
        data: tris.map(t => {
            const insts = (ind[t]||[]).filter(i=>i.segmento===seg && i.roe!==null);
            return insts.length ? +(insts.reduce((s,i)=>s+i.roe,0)/insts.length).toFixed(2) : null;
        }),
        borderColor: segColor(seg), backgroundColor: 'transparent', tension:.3, pointRadius:3,
    }));
    const ctx1 = document.getElementById('chart-comp-roe');
    if (ctx1) {
        APP.charts.compRoe = new Chart(ctx1, {
            type: 'line',
            data: { labels:tris.map(FMT.tri), datasets },
            options: { ...chartDefaults(false), plugins:{...chartDefaults(false).plugins, datalabels:{display:false}},
                scales: { x:{...chartDefaults().scales.x}, y:{ticks:{color:getCSSColor('--text-muted'),callback:v=>v+'%'},grid:{color:getCSSColor('--border')+'30'},border:{display:false}} } },
        });
    }

    const taxas = APP.data.taxas?.modalidades;
    if (!taxas) return;
    const modsComp = ['consignado_inss','credito_pessoal','veiculos','cheque_especial','capital_giro_curto'];
    const modLabels = modsComp.map(m=>taxas[m]?.descricao?.slice(0,18)||m);
    const taxaDatasets = groups.map(seg => ({
        label: SEG_LABELS[seg],
        data: modsComp.map(m=>taxas[m]?.media_por_segmento?.[seg]||null),
        backgroundColor: segColor(seg), borderRadius: 6,
    }));
    const ctx2 = document.getElementById('chart-comp-taxas');
    if (ctx2) {
        APP.charts.compTaxas = new Chart(ctx2, {
            type: 'bar',
            data: { labels:modLabels, datasets:taxaDatasets },
            options: { ...chartDefaults(false),
                plugins: { ...chartDefaults(false).plugins, datalabels:{display:false} },
                scales: { x:{...chartDefaults().scales.x}, y:{ticks:{color:getCSSColor('--text-muted'),callback:v=>v+'%'},grid:{color:getCSSColor('--border')+'30'},border:{display:false}} },
            },
        });
    }
}

/* ─── Charts: Geográfico ───────────────── */

function mountGeograficoCharts() {
    const estban = APP.data.estban;
    if (!estban?.por_uf) return;
    const ufs = [...estban.por_uf].sort((a,b)=>b.credito_per_capita-a.credito_per_capita);
    const ctx = document.getElementById('chart-mapa-credito');
    if (ctx) {
        APP.charts.mapaCredito = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ufs.map(u=>u.uf),
                datasets: [{ data:ufs.map(u=>u.credito_per_capita),
                    backgroundColor: ufs.map((_,i)=>`rgba(94,234,212,${0.3+((ufs.length-i)/ufs.length)*0.7})`),
                    borderRadius: 6 }],
            },
            options: { ...chartDefaults(),
                plugins: { ...chartDefaults().plugins, legend:{display:false},
                    datalabels: { ...barDatalabels(v=>'R$ '+v.toLocaleString('pt-BR',{maximumFractionDigits:0})), anchor:'end', align:'top' } },
                scales: { x:{...chartDefaults().scales.x, ticks:{color:getCSSColor('--text-primary'),font:{size:10,weight:600}}}, y:{display:false} },
            },
        });
    }
}

/* ─── Charts: Reclamações ──────────────── */

function mountReclamacoesCharts() {
    const rec = APP.data.reclamacoes;
    if (!rec) return;
    const ranking = [...rec.ranking].sort((a,b)=>b.indice-a.indice);
    const ctx1 = document.getElementById('chart-reclamacoes');
    if (ctx1) {
        APP.charts.reclamacoes = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: ranking.map(r=>r.instituicao),
                datasets: [{ data:ranking.map(r=>r.indice), backgroundColor:ranking.map(r=>segColor(r.segmento)), borderRadius:6 }],
            },
            options: { ...chartDefaults(), indexAxis:'y',
                plugins: { ...chartDefaults().plugins, legend:{display:false},
                    datalabels: barDatalabels(v=>v.toFixed(1)) },
                scales: { x:{display:false}, y:{display:true,ticks:{color:getCSSColor('--text-primary'),font:{size:10}},grid:{display:false},border:{display:false}} },
            },
        });
    }
    const segData = Object.entries(rec.media_por_segmento).sort((a,b)=>b[1]-a[1]);
    const ctx2 = document.getElementById('chart-reclamacoes-seg');
    if (ctx2) {
        APP.charts.reclamacoesSeg = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: segData.map(([s])=>SEG_LABELS[s]||s),
                datasets: [{ data:segData.map(([,v])=>v), backgroundColor:segData.map(([s])=>segColor(s)), borderRadius:6 }],
            },
            options: { ...chartDefaults(),
                plugins: { ...chartDefaults().plugins, legend:{display:false},
                    datalabels: barDatalabels(v=>v.toFixed(1)) },
                scales: { x:{...chartDefaults().scales.x}, y:{display:false} },
            },
        });
    }
}

/* ═══════════════════════════════════════
   EVENTS
   ═══════════════════════════════════════ */

function bindEvents() {
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') !== 'light';
        html.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
        document.getElementById('themeToggle').textContent = isDark ? '☾' : '☀';
        mountCharts();
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => showSection(btn.dataset.section));
    });

    document.querySelectorAll('.seg-filter').forEach(chip => {
        chip.addEventListener('click', () => {
            APP.segFilter = chip.dataset.seg;
            render();
        });
    });

    document.querySelectorAll('.tri-filter').forEach(chip => {
        chip.addEventListener('click', () => {
            APP.triFilter = chip.dataset.tri;
            render();
        });
    });
}

function showSection(id) {
    APP.activeSection = id;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`sec-${id}`)?.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.section === id));
    mountCharts();
}

/* ─── Init ─────────────────────────────── */

Chart.register(ChartDataLabels);
Chart.defaults.plugins.datalabels.display = false;

(function() {
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
})();

init();
