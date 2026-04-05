/* ═══════════════════════════════════════
   BCB FINANCEIRO — Dashboard
   ═══════════════════════════════════════ */

const APP = {
    data: {},
    charts: {},
    activeSection: 'resumo',
    segFilter: 'todos',
};

const SEG_COLORS = {
    S1:          'var(--accent-blue)',
    S1_publico:  'var(--accent-green)',
    S2:          'var(--accent-yellow)',
    digital:     'var(--accent-purple)',
    cooperativa: 'var(--accent-teal)',
    publico:     'var(--accent-green)',
    outro:       'var(--text-muted)',
};

const SEG_LABELS = {
    S1:          'Grandes Bancos',
    S1_publico:  'Bancos Públicos (S1)',
    S2:          'Bancos Médios',
    digital:     'Digitais',
    cooperativa: 'Cooperativas',
    publico:     'Públicos',
    outro:       'Outros',
};

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

/* ─── Init ─────────────────────────────── */

async function init() {
    const files = ['credito','taxas','resultados','indicadores','concentracao','estban','reclamacoes','instituicoes'];
    const results = await Promise.allSettled(
        files.map(f => fetch(`data/${f}.json`).then(r => r.json()))
    );
    files.forEach((f, i) => {
        APP.data[f] = results[i].status === 'fulfilled' ? results[i].value : null;
    });
    render();
}

/* ─── Render ───────────────────────────── */

