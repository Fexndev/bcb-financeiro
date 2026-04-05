# BCB Financeiro

Dashboard interativo de análise do **Sistema Financeiro Nacional** com dados 100% públicos do Banco Central do Brasil.

Analisa a saúde financeira, rentabilidade, concentração de mercado, taxas de juros e distribuição geográfica de **bancos, cooperativas e instituições digitais**.

**[Acessar o Dashboard](https://fexndev.github.io/bcb-financeiro/)**

---

## O que o dashboard mostra

| Seção | Descrição |
|-------|-----------|
| **Resumo** | Top 10 rentabilidade (ROE), evolução do crédito total, tabela das 20 maiores instituições |
| **Rentabilidade** | ROE e ROA por instituição com filtro por segmento, evolução do ROE médio por tipo de instituição |
| **Crédito** | Saldo de crédito PF vs PJ, inadimplência e spread bancário — séries temporais desde 2020 |
| **Taxas de Juros** | Taxa média por modalidade (consignado, veículos, cheque especial, cartão), ranking das menores taxas, comparativo por segmento |
| **Concentração** | Market share dos maiores bancos, HHI (índice de concentração), participação por segmento |
| **Bancos vs Cooperativas** | Comparativo direto de rentabilidade e taxas entre grandes bancos, digitais e cooperativas |
| **Mapa** | Crédito per capita por UF — quais estados têm mais e menos acesso a crédito |
| **Reclamações** | Ranking de reclamações por milhão de clientes, média por segmento |

## Segmentação das instituições

| Segmento | Exemplos |
|----------|----------|
| Grandes Bancos (S1) | Itaú, Bradesco, Santander |
| Bancos Públicos | Banco do Brasil, Caixa Econômica |
| Bancos Médios (S2) | BTG, Safra, Pan, BMG |
| Bancos Digitais | Nubank, Inter, C6 Bank |
| Cooperativas | Sicoob, Sicredi, Unicred, Cresol |

## Fontes de dados

| Fonte | API / Endpoint | Dados |
|-------|----------------|-------|
| [IF.data](https://www3.bcb.gov.br/ifdata/) | REST interno | Ativo total, PL, lucro, crédito, Basileia — por instituição e trimestre |
| [SGS](https://dadosabertos.bcb.gov.br/) | `api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados` | Crédito total, inadimplência, spread (séries mensais) |
| [Olinda](https://olinda.bcb.gov.br/) | `olinda.bcb.gov.br/olinda/servico/taxaJuros/` | Taxas de juros por instituição e modalidade |
| BCB Ranking | Dados de referência | Índice de reclamações por instituição |

## Stack

- **Coleta:** Python 3 + requests (5 scripts independentes)
- **Frontend:** HTML + CSS + JavaScript vanilla + Chart.js
- **Estilo:** Dark/light mode, design minimalista-premium
- **Deploy:** GitHub Pages (estático)
- **Automação:** GitHub Actions — atualização mensal automática (dia 5)

## Executar localmente

```bash
# 1. Coletar dados
cd scripts
pip install -r requirements.txt
python fetch_credito.py
python fetch_taxas.py
python fetch_ifdata.py
python fetch_estban.py
python fetch_reclamacoes.py

# 2. Servir o site
cd ..
python -m http.server 8000
# Abrir http://localhost:8000
```

> **Nota:** O dashboard precisa ser servido via HTTP. Abrir `index.html` direto (`file://`) não carrega os dados.

## Estrutura

```
bcb-financeiro/
├── index.html, app.js, styles.css   # Frontend
├── data/                             # JSONs gerados pelos scripts
├── scripts/                          # Coleta de dados (Python)
│   ├── utils.py                      # Funções compartilhadas
│   ├── fetch_credito.py              # Séries SGS (crédito, inadimplência, spread)
│   ├── fetch_taxas.py                # Taxas de juros por instituição
│   ├── fetch_ifdata.py               # Demonstrações financeiras (IF.data)
│   ├── fetch_estban.py               # Dados geográficos por UF
│   └── fetch_reclamacoes.py          # Ranking de reclamações
└── .github/workflows/                # Automação
    ├── update-data.yml               # Atualização mensal dos dados
    └── deploy-pages.yml              # Deploy automático
```
