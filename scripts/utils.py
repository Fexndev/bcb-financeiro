"""Funções utilitárias compartilhadas para coleta de dados do BCB."""

import json
import requests
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SGS_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados"
OLINDA_BASE = "https://olinda.bcb.gov.br/olinda/servico/{servico}/versao/{versao}/odata/{recurso}"

# ── Instituições de referência ─────────────────────────────────────────────
# Segmentos simplificados: grande, outro_banco, cooperativa

INSTITUICOES = {
    "ITAU":        {"cnpj": "60701190", "nome": "Itaú Unibanco",       "segmento": "grande"},
    "BRADESCO":    {"cnpj": "60746948", "nome": "Bradesco",            "segmento": "grande"},
    "BB":          {"cnpj": "00000000", "nome": "Banco do Brasil",     "segmento": "grande"},
    "CAIXA":       {"cnpj": "00360305", "nome": "Caixa Econômica",     "segmento": "grande"},
    "SANTANDER":   {"cnpj": "90400888", "nome": "Santander",           "segmento": "grande"},
    "NUBANK":      {"cnpj": "18236120", "nome": "Nubank",             "segmento": "grande"},
    "BTG":         {"cnpj": "30306294", "nome": "BTG Pactual",         "segmento": "outro_banco"},
    "SAFRA":       {"cnpj": "58160789", "nome": "Safra",               "segmento": "outro_banco"},
    "VOTORANTIM":  {"cnpj": "59588111", "nome": "Banco Votorantim",    "segmento": "outro_banco"},
    "BMG":         {"cnpj": "61186680", "nome": "BMG",                 "segmento": "outro_banco"},
    "PAN":         {"cnpj": "59285411", "nome": "Banco Pan",           "segmento": "outro_banco"},
    "INTER":       {"cnpj": "00416968", "nome": "Banco Inter",         "segmento": "outro_banco"},
    "C6":          {"cnpj": "31872495", "nome": "C6 Bank",             "segmento": "outro_banco"},
    "ORIGINAL":    {"cnpj": "92894922", "nome": "Banco Original",      "segmento": "outro_banco"},
    "BNDES":       {"cnpj": "33657248", "nome": "BNDES",               "segmento": "outro_banco"},
    "BNB":         {"cnpj": "07237373", "nome": "Banco do Nordeste",   "segmento": "outro_banco"},
    "BASA":        {"cnpj": "04902979", "nome": "Banco da Amazônia",   "segmento": "outro_banco"},
    "SICOOB":      {"cnpj": "02038232", "nome": "Sicoob",              "segmento": "cooperativa"},
    "SICREDI":     {"cnpj": "01181521", "nome": "Sicredi",             "segmento": "cooperativa"},
    "UNICRED":     {"cnpj": "00315557", "nome": "Unicred",             "segmento": "cooperativa"},
    "CRESOL":      {"cnpj": "01330387", "nome": "Cresol",              "segmento": "cooperativa"},
}

SEGMENTO_LABELS = {
    "grande":       "Grandes Bancos",
    "outro_banco":  "Outros Bancos",
    "cooperativa":  "Cooperativas",
}

# ── Séries SGS ──────────────────────────────────────────────────────────────

SERIES_CREDITO = {
    "credito_total":     20539,
    "credito_pf":        20541,
    "credito_pj":        20542,
    "inadimplencia":     21082,
    "inadimplencia_pf":  21083,
    "inadimplencia_pj":  21084,
    "spread_total":      20783,
    "spread_pf":         20784,
}


# ── Funções de coleta ───────────────────────────────────────────────────────