function render() {
    const el = document.getElementById('app');
    el.innerHTML = renderHeader() + renderNav() + renderKPIs() + renderSections() + renderFooter();
    bindEvents();
    showSection(APP.activeSection);
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

function renderKPIs() {
    const cred = APP.data.credito?.series;
    const conc = APP.data.concentracao?.trimestres;
    const lastTri = conc ? Object.keys(conc).sort().pop() : null;

    const creditoTotal = cred?.credito_total?.ultimo?.valor;
    const inadimplencia = cred?.inadimplencia?.ultimo?.valor;
    const spread = cred?.spread_total?.ultimo?.valor;
    const top5 = lastTri ? conc[lastTri].top5_share_ativo : null;

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
            <div class="kpi-detail">Concentração por ativo total</div>
        </div>
    </div>`;
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

/* ─── RESUMO ───────────────────────────── */

function renderResumo() {
    const ind = APP.data.indicadores?.trimestres;
    const lastTri = ind ? Object.keys(ind).sort().pop() : null;
    if (!lastTri) return '<p>Dados indisponíveis</p>';

    const top10 = ind[lastTri]
        .filter(i => i.roe !== null && i.ativo_total > 0)
        .sort((a,b) => b.roe - a.roe)
        .slice(0, 10);

    return `
    <div class="section-title">Visão Geral do Sistema Financeiro Nacional</div>
    <div class="grid-2">
        <div class="card">
            <div class="card-title">Top 10 Rentabilidade (ROE) — ${FMT.tri(lastTri)}</div>
            <div class="chart-container-sm"><canvas id="chart-resumo-roe"></canvas></div>
        </div>
        <div class="card">
            <div class="card-title">Evolução do Crédito Total</div>
            <div class="chart-container-sm"><canvas id="chart-resumo-credito"></canvas></div>
        </div>
    </div>
    <div class="card">
        <div class="card-title">Principais Instituições — ${FMT.tri(lastTri)}</div>
        <div class="table-wrap">${renderTabelaResumo(lastTri)}</div>
    </div>`;
}

function renderTabelaResumo(tri) {
    const ind = APP.data.indicadores.trimestres[tri]
        .filter(i => i.ativo_total > 0)
        .sort((a,b) => b.ativo_total - a.ativo_total)
        .slice(0, 20);

    return `<table>
        <thead><tr>
            <th>#</th><th>Instituição</th><th>Segmento</th>
            <th class="td-right">Ativo Total</th>
            <th class="td-right">ROE</th><th class="td-right">ROA</th>
            <th class="td-right">Basileia</th>
        </tr></thead>
        <tbody>${ind.map((i, idx) => `<tr>
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
    const ind = APP.data.indicadores?.trimestres;
    if (!ind) return '<p>Dados indisponíveis</p>';
    const tris = Object.keys(ind).sort();
    const lastTri = tris[tris.length - 1];

    return `
    <div class="section-title">Rentabilidade das Instituições</div>
    ${renderSegFilter()}
    <div class="grid-2">
        <div class="card">
            <div class="card-title">ROE por Instituição — ${FMT.tri(lastTri)}</div>
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
    const cred = APP.data.credito?.series;
    if (!cred) return '<p>Dados indisponíveis</p>';

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
            <thead><tr><th>Modalidade</th>${Object.keys(SEG_LABELS).map(s =>
                `<th class="td-right">${SEG_LABELS[s]}</th>`).join('')}
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
    if (!mod || !mod.ranking) return '';

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
    const conc = APP.data.concentracao?.trimestres;
    if (!conc) return '<p>Dados indisponíveis</p>';

    const tris = Object.keys(conc).sort();
    const lastTri = tris[tris.length - 1];
    const c = conc[lastTri];

    return `
    <div class="section-title">Concentração Bancária</div>
    <div class="grid-2">
        <div class="card">
            <div class="card-title">Market Share — Ativo Total (${FMT.tri(lastTri)})</div>
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
    const ind = APP.data.indicadores?.trimestres;
    const taxas = APP.data.taxas?.modalidades;
    if (!ind) return '<p>Dados indisponíveis</p>';

    return `
    <div class="section-title">Bancos vs Cooperativas</div>
    <div class="grid-2">
        <div class="card">
            <div class="card-title">ROE Médio — Bancos vs Cooperativas</div>
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
    if (!estban || !estban.por_uf) return '<p>Dados indisponíveis</p>';

    const ufs = estban.por_uf.sort((a,b) => b.credito_per_capita - a.credito_per_capita);
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
                <span class="legend-value">R$ ${u.credito_per_capita.toLocaleString('pt-BR', {minimumFractionDigits: 0})} mil</span>
                <div style="flex:1; margin-left: 12px;">
                    <div class="legend-bar" style="width: ${(u.credito_per_capita / maxVal * 100).toFixed(0)}%"></div>
                </div>
            </div>`).join('')}
        </div>
    </div>`;
}

/* ─── RECLAMAÇÕES ──────────────────────── */

function renderReclamacoes() {
    const rec = APP.data.reclamacoes;
    if (!rec) return '<p>Dados indisponíveis</p>';

    return `
    <div class="section-title">Ranking de Reclamações</div>
    <div class="grid-2">
        <div class="card">
            <div class="card-title">Índice de Reclamações por Instituição</div>
            <div class="chart-container"><canvas id="chart-reclamacoes"></canvas></div>
        </div>
        <div class="card">
            <div class="card-title">Média por Segmento</div>
            <div class="chart-container"><canvas id="chart-reclamacoes-seg"></canvas></div>
        </div>
    </div>`;
}

/* ─── FILTER ───────────────────────────── */

function renderSegFilter() {
    const segs = ['todos', ...Object.keys(SEG_LABELS)];
    return `<div class="filter-bar">${segs.map(s =>
        `<button class="filter-chip${s === APP.segFilter ? ' active' : ''}" data-seg="${s}">${s === 'todos' ? 'Todos' : SEG_LABELS[s]}</button>`
    ).join('')}</div>`;
}

/* ═══════════════════════════════════════
   CHART MOUNTING
   ═══════════════════════════════════════ */

function getColor(cssVar) {
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue(cssVar).trim();
}

const CHART_COLORS = () => ({
    blue: getColor('--accent-blue'),
    green: getColor('--accent-green'),
    red: getColor('--accent-red'),
    yellow: getColor('--accent-yellow'),
    purple: getColor('--accent-purple'),
    teal: getColor('--accent-teal'),
    muted: getColor('--text-muted'),
    border: getColor('--border'),
    text: getColor('--text-secondary'),
    card: getColor('--bg-card'),
});

function chartDefaults() {
    const c = CHART_COLORS();
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: c.text, font: { family: "'Inter'" } } },
            datalabels: { display: false },
        },
        scales: {
            x: { ticks: { color: c.muted, font: { size: 11 } }, grid: { color: c.border + '40' } },
            y: { ticks: { color: c.muted, font: { size: 11 } }, grid: { color: c.border + '40' } },
        },
    };
}

function destroyCharts() {
    Object.values(APP.charts).forEach(c => c.destroy());
    APP.charts = {};
}

