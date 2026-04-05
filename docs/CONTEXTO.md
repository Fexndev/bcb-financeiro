# Projeto: Análise Financeira de Instituições do Sistema Financeiro Nacional

## Visão Geral

Projeto de análise de dados públicos do Banco Central do Brasil (BCB) para investigar a saúde financeira, comportamento de crédito e competitividade de bancos e cooperativas de crédito no Brasil.

**Autor:** Fernando (Analista de Dados)
**Início:** Abril/2026
**Status:** Em planejamento

---

## Objetivos

1. **Mapear a saúde financeira** das instituições (bancos comerciais, bancos de investimento, cooperativas de crédito) usando indicadores como lucro líquido, patrimônio líquido, ROE e ROA.
2. **Analisar a evolução do crédito** por tipo de instituição e modalidade, identificando tendências de expansão ou retração.
3. **Comparar bancos vs cooperativas** em termos de taxas de juros, inadimplência, crescimento e presença geográfica.
4. **Medir a concentração bancária** — quanto do mercado os maiores bancos detêm e como isso evolui.
5. **Visualizar a distribuição geográfica** de crédito e depósitos por estado/município.

---

## Fontes de Dados

### 1. IF.data (Dados de Instituições Financeiras)
- **O que é:** Portal do BCB com demonstrações financeiras trimestrais de todas as instituições autorizadas.
- **URL:** https://www3.bcb.gov.br/ifdata/
- **Dados disponíveis:**
  - Ativo total, passivo, patrimônio líquido
  - Lucro líquido
  - Carteira de crédito (por modalidade)
  - Captação (depósitos)
  - Índice de Basileia
  - Número de agências e postos
- **Granularidade:** Por instituição, trimestral
- **Período:** Disponível desde 2010+
- **Formatos:** CSV via download ou scraping da interface web

### 2. SGS — Sistema Gerenciador de Séries Temporais
- **O que é:** API pública do BCB com milhares de séries temporais econômicas e financeiras.
- **URL base da API:** https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json
- **Séries relevantes:**
  - Selic (código 432)
  - IPCA (código 433)
  - Crédito total do SFN (códigos 20539, 20541, 20542)
  - Inadimplência (códigos 21082, 21083, 21084)
  - Spread bancário (códigos 20783, 20784)
- **Formato:** JSON / CSV
- **Documentação:** https://dadosabertos.bcb.gov.br/

### 3. Taxas de Juros por Instituição
- **O que é:** Taxas praticadas por cada instituição em cada modalidade de crédito.
- **URL:** https://www.bcb.gov.br/estatisticas/txjuros
- **API:** https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/
- **Dados disponíveis:**
  - Taxa média mensal e anual por instituição
  - Modalidades: consignado, veículos, imobiliário, cheque especial, cartão de crédito, capital de giro, etc.
- **Granularidade:** Por instituição, por modalidade, mensal

### 4. ESTBAN — Estatística Bancária por Município
- **O que é:** Dados de saldos de operações bancárias por agência/município.
- **URL:** https://www.bcb.gov.br/estatisticas/estatisticabancariamunicipios
- **Dados disponíveis:**
  - Depósitos (à vista, poupança, a prazo)
  - Operações de crédito
  - Por município e por agência
- **Granularidade:** Mensal, por município
- **Formato:** CSV compactado

### 5. Ranking de Reclamações
- **O que é:** Ranking trimestral de reclamações registradas contra instituições financeiras.
- **URL:** https://www.bcb.gov.br/ranking
- **Dados disponíveis:**
  - Total de reclamações por instituição
  - Índice de reclamações (por milhão de clientes)
  - Percentual de reclamações procedentes
- **Formato:** CSV / planilha

### 6. Dados Abertos do BCB (Portal)
- **URL:** https://dadosabertos.bcb.gov.br/
- **Datasets adicionais:**
  - Lista de instituições autorizadas
  - Agências bancárias
  - Correspondentes bancários
  - Cooperativas de crédito

---

## Estrutura do Projeto