def fetch_sgs(serie, data_inicial="01/01/2020", data_final=None):
    """Busca série temporal no SGS do BCB."""
    if data_final is None:
        data_final = datetime.now().strftime("%d/%m/%Y")
    url = SGS_BASE.format(serie=serie)
    resp = requests.get(
        url,
        params={"formato": "json", "dataInicial": data_inicial, "dataFinal": data_final},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_olinda(servico, versao, recurso, params=None):
    """Busca dados na API Olinda do BCB."""
    url = OLINDA_BASE.format(servico=servico, versao=versao, recurso=recurso)
    default_params = {"$format": "json"}
    if params:
        default_params.update(params)
    resp = requests.get(url, params=default_params, timeout=60)
    resp.raise_for_status()
    return resp.json()


# ── Parsing e cálculos ──────────────────────────────────────────────────────

def parse_month(d):
    """DD/MM/YYYY → YYYY-MM"""
    return datetime.strptime(d, "%d/%m/%Y").strftime("%Y-%m")


def parse_date(d):
    """DD/MM/YYYY → YYYY-MM-DD"""
    return datetime.strptime(d, "%d/%m/%Y").strftime("%Y-%m-%d")


def calc_variacao_yoy(series):
    """Calcula variação % ano-a-ano para séries mensais."""
    by_month = {m["data"]: m["valor"] for m in series}
    result = []
    for m in sorted(series, key=lambda x: x["data"]):
        mes = m["data"]
        ano_anterior = str(int(mes[:4]) - 1) + mes[4:]
        if ano_anterior in by_month and by_month[ano_anterior] != 0:
            var = ((m["valor"] / by_month[ano_anterior]) - 1) * 100
            result.append({"data": mes, "valor": round(var, 2)})
    return result


def classificar_instituicao(nome):
    """Classifica uma instituição pelo nome (busca parcial)."""
    nome_upper = nome.upper().strip()
    for key, info in INSTITUICOES.items():
        if key in nome_upper or info["nome"].upper() in nome_upper:
            return info["segmento"]
    # Cooperativas genéricas
    if any(x in nome_upper for x in ["COOP", "CREDI", "SICRED", "SICREDI", "SICOO", "SICOOB",
                                       "UNICR", "UNICRED", "CRESO", "CRESOL", "CENTRAL DE"]):
        return "cooperativa"
    return "outro_banco"


def limpar_nome_instituicao(nome):
    """Limpa e encurta nome de instituição para exibição."""
    nome = nome.strip()
    # Cooperativas — extrair nome curto
    upper = nome.upper()
    if "SICOOB" in upper:
        return "Sicoob"
    if "SICREDI" in upper or "SICRED" in upper:
        return "Sicredi"
    if "UNICRED" in upper:
        return "Unicred"
    if "CRESOL" in upper:
        return "Cresol"
    if "BANCOOB" in upper:
        return "Sicoob"
    # Bancos conhecidos
    replacements = {
        "ITAU UNIBANCO": "Itaú Unibanco",
        "ITAÚ UNIBANCO": "Itaú Unibanco",
        "ITAU": "Itaú",
        "BRADESCO": "Bradesco",
        "SANTANDER": "Santander",
        "CAIXA ECONÔMICA FEDERAL": "Caixa",
        "CAIXA ECONOMICA FEDERAL": "Caixa",
        "BANCO DO BRASIL": "Banco do Brasil",
        "NU PAGAMENTOS": "Nubank",
        "NUBANK": "Nubank",
        "BTG PACTUAL": "BTG Pactual",
        "C6 BANK": "C6 Bank",
        "BANCO INTER": "Inter",
        "BANCO PAN": "Pan",
        "BANCO SAFRA": "Safra",
        "BANCO VOTORANTIM": "Votorantim",
    }
    for key, val in replacements.items():
        if key in upper:
            return val
    # Remover prefixos longos
    for prefix in ["COOPERATIVA DE CRÉDITO", "COOPERATIVA DE CREDITO", "COOPERATIVA DE ECONOMIA",
                    "BANCO ", "BCO ", "COOP "]:
        if upper.startswith(prefix):
            return nome[len(prefix):].strip()[:25]
    return nome[:30]


# ── Persistência ────────────────────────────────────────────────────────────

def save_json(data, filename):
    """Salva dicionário como JSON em /data/."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    filepath = DATA_DIR / filename
    filepath.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"✓ {filepath}")


def now_iso():
    """Timestamp ISO 8601 para last_updated."""
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