function mountCharts() {
    destroyCharts();
    const section = APP.activeSection;

    switch(section) {
        case 'resumo':        mountResumoCharts(); break;
        case 'rentabilidade': mountRentabilidadeCharts(); break;
        case 'credito':       mountCreditoCharts(); break;
        case 'taxas':         mountTaxasCharts(); break;
        case 'concentracao':  mountConcentracaoCharts(); break;
        case 'comparativo':   mountComparativoCharts(); break;
        case 'geografico':    mountGeograficoCharts(); break;
        case 'reclamacoes':   mountReclamacoesCharts(); break;
    }
}

/* ─── Chart: Resumo ────────────────────── */

function mountResumoCharts() {
    const c = CHART_COLORS();
    const ind = APP.data.indicadores?.trimestres;
    if (!ind) return;

    const lastTri = Object.keys(ind).sort().pop();
    const top10 = ind[lastTri]
        .filter(i => i.roe !== null && i.ativo_total > 1e9)
        .sort((a,b) => b.roe - a.roe)
        .slice(0, 10);

    const ctx1 = document.getElementById('chart-resumo-roe');
    if (ctx1) {
        APP.charts.resumoRoe = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: top10.map(i => i.nome.slice(0, 20)),
                datasets: [{
                    data: top10.map(i => i.roe),
                    backgroundColor: top10.map(i => SEG_COLORS[i.segmento] || c.muted),
                    borderRadius: 4,
                }],
            },
            options: { ...chartDefaults(), indexAxis: 'y',
                plugins: { ...chartDefaults().plugins, legend: { display: false } },
                scales: {
                    x: { ...chartDefaults().scales.x, title: { display: true, text: 'ROE (%)', color: c.muted } },
                    y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, font: { size: 10 } } },
                },
            },
        });
    }

    // Crédito total evolução
    const cred = APP.data.credito?.series?.credito_total?.monthly;
    if (cred) {
        const last24 = cred.slice(-24);
        const ctx2 = document.getElementById('chart-resumo-credito');
        if (ctx2) {
            APP.charts.resumoCredito = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: last24.map(m => m.data),
                    datasets: [{
                        label: 'Crédito Total (R$ mi)',
                        data: last24.map(m => m.valor),
                        borderColor: c.teal,
                        backgroundColor: c.teal + '20',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0,
                    }],
                },
                options: { ...chartDefaults(),
                    plugins: { ...chartDefaults().plugins, legend: { display: false } },
                    scales: {
                        ...chartDefaults().scales,
                        y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks,
                            callback: v => (v/1e6).toFixed(1) + ' tri' } },
                    },
                },
            });
        }
    }
}

/* ─── Chart: Rentabilidade ─────────────── */

function mountRentabilidadeCharts() {
    const c = CHART_COLORS();
    const ind = APP.data.indicadores?.trimestres;
    if (!ind) return;

    const tris = Object.keys(ind).sort();
    const lastTri = tris[tris.length - 1];

    // ROE por instituição
    let data = ind[lastTri].filter(i => i.roe !== null && i.ativo_total > 1e9);
    if (APP.segFilter !== 'todos') data = data.filter(i => i.segmento === APP.segFilter);
    data = data.sort((a,b) => b.roe - a.roe).slice(0, 15);

    const ctx1 = document.getElementById('chart-roe');
    if (ctx1) {
        APP.charts.roe = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: data.map(i => i.nome.slice(0, 22)),
                datasets: [{
                    data: data.map(i => i.roe),
                    backgroundColor: data.map(i => SEG_COLORS[i.segmento] || c.muted),
                    borderRadius: 4,
                }],
            },
            options: { ...chartDefaults(), indexAxis: 'y',
                plugins: { ...chartDefaults().plugins, legend: { display: false } },
            },
        });
    }

    // ROE médio por segmento ao longo do tempo
    const segmentos = ['S1', 'S1_publico', 'S2', 'digital', 'cooperativa'];
    const datasets = segmentos.map(seg => {
        const values = tris.map(tri => {
            const insts = ind[tri].filter(i => i.segmento === seg && i.roe !== null);
            return insts.length ? insts.reduce((s,i) => s + i.roe, 0) / insts.length : null;
        });
        return {
            label: SEG_LABELS[seg],
            data: values,
            borderColor: SEG_COLORS[seg],
            backgroundColor: 'transparent',
            tension: 0.3,
            pointRadius: 2,
        };
    });

    const ctx2 = document.getElementById('chart-roe-evolucao');
    if (ctx2) {
        APP.charts.roeEvolucao = new Chart(ctx2, {
            type: 'line',
            data: { labels: tris.map(FMT.tri), datasets },
            options: chartDefaults(),
        });
    }
}

