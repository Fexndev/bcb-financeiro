# BCB Financeiro

Dashboard interativo de análise do **Sistema Financeiro Nacional** com dados 100% públicos do Banco Central do Brasil.

Analisa rentabilidade, concentração de mercado, taxas de juros, crédito e distribuição geográfica de **bancos, cooperativas e instituições digitais**.

**[Acessar o Dashboard](https://fexndev.github.io/bcb-financeiro/)**

---

## Funcionalidades

- **Filtros dinâmicos** — todos os gráficos, KPIs e tabelas reagem à seleção de segmento e instituição (comportamento Power BI)
- **KPIs contextuais** — cards mudam entre dados do SFN, do segmento ou da instituição selecionada, com trend arrows (vs trimestre anterior)
- **View toggle** — alternância rápida entre Todos / Bancos / Cooperativas
- **Mapa interativo** — choropleth D3.js do Brasil com tooltip rico (crédito, % SFN, per capita) e tabela paginada com filtro por região
- **8 seções de análise** — Resumo, Rentabilidade, Crédito, Taxas, Concentração, Bancos vs Coops, Mapa, Reclamações
- **Dark/Light mode** — com persistência em localStorage
- **Atualização automática** — GitHub Actions coleta dados do BCB mensalmente

## Fontes de dados

| Fonte | Dados |
|-------|-------|
| [IF.data](https://www3.bcb.gov.br/ifdata/) | Ativo, PL, lucro, crédito, Basileia — por instituição e trimestre (12 trimestres) |
| [SGS](https://dadosabertos.bcb.gov.br/) | Crédito total, inadimplência, spread — séries mensais |
| [Olinda](https://olinda.bcb.gov.br/) | Taxas de juros por instituição e modalidade |
| [ESTBAN](https://www4.bcb.gov.br/fis/cosif/estban.asp) | Estatísticas bancárias por UF |
| BCB Ranking | Índice de reclamações por instituição |

## Segmentação

| Segmento | Instituições |
|----------|-------------|
| **Grandes Bancos** | Itaú, Bradesco, Santander, BB, Caixa, Nubank |
| **Cooperativas** | Sicoob (280), Sicredi (110), Cresol (63), Unicred (23), Ailos |
| **Outros** | BTG, Safra, Pan, BMG, Inter, C6 e demais |

## Stack

- **Coleta:** Python 3 + requests
- **Frontend:** HTML + CSS + JS vanilla + Chart.js + D3.js
- **Deploy:** GitHub Pages
- **Automação:** GitHub Actions (dia 5 de cada mês)

## Executar localmente

```bash
cd scripts
pip install -r requirements.txt
python fetch_credito.py && python fetch_taxas.py && python fetch_ifdata.py && python fetch_estban.py && python fetch_reclamacoes.py
cd .. && python -m http.server 8000
```

## Estrutura

```
bcb-financeiro/
├── index.html, app.js, styles.css   # Frontend
├── data/                             # JSONs (gerados pelos scripts)
├── scripts/                          # Coleta de dados (Python)
│   ├── utils.py                      # Classificação e utilidades
│   ├── fetch_ifdata.py               # Demonstrações financeiras
│   ├── fetch_credito.py              # Séries SGS
│   ├── fetch_taxas.py                # Taxas de juros
│   ├── fetch_estban.py               # Dados geográficos por UF
│   └── fetch_reclamacoes.py          # Ranking de reclamações
├── docs/                             # Contexto e planejamento
└── .github/workflows/                # CI/CD
```
