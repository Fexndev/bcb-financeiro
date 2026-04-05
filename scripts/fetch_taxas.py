"""Coleta taxas de juros por instituição e modalidade via API Olinda/BCB."""

import requests
from utils import save_json, now_iso, classificar_instituicao

CONSULTA_URL = (
    "https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/"
    "ConsultaUnificada"
)

# Modalidades de interesse (código → label amigável)
MODALIDADES = {
    "218101": {"key": "consignado_inss",    "desc": "Consignado INSS"},
    "220101": {"key": "consignado_publico", "desc": "Consignado Público"},
    "219101": {"key": "consignado_privado", "desc": "Consignado Privado"},
    "221101": {"key": "credito_pessoal",    "desc": "Crédito Pessoal"},
    "401101": {"key": "veiculos",           "desc": "Aquisição de Veículos"},
    "216101": {"key": "cheque_especial",    "desc": "Cheque Especial"},
    "204101": {"key": "cartao_rotativo",    "desc": "Cartão Rotativo"},
    "215101": {"key": "cartao_parcelado",   "desc": "Cartão Parcelado"},
    "210101": {"key": "capital_giro_curto", "desc": "Capital de Giro ≤365d"},
    "211101": {"key": "capital_giro_longo", "desc": "Capital de Giro >365d"},
}


def fetch_todos_registros():
    """Busca todos os registros do ranking unificado (última semana disponível)."""
    resp = requests.get(CONSULTA_URL, params={"$format": "json", "$top": 15000}, timeout=120)
    resp.raise_for_status()
    return resp.json().get("value", [])


def processar_por_modalidade(all_records):
    """Filtra e agrupa registros por modalidade de interesse."""
    resultado = {}

    for cod, info in MODALIDADES.items():
        records = [r for r in all_records if r.get("codigoModalidade") == cod]

        ranking = []
        for r in records:
            inst = r.get("InstituicaoFinanceira", "").strip()
            if not inst:
                continue
            ranking.append({
                "instituicao": inst,
                "cnpj8": r.get("cnpj8", ""),
                "segmento": classificar_instituicao(inst),
                "taxa_am": r.get("TaxaJurosAoMes"),
                "taxa_aa": r.get("TaxaJurosAoAno"),
                "posicao": r.get("Posicao"),
            })

        ranking.sort(key=lambda x: x.get("taxa_aa") or 9999)

        # médias por segmento
        por_seg = {}
        for t in ranking:
            seg = t["segmento"]
            if t["taxa_aa"] is not None:
                por_seg.setdefault(seg, []).append(t["taxa_aa"])

        vals_aa = [t["taxa_aa"] for t in ranking if t["taxa_aa"] is not None]
        media = round(sum(vals_aa) / len(vals_aa), 2) if vals_aa else None

        resultado[info["key"]] = {
            "codigo": cod,
            "descricao": info["desc"],
            "total_instituicoes": len(ranking),
            "media_geral": media,
            "media_por_segmento": {
                seg: round(sum(v) / len(v), 2) for seg, v in por_seg.items()
            },
            "ranking": ranking[:30],
        }

    return resultado


def main():
    print("── Coletando taxas de juros por instituição ──")
    print("  → Buscando ranking unificado...")

    all_records = fetch_todos_registros()
    print(f"    {len(all_records)} registros totais")

    periodo = all_records[0].get("InicioPeriodo", "?") if all_records else "?"
    modalidades = processar_por_modalidade(all_records)

    for key, data in modalidades.items():
        print(f"  → {key}: {data['total_instituicoes']} instituições, média {data['media_geral']}% a.a.")

    resultado = {
        "last_updated": now_iso(),
        "source": "BCB/Olinda - Taxas de Juros",
        "periodo_referencia": periodo,
        "modalidades": modalidades,
    }

    save_json(resultado, "taxas.json")
    print("── Concluído ──")


if __name__ == "__main__":
    main()