/* ─── Chart: Crédito ───────────────────── */

function mountCreditoCharts() {
    const c = CHART_COLORS();
    const cred = APP.data.credito?.series;
    if (!cred) return;

    // PF vs PJ
    const pf = cred.credito_pf?.monthly?.slice(-24) || [];
    const pj = cred.credito_pj?.monthly?.slice(-24) || [];
    const ctx1 = document.getElementById('chart-credito-pf-pj');
    if (ctx1 && pf.length) {
        APP.charts.creditoPfPj = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: pf.map(m => m.data),
                datasets: [
                    { label: 'Pessoa Física', data: pf.map(m => m.valor), borderColor: c.blue, tension: 0.3, pointRadius: 0 },
                    { label: 'Pessoa Jurídica', data: pj.map(m => m.valor), borderColor: c.yellow, tension: 0.3, pointRadius: 0 },
                ],
            },
            options: { ...chartDefaults(),
                scales: { ...chartDefaults().scales,
                    y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks,
                        callback: v => (v/1e6).toFixed(1) + ' tri' } },
                },
            },
        });
    }

    // Inadimplência
    const inad = cred.inadimplencia?.monthly?.slice(-24) || [];
    const inadPf = cred.inadimplencia_pf?.monthly?.slice(-24) || [];
    const inadPj = cred.inadimplencia_pj?.monthly?.slice(-24) || [];
    const ctx2 = document.getElementById('chart-inadimplencia');
    if (ctx2 && inad.length) {
        APP.charts.inadimplencia = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: inad.map(m => m.data),
                datasets: [
                    { label: 'Total', data: inad.map(m => m.valor), borderColor: c.red, tension: 0.3, pointRadius: 0, borderWidth: 2 },
                    { label: 'PF', data: inadPf.map(m => m.valor), borderColor: c.blue, tension: 0.3, pointRadius: 0, borderDash: [5,3] },
                    { label: 'PJ', data: inadPj.map(m => m.valor), borderColor: c.yellow, tension: 0.3, pointRadius: 0, borderDash: [5,3] },
                ],
            },
            options: { ...chartDefaults(),
                scales: { ...chartDefaults().scales,
                    y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, callback: v => v + '%' } },
                },
            },
        });
    }

    // Spread
    const spr = cred.spread_total?.monthly?.slice(-24) || [];
    const sprPf = cred.spread_pf?.monthly?.slice(-24) || [];
    const ctx3 = document.getElementById('chart-spread');
    if (ctx3 && spr.length) {
        APP.charts.spread = new Chart(ctx3, {
            type: 'line',
            data: {
                labels: spr.map(m => m.data),
                datasets: [
                    { label: 'Spread Total', data: spr.map(m => m.valor), borderColor: c.teal, tension: 0.3, pointRadius: 0 },
                    { label: 'Spread PF', data: sprPf.map(m => m.valor), borderColor: c.purple, tension: 0.3, pointRadius: 0 },
                ],
            },
            options: { ...chartDefaults(),
                scales: { ...chartDefaults().scales,
                    y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, callback: v => v + ' p.p.' } },
                },
            },
        });
    }
}

/* ─── Chart: Taxas ─────────────────────── */

function mountTaxasCharts() {
    const c = CHART_COLORS();
    const taxas = APP.data.taxas?.modalidades;
    if (!taxas) return;

    const mods = Object.entries(taxas).filter(([,v]) => !v.erro && v.media_geral);
    const ctx = document.getElementById('chart-taxas-media');
    if (ctx) {
        APP.charts.taxasMedia = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: mods.map(([,v]) => v.descricao.slice(0, 20)),
                datasets: [{
                    data: mods.map(([,v]) => v.media_geral),
                    backgroundColor: [c.blue, c.green, c.yellow, c.purple, c.teal, c.red, c.blue, c.green, c.yellow, c.purple, c.teal, c.red],
                    borderRadius: 4,
                }],
            },
            options: { ...chartDefaults(), indexAxis: 'y',
                plugins: { ...chartDefaults().plugins, legend: { display: false } },
                scales: {
                    x: { ...chartDefaults().scales.x, title: { display: true, text: 'Taxa Média (% a.a.)', color: c.muted } },
                    y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, font: { size: 10 } } },
                },
            },
        });
    }
}

/* ─── Chart: Concentração ──────────────── */