```
bcb-financeiro/
├── 01_dados_brutos/          # Dados baixados sem alteração
│   ├── ifdata/               # Demonstrações financeiras
│   ├── sgstaxas/             # Séries temporais e taxas de juros
│   ├── estban/               # Estatística bancária municipal
│   └── reclamacoes/          # Ranking de reclamações
├── 02_coleta/                # Scripts de coleta/download de dados
├── 03_tratamento/            # Scripts de limpeza e transformação
├── 04_analise/               # Notebooks de análise exploratória
├── 05_visualizacao/          # Gráficos e mapas exportados
├── 06_dashboard/             # Dashboard interativo (Streamlit ou similar)
└── docs/                     # Documentação do projeto
    ├── CONTEXTO.md           # Este documento
    └── PLANEJAMENTO.md       # Cronograma e etapas
```

---

## Segmentação das Instituições

Para análise, as instituições serão agrupadas em:

| Segmento | Exemplos |
|----------|----------|
| **Bancos Grandes (S1)** | Itaú, Bradesco, Banco do Brasil, Caixa, Santander |
| **Bancos Médios (S2/S3)** | BTG, Safra, Votorantim, BMG, Pan |
| **Bancos Digitais** | Nubank, Inter, C6, Original, Neon |
| **Cooperativas** | Sicoob, Sicredi, Unicred, Cresol |
| **Bancos Públicos** | BB, Caixa, BNDES, BNB, Basa |
| **Financeiras/SCDs** | Creditas, Will Bank, Agibank |

---

## Indicadores-Chave

### Saúde Financeira
- **ROE** (Return on Equity) = Lucro Líquido / Patrimônio Líquido
- **ROA** (Return on Assets) = Lucro Líquido / Ativo Total
- **Índice de Basileia** = Capital / Ativos Ponderados pelo Risco
- **Margem Líquida** = Lucro Líquido / Receita Total

### Crédito
- **Carteira de Crédito Total** (e por modalidade)
- **Inadimplência** (% da carteira com atraso > 90 dias)
- **Spread Bancário** (diferença entre taxa de captação e taxa de empréstimo)
- **Taxa Média de Juros** por modalidade

### Mercado
- **Market Share** de crédito e depósitos (por instituição e segmento)
- **HHI** (Índice Herfindahl-Hirschman) para medir concentração
- **Crescimento da carteira** (YoY, QoQ)

### Atendimento
- **Índice de reclamações** por milhão de clientes
- **Cobertura geográfica** (agências por estado/município)

---

## Ferramentas e Stack

- **Python 3.10+**
- **Pandas / Polars** — manipulação de dados
- **Requests / httpx** — coleta de APIs
- **Plotly / Matplotlib / Seaborn** — visualizações
- **GeoPandas + Folium** — mapas
- **Streamlit** — dashboard interativo
- **Jupyter Notebook** — análise exploratória
- **GitHub** — versionamento

---

## Perguntas que o Projeto Deve Responder

1. Quais instituições são mais rentáveis? Cooperativas competem com grandes bancos em rentabilidade?
2. Como a participação de mercado (crédito) mudou nos últimos 5 anos? Bancos digitais e cooperativas ganharam espaço?
3. Quais instituições praticam as menores taxas de juros por modalidade? Cooperativas realmente cobram menos?
4. Qual o nível de concentração bancária no Brasil e como ele evoluiu?
5. Como se distribui o crédito geograficamente? Há municípios "desbancarizados"?
6. Existe correlação entre índice de reclamações e crescimento da base de clientes?
7. Quais segmentos de crédito (consignado, imobiliário, veículos) cresceram mais?

---

## Limitações e Considerações

- **Defasagem:** Dados do IF.data são trimestrais com ~2 meses de atraso.
- **Comparabilidade:** Instituições de portes muito diferentes requerem normalização (indicadores relativos, não absolutos).
- **Cooperativas:** Algumas cooperativas singulares reportam dados consolidados no sistema central — atentar para dupla contagem.
- **Bancos digitais:** Nem todos são "bancos" regulatoriamente — alguns são SCDs ou SEPs, com dados em categorias diferentes.
- **ESTBAN:** Dados por verbas contábeis, exigem mapeamento para torná-los legíveis.
