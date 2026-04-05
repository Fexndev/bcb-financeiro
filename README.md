# BCB Financeiro

Dashboard de análise financeira do Sistema Financeiro Nacional com dados públicos do Banco Central do Brasil.

## Dados

| Fonte | Descrição | Atualização |
|-------|-----------|-------------|
| IF.data | Demonstrações financeiras (ativo, PL, lucro, crédito) | Trimestral |
| SGS | Séries de crédito, inadimplência e spread | Mensal |
| Olinda | Taxas de juros por instituição e modalidade | Semanal |
| IF.data (UF) | Distribuição geográfica por UF | Trimestral |
| BCB | Ranking de reclamações | Trimestral |

## Stack

- **Coleta:** Python + requests
- **Frontend:** HTML/CSS/JS + Chart.js
- **Deploy:** GitHub Pages
- **Automação:** GitHub Actions (mensal)

## Executar localmente

```bash
cd scripts
pip install -r requirements.txt
python fetch_credito.py
python fetch_taxas.py
python fetch_ifdata.py
python fetch_estban.py
python fetch_reclamacoes.py
```

Abra `index.html` no navegador.