function mountConcentracaoCharts() {
    const c = CHART_COLORS();
    const conc = APP.data.concentracao?.trimestres;
    if (!conc) return;

    const tris = Object.keys(conc).sort();
    const lastTri = tris[tris.length - 1];
    const last = conc[lastTri];

    // Donut — top 10 market share
    const top10 = last.ranking_ativo.slice(0, 10);
    const outrosShare = 100 - top10.reduce((s,i) => s + i.share, 0);

    const ctx1 = document.getElementById('chart-share-ativo');
    if (ctx1) {
        APP.charts.shareAtivo = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: [...top10.map(i => i.nome.slice(0,18)), 'Outros'],
                datasets: [{
                    data: [...top10.map(i => i.share), outrosShare],
                    backgroundColor: [c.blue, c.green, c.teal, c.yellow, c.red, c.purple, c.blue+'aa', c.green+'aa', c.teal+'aa', c.yellow+'aa', c.muted],
                    borderWidth: 0,
                }],
            },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: c.text, font: { size: 11 }, boxWidth: 12, padding: 8 } },
                    datalabels: { display: false },
                },
            },
        });
    }

    // Share por segmento
    const segShare = last.share_por_segmento;
    const segs = Object.entries(segShare).sort((a,b) => b[1] - a[1]);
    const ctx2 = document.getElementById('chart-share-segmento');
    if (ctx2) {
        APP.charts.shareSegmento = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: segs.map(([s]) => SEG_LABELS[s] || s),
                datasets: [{
                    data: segs.map(([,v]) => v),
                    backgroundColor: segs.map(([s]) => SEG_COLORS[s] || c.muted),
                    borderWidth: 0,
                }],
            },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: c.text, font: { size: 11 }, boxWidth: 12, padding: 8 } },
                    datalabels: { display: false },
                },
            },
        });
    }

    // HHI evolução
    const ctx3 = document.getElementById('chart-hhi-evolucao');
    if (ctx3) {
        APP.charts.hhiEvolucao = new Chart(ctx3, {
            type: 'line',
            data: {
                labels: tris.map(FMT.tri),
                datasets: [
                    { label: 'HHI Ativo', data: tris.map(t => conc[t].hhi_ativo), borderColor: c.teal, tension: 0.3, pointRadius: 3, yAxisID: 'y' },
                    { label: 'Top 5 Share (%)', data: tris.map(t => conc[t].top5_share_ativo), borderColor: c.blue, tension: 0.3, pointRadius: 3, yAxisID: 'y1' },
                ],
            },
            options: { ...chartDefaults(),
                scales: {
                    ...chartDefaults().scales,
                    y: { ...chartDefaults().scales.y, position: 'left', title: { display: true, text: 'HHI', color: c.muted } },
                    y1: { ...chartDefaults().scales.y, position: 'right', grid: { display: false }, title: { display: true, text: 'Share (%)', color: c.muted } },
                },
            },
        });
    }
}

/* ─── Chart: Comparativo ───────────────── */

function mountComparativoCharts() {
    const c = CHART_COLORS();
    const ind = APP.data.indicadores?.trimestres;
    if (!ind) return;

    const tris = Object.keys(ind).sort();
    const groups = ['S1', 'cooperativa', 'digital'];

    // ROE médio
    const datasets = groups.map(seg => ({
        label: SEG_LABELS[seg],
        data: tris.map(tri => {
            const insts = ind[tri].filter(i => i.segmento === seg && i.roe !== null);
            return insts.length ? +(insts.reduce((s,i) => s + i.roe, 0) / insts.length).toFixed(2) : null;
        }),
        borderColor: SEG_COLORS[seg],
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 3,
    }));

    const ctx1 = document.getElementById('chart-comp-roe');
    if (ctx1) {
        APP.charts.compRoe = new Chart(ctx1, {
            type: 'line',
            data: { labels: tris.map(FMT.tri), datasets },
            options: { ...chartDefaults(),
                scales: { ...chartDefaults().scales,
                    y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, callback: v => v + '%' } },
                },
            },
        });
    }

    // Taxas comparadas
    const taxas = APP.data.taxas?.modalidades;
    if (!taxas) return;

    const modsComp = ['consignado_inss', 'credito_pessoal', 'veiculos', 'cheque_especial', 'capital_giro_curto'];
    const modLabels = modsComp.map(m => taxas[m]?.descricao?.slice(0,18) || m);

    const taxaDatasets = groups.map(seg => ({
        label: SEG_LABELS[seg],
        data: modsComp.map(m => taxas[m]?.media_por_segmento?.[seg] || null),
        backgroundColor: SEG_COLORS[seg],
        borderRadius: 4,
    }));

    const ctx2 = document.getElementById('chart-comp-taxas');
    if (ctx2) {
        APP.charts.compTaxas = new Chart(ctx2, {
            type: 'bar',
            data: { labels: modLabels, datasets: taxaDatasets },
            options: { ...chartDefaults(),
                scales: { ...chartDefaults().scales,
                    y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, callback: v => v + '%' } },
                },
            },
        });
    }
}

