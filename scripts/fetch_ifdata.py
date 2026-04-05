"""Coleta demonstrações financeiras do IF.data/BCB (API REST interna)."""

import requests
import json
from utils import save_json, now_iso, classificar_instituicao, INSTITUICOES

BASE = "https://www3.bcb.gov.br/ifdata/rest/arquivos"

# IDs dos campos financeiros (formato 2024, cadastro 1005)
CAMPOS = {
    78182: "ativo_total",
    78183: "carteira_credito",
    78186: "patrimonio_liquido",
    78187: "lucro_liquido",
    78184: "passivo",
    78185: "captacoes",
}

# Campos adicionais para Basileia e capital
CAMPOS_CAPITAL = {
    79664: "indice_basileia",
    79649: "patrimonio_referencia",
}

# Trimestres a coletar (2022 a 2024)
TRIMESTRES = [
    202203, 202206, 202209, 202212,
    202303, 202306, 202309, 202312,
    202403, 202406, 202409, 202412,
]

# 2025+ usa layout diferente no IF.data — será incluído quando disponível no formato padrão
TRIMESTRES_NOVO = []


def fetch_arquivo(nome_arquivo):
    """Busca arquivo JSON da API REST do IF.data."""
    resp = requests.get(BASE, params={"nomeArquivo": nome_arquivo}, timeout=120)
    resp.raise_for_status()
    return resp.json()


def extrair_dados_trimestre(dt, layout="antigo"):
    """Extrai dados financeiros de um trimestre."""
    if layout == "antigo":
        prefix = f"ifdata/{dt}"
        cadastro_file = f"{prefix}/cadastro{dt}_1005.json"
    else:
        prefix = f"ifdata_2025_2030//{dt}"
        cadastro_file = f"{prefix}/cadastro{dt}_1009.json"

    dados_file = f"{prefix}/dados{dt}_1.json"

    print(f"    Cadastro: {cadastro_file}")
    cadastro = fetch_arquivo(cadastro_file)
    c0_map = {int(c["c0"]): c for c in cadastro}

    print(f"    Dados: {dados_file}")
    dados = fetch_arquivo(dados_file)

    resultados = []
    for v in dados["values"]:
        c = c0_map.get(v["e"])
        if not c:
            continue

        nome = c.get("c2", "").strip()
        segmento_bcb = c.get("c12", "")
        tipo = c.get("c4", "")  # C=Conglomerado, I=Independente
        controle = c.get("c7", "")
        uf = c.get("c10", "")
        tcb = c.get("c3", "")  # Tipo consolidado bancário

        vals = {item["i"]: item["v"] for item in v["v"]}

        # Extrair campos financeiros
        ativo = vals.get(78182, 0)
        if ativo == 0 and layout == "novo":
            ativo = vals.get(79853, vals.get(79756, 0))

        pl = vals.get(78186, 0)
        if pl == 0 and layout == "novo":
            pl = vals.get(79858, vals.get(79780, 0))

        lucro = vals.get(78187, 0)
        if lucro == 0 and layout == "novo":
            lucro = vals.get(79859, vals.get(79852, 0))

        credito = vals.get(78183, 0)
        if credito == 0 and layout == "novo":
            credito = vals.get(79854, 0)

        captacao = vals.get(78185, 0)
        basileia = vals.get(79664, vals.get(79790, vals.get(79700, None)))

        # Filtrar: só incluir se tem ativo > 0
        if ativo <= 0:
            continue

        # Calcular indicadores
        roe = round((lucro / pl) * 100, 2) if pl and pl != 0 else None
        roa = round((lucro / ativo) * 100, 4) if ativo and ativo != 0 else None

        resultados.append({
            "nome": nome,
            "c0": v["e"],
            "segmento_bcb": segmento_bcb,
            "segmento": classificar_instituicao(nome),
            "tipo": tipo,
            "controle": controle,
            "tcb": tcb,
            "uf": uf,
            "ativo_total": round(ativo, 2),
            "patrimonio_liquido": round(pl, 2),
            "lucro_liquido": round(lucro, 2),
            "carteira_credito": round(credito, 2),
            "captacoes": round(captacao, 2),
            "indice_basileia": round(basileia, 4) if basileia else None,
            "roe": roe,
            "roa": roa,
        })

    return resultados


def calcular_concentracao(instituicoes, campo="ativo_total"):
    """Calcula market share e HHI."""
    total = sum(i[campo] for i in instituicoes if i[campo] > 0)
    if total == 0:
        return [], 0

    ranking = sorted(instituicoes, key=lambda x: x[campo], reverse=True)
    shares = []
    hhi = 0
    for inst in ranking[:50]:
        share = (inst[campo] / total) * 100
        hhi += share ** 2
        shares.append({
            "nome": inst["nome"],
            "segmento": inst["segmento"],
            "valor": inst[campo],
            "share": round(share, 4),
        })

    return shares, round(hhi, 2)


