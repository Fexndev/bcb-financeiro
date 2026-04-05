# Planejamento — Projeto BCB Financeiro

## Fase 1: Coleta de Dados
- [ ] Coletar dados do IF.data (demonstrações financeiras trimestrais)
- [ ] Configurar scripts para API SGS (séries temporais: Selic, IPCA, crédito, inadimplência)
- [ ] Coletar taxas de juros por instituição via API Olinda/BCB
- [ ] Baixar ESTBAN (estatística bancária por município)
- [ ] Coletar ranking de reclamações

## Fase 2: Tratamento
- [ ] Padronizar nomes de instituições entre as fontes
- [ ] Classificar instituições por segmento (grandes, médios, digitais, cooperativas, públicos)
- [ ] Tratar dados do ESTBAN (mapear verbas contábeis)
- [ ] Unificar períodos e granularidade temporal
- [ ] Criar tabela-mestre de instituições com metadados

## Fase 3: Análise
- [ ] Calcular indicadores financeiros (ROE, ROA, Basileia, margem)
- [ ] Análise de market share e concentração (HHI)
- [ ] Comparativo bancos vs cooperativas (taxas, inadimplência, crescimento)
- [ ] Evolução temporal do crédito por segmento e modalidade
- [ ] Análise geográfica de crédito/depósitos (ESTBAN)
- [ ] Correlação reclamações vs crescimento

## Fase 4: Visualização
- [ ] Gráficos de ranking (barras horizontais) — rentabilidade por instituição
- [ ] Séries temporais — evolução do crédito e market share
- [ ] Mapa coroplético — crédito per capita por estado/município
- [ ] Heatmap — taxas de juros por instituição x modalidade
- [ ] Scatter — ROE vs tamanho da carteira

## Fase 5: Dashboard
- [ ] Montar dashboard interativo (Streamlit)
- [ ] Filtros por segmento, período, modalidade
- [ ] Publicar/documentar

## Ordem de Execução Sugerida

1. Começar pela **API SGS** (mais fácil, JSON direto)
2. Depois **taxas de juros por instituição** (API Olinda)
3. Depois **IF.data** (pode exigir scraping)
4. **ESTBAN** e **reclamações** por último (complementares)