/* ─── Chart: Geográfico ────────────────── */

function mountGeograficoCharts() {
    const c = CHART_COLORS();
    const estban = APP.data.estban;
    if (!estban || !estban.por_uf) return;

    const ufs = estban.por_uf.sort((a,b) => b.credito_per_capita - a.credito_per_capita);

    const ctx = document.getElementById('chart-mapa-credito');
    if (ctx) {
        APP.charts.mapaCredito = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ufs.map(u => u.uf),
                datasets: [{
                    data: ufs.map(u => u.credito_per_capita),
                    backgroundColor: ufs.map((u, i) => {
                        const ratio = 1 - (i / ufs.length);
                        return `rgba(94,234,212,${0.3 + ratio * 0.7})`;
                    }),
                    borderRadius: 4,
                }],
            },
            options: { ...chartDefaults(),
                plugins: { ...chartDefaults().plugins, legend: { display: false } },
                scales: {
                    ...chartDefaults().scales,
                    y: { ...chartDefaults().scales.y, title: { display: true, text: 'R$ mil / hab', color: c.muted } },
                },
            },
        });
    }
}

/* ─── Chart: Reclamações ───────────────── */

function mountReclamacoesCharts() {
    const c = CHART_COLORS();
    const rec = APP.data.reclamacoes;
    if (!rec) return;

    const ranking = rec.ranking.sort((a,b) => b.indice - a.indice);
    const ctx1 = document.getElementById('chart-reclamacoes');
    if (ctx1) {
        APP.charts.reclamacoes = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: ranking.map(r => r.instituicao.slice(0, 18)),
                datasets: [{
                    data: ranking.map(r => r.indice),
                    backgroundColor: ranking.map(r => SEG_COLORS[r.segmento] || c.muted),
                    borderRadius: 4,
                }],
            },
            options: { ...chartDefaults(), indexAxis: 'y',
                plugins: { ...chartDefaults().plugins, legend: { display: false } },
                scales: {
                    x: { ...chartDefaults().scales.x, title: { display: true, text: 'Índice por milhão de clientes', color: c.muted } },
                    y: { ...chartDefaults().scales.y },
                },
            },
        });
    }

    // Média por segmento
    const segData = Object.entries(rec.media_por_segmento).sort((a,b) => b[1] - a[1]);
    const ctx2 = document.getElementById('chart-reclamacoes-seg');
    if (ctx2) {
        APP.charts.reclamacoesSeg = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: segData.map(([s]) => SEG_LABELS[s] || s),
                datasets: [{
                    data: segData.map(([,v]) => v),
                    backgroundColor: segData.map(([s]) => SEG_COLORS[s] || c.muted),
                    borderRadius: 4,
                }],
            },
            options: { ...chartDefaults(),
                plugins: { ...chartDefaults().plugins, legend: { display: false } },
                scales: {
                    ...chartDefaults().scales,
                    y: { ...chartDefaults().scales.y, title: { display: true, text: 'Índice médio', color: c.muted } },
                },
            },
        });
    }
}

/* ═══════════════════════════════════════
   EVENTS
   ═══════════════════════════════════════ */

function bindEvents() {
    // Theme toggle
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') !== 'light';
        html.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
        document.getElementById('themeToggle').textContent = isDark ? '☾' : '☀';
        mountCharts();
    });

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => showSection(btn.dataset.section));
    });

    // Segment filter
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            APP.segFilter = chip.dataset.seg;
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            mountCharts();
        });
    });
}

function showSection(id) {
    APP.activeSection = id;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`sec-${id}`)?.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.section === id);
    });
    mountCharts();
}

/* ─── Theme init ───────────────────────── */

(function() {
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
})();

/* ─── Start ────────────────────────────── */

init();