def main():
    print("── Coletando dados do IF.data ──")

    all_trimestres = {}

    # Trimestres 2022-2024 (layout antigo)
    for dt in TRIMESTRES:
        print(f"  → {dt}...")
        try:
            resultados = extrair_dados_trimestre(dt, layout="antigo")
            all_trimestres[str(dt)] = resultados
            print(f"    {len(resultados)} instituições")
        except Exception as e:
            print(f"    ERRO: {e}")

    # Trimestres 2025+ (layout novo)
    for dt in TRIMESTRES_NOVO:
        print(f"  → {dt} (layout novo)...")
        try:
            resultados = extrair_dados_trimestre(dt, layout="novo")
            all_trimestres[str(dt)] = resultados
            print(f"    {len(resultados)} instituições")
        except Exception as e:
            print(f"    ERRO: {e}")

    # ── Gerar JSONs de saída ──

    # 1. Instituições (tabela-mestre do último trimestre)
    ultimo_dt = max(all_trimestres.keys())
    ultimo = all_trimestres[ultimo_dt]

    instituicoes_master = []
    for inst in sorted(ultimo, key=lambda x: x["ativo_total"], reverse=True):
        instituicoes_master.append({
            "nome": inst["nome"],
            "segmento": inst["segmento"],
            "segmento_bcb": inst["segmento_bcb"],
            "tipo": inst["tipo"],
            "controle": inst["controle"],
            "uf": inst["uf"],
        })

    save_json({
        "last_updated": now_iso(),
        "source": "BCB/IF.data",
        "periodo": ultimo_dt,
        "total": len(instituicoes_master),
        "instituicoes": instituicoes_master,
    }, "instituicoes.json")

    # 2. Resultados financeiros (todos os trimestres, top 50)
    resultados_por_tri = {}
    for dt, insts in all_trimestres.items():
        top50 = sorted(insts, key=lambda x: x["ativo_total"], reverse=True)[:50]
        resultados_por_tri[dt] = [{
            "nome": i["nome"],
            "segmento": i["segmento"],
            "ativo_total": i["ativo_total"],
            "patrimonio_liquido": i["patrimonio_liquido"],
            "lucro_liquido": i["lucro_liquido"],
            "carteira_credito": i["carteira_credito"],
            "captacoes": i["captacoes"],
        } for i in top50]

    save_json({
        "last_updated": now_iso(),
        "source": "BCB/IF.data",
        "trimestres": resultados_por_tri,
    }, "resultados.json")

    # 3. Indicadores (ROE, ROA, Basileia — top 50 + cooperativas)
    indicadores_por_tri = {}
    for dt, insts in all_trimestres.items():
        # Top 50 por ativo + todas cooperativas
        top50_nomes = set(i["nome"] for i in sorted(insts, key=lambda x: x["ativo_total"], reverse=True)[:50])
        cooperativas = [i for i in insts if i["segmento"] == "cooperativa"]
        selecionados = [i for i in insts if i["nome"] in top50_nomes]
        # Adicionar cooperativas que não estão no top 50
        nomes_ja = set(i["nome"] for i in selecionados)
        for coop in sorted(cooperativas, key=lambda x: x["ativo_total"], reverse=True)[:20]:
            if coop["nome"] not in nomes_ja:
                selecionados.append(coop)

        indicadores_por_tri[dt] = [{
            "nome": i["nome"],
            "segmento": i["segmento"],
            "roe": i["roe"],
            "roa": i["roa"],
            "indice_basileia": i["indice_basileia"],
            "ativo_total": i["ativo_total"],
        } for i in selecionados]

    save_json({
        "last_updated": now_iso(),
        "source": "BCB/IF.data",
        "trimestres": indicadores_por_tri,
    }, "indicadores.json")

    # 4. Concentração (market share + HHI)
    concentracao_por_tri = {}
    for dt, insts in all_trimestres.items():
        shares_ativo, hhi_ativo = calcular_concentracao(insts, "ativo_total")
        shares_credito, hhi_credito = calcular_concentracao(insts, "carteira_credito")

        # Market share por segmento
        por_segmento = {}
        total_ativo = sum(i["ativo_total"] for i in insts if i["ativo_total"] > 0)
        for inst in insts:
            seg = inst["segmento"]
            por_segmento.setdefault(seg, 0)
            por_segmento[seg] += inst["ativo_total"]
        share_segmento = {
            seg: round((val / total_ativo) * 100, 2) if total_ativo > 0 else 0
            for seg, val in por_segmento.items()
        }

        concentracao_por_tri[dt] = {
            "hhi_ativo": hhi_ativo,
            "hhi_credito": hhi_credito,
            "top5_share_ativo": round(sum(s["share"] for s in shares_ativo[:5]), 2),
            "top10_share_ativo": round(sum(s["share"] for s in shares_ativo[:10]), 2),
            "share_por_segmento": share_segmento,
            "ranking_ativo": shares_ativo[:20],
            "ranking_credito": shares_credito[:20],
        }

    save_json({
        "last_updated": now_iso(),
        "source": "BCB/IF.data",
        "trimestres": concentracao_por_tri,
    }, "concentracao.json")

    print("── Concluído ──")


if __name__ == "__main__":
    main()
