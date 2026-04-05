"""Coleta séries de crédito, inadimplência e spread do SFN via API SGS/BCB."""

from utils import (
    fetch_sgs, parse_month, calc_variacao_yoy, save_json, now_iso,
    SERIES_CREDITO,
)


def coletar_serie(nome, codigo):
    """Coleta e formata uma série SGS em valores mensais."""
    raw = fetch_sgs(codigo)
    monthly = []
    for item in raw:
        monthly.append({
            "data": parse_month(item["data"]),
            "valor": float(item["valor"]),
        })
    return monthly


def main():
    print("── Coletando séries de crédito do SFN ──")

    resultado = {
        "last_updated": now_iso(),
        "source": "BCB/SGS",
        "series": {},
    }

    for nome, codigo in SERIES_CREDITO.items():
        print(f"  → {nome} (SGS {codigo})...")
        try:
            monthly = coletar_serie(nome, codigo)
            yoy = calc_variacao_yoy(monthly)
            resultado["series"][nome] = {
                "codigo_sgs": codigo,
                "monthly": monthly,
                "variacao_yoy": yoy,
                "ultimo": monthly[-1] if monthly else None,
            }
            print(f"    {len(monthly)} registros")
        except Exception as e:
            print(f"    ERRO: {e}")
            resultado["series"][nome] = {"codigo_sgs": codigo, "erro": str(e)}

    # resumo atual
    series = resultado["series"]
    resultado["resumo"] = {}
    for key in ["credito_total", "credito_pf", "credito_pj"]:
        if key in series and "ultimo" in series[key] and series[key]["ultimo"]:
            resultado["resumo"][key] = series[key]["ultimo"]
    for key in ["inadimplencia", "inadimplencia_pf", "inadimplencia_pj"]:
        if key in series and "ultimo" in series[key] and series[key]["ultimo"]:
            resultado["resumo"][key] = series[key]["ultimo"]
    for key in ["spread_total", "spread_pf"]:
        if key in series and "ultimo" in series[key] and series[key]["ultimo"]:
            resultado["resumo"][key] = series[key]["ultimo"]

    save_json(resultado, "credito.json")
    print("── Concluído ──")


if __name__ == "__main__":
    main()
