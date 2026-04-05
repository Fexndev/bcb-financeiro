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
    """Retorna nome curto para agregação (sistemas de cooperativas → nome do sistema)."""
    nome = nome.strip()
    upper = nome.upper()

    # Cooperativas — agregar por sistema
    if "SICOOB" in upper or "BANCOOB" in upper:
        return "Sicoob"
    if "SICREDI" in upper or "SICRED" in upper:
        return "Sicredi"
    if "UNICRED" in upper:
        return "Unicred"
    if "CRESOL" in upper or "INTERAÇÃO SOLIDÁRIA" in upper or "INTERACAO SOLIDARIA" in upper:
        return "Cresol"

    # Mapeamento de nomes conhecidos
    MAPA = {
        "ITAU UNIBANCO": "Itaú Unibanco", "ITAÚ UNIBANCO": "Itaú Unibanco",
        "ITAU": "Itaú", "ITAÚ": "Itaú",
        "BRADESCO": "Bradesco", "SANTANDER": "Santander",
        "CAIXA ECONÔMICA": "Caixa", "CAIXA ECONOMICA": "Caixa",
        "BANCO DO BRASIL": "Banco do Brasil", "BB -": "BB",
        "NU PAGAMENTOS": "Nubank", "NUBANK": "Nubank",
        "BTG PACTUAL": "BTG Pactual", "C6 BANK": "C6 Bank",
        "BANCO INTER": "Inter", "BANCO PAN": "Pan",
        "BANCO SAFRA": "Safra", "BANCO VOTORANTIM": "Votorantim",
        "BNDES": "BNDES",
        "BANCO DO NORDESTE": "Banco do Nordeste",
        "BANCO DA AMAZONIA": "Banco da Amazônia", "BANCO DA AMAZÔNIA": "Banco da Amazônia",
        "NACIONAL DE DESENVOLVIMENTO": "BNDES",
        "BANRISUL": "Banrisul", "DAYCOVAL": "Daycoval",
        "CITIBANK": "Citibank", "BMG": "BMG",
        "JP MORGAN": "JP Morgan", "GOLDMAN SACHS": "Goldman Sachs",
        "MORGAN STANLEY": "Morgan Stanley", "DEUTSCHE BANK": "Deutsche Bank",
        "BNP PARIBAS": "BNP Paribas", "SOCIETE GENERALE": "Société Générale",
        "CREDIT SUISSE": "Credit Suisse", "UBS": "UBS",
        "HSBC": "HSBC", "RABOBANK": "Rabobank",
        "BOFA MERRILL": "Bank of America",
        "CRÉDIT AGRICOLE": "Crédit Agricole", "CREDIT AGRICOLE": "Crédit Agricole",
        "MUFG BRASIL": "MUFG", "MIZUHO": "Mizuho",
        "BOCOM": "Bocom BBM", "CIELO": "Cielo",
        "REDECARD": "Rede", "GETNET": "Getnet",
        "PAGSEGURO": "PagSeguro", "PAGBANK": "PagBank",
        "STONE": "Stone", "MERCADO PAGO": "Mercado Pago",
        "PICPAY": "PicPay", "AGIBANK": "Agibank",
        "BANESTES": "Banestes", "BRB": "BRB",
        "ABC-BRASIL": "ABC Brasil", "PINE": "Pine",
        "ORIGINAL": "Original", "MASTER": "Master",
        "CLASSICO": "Clássico", "CCB": "CCB Brasil",
        "VOLKSWAGEN": "VW Financeira", "MERCEDES-BENZ": "Mercedes-Benz",
        "CNH INDUSTRIAL": "CNH Industrial", "CSF": "Carrefour",
        "XP": "XP", "MODAL": "Modal", "VOITER": "Voiter",
        "MERCANTIL DO BRASIL": "Mercantil do Brasil",
        "REGIONAL DE DESENVOLVIMENTO": "BRDE",
    }
    for key, val in MAPA.items():
        if key in upper:
            return val

    # Remover prefixos genéricos
    for prefix in ["BANCO ", "BCO ", "COOP ", "CIA "]:
        if upper.startswith(prefix):
            nome = nome[len(prefix):].strip()
            upper = nome.upper()

    # Remover sufixos comuns
    for suffix in [" S.A.", " S.A", " LTDA.", " LTDA", " - PRUDENCIAL",
                   " INSTITUIÇÃO DE PAGAMENTO", " INSTITUICAO DE PAGAMENTO"]:
        if upper.endswith(suffix.upper()):
            nome = nome[:len(nome)-len(suffix)].strip()

    return nome[:30]


def limpar_nome_singular(nome):
    """Retorna nome legível para cooperativa singular."""
    nome = nome.strip()
    upper = nome.upper()

    # 1. Tentar extrair nome após " - " (padrão: "COOP LONGA - NOME CURTO")
    # Separadores possíveis: " - " ou "-" colado
    sep = " - " if " - " in nome else ("-" if nome.count("-") == 1 else None)
    if sep and sep in nome:
        parts = [p.strip() for p in nome.split(sep) if len(p.strip()) > 3]
        if parts:
            # Preferir a parte MAIS CURTA que contenha nome do sistema (é o nome fantasia)
            with_sistema = [p for p in parts if any(s in p.upper() for s in ["SICOOB","SICREDI","UNICRED","CRESOL"])]
            if with_sistema:
                best = min(with_sistema, key=len)
            else:
                best = parts[-1]  # última parte = nome fantasia
            for suf in [" LTDA.", " LTDA", " S.A.", "."]:
                if best.upper().endswith(suf.upper()):
                    best = best[:len(best)-len(suf)].strip()
            return best[:40]

    # 2. Remover prefixos longos (do mais longo para o mais curto)
    prefixos = [
        "COOPERATIVA DE CRÉDITO, POUPANÇA E INVESTIMENTO ",
        "COOPERATIVA DE CREDITO, POUPANÇA E INVESTIMENTO ",
        "COOPERATIVA DE CRÉDITO E INVESTIMENTO COM INTERAÇÃO SOLIDÁRIA ",
        "COOPERATIVA DE CREDITO E INVESTIMENTO COM INTERACAO SOLIDARIA ",
        "COOPERATIVA DE CRÉDITO E ECONOMIA COM INTERAÇÃO SOLIDÁRIA ",
        "COOPERATIVA CENTRAL DE CRÉDITO E INVESTIMENTO COM INTERAÇÃO SOLIDÁRIA ",
        "COOPERATIVA CENTRAL DE CRÉDITO E ECONOMIA COM INTERAÇÃO SOLIDÁRIA ",
        "COOPERATIVA CENTRAL DE CRÉDITO COM INTERAÇÃO SOLIDÁRIA ",
        "CONFEDERAÇÃO NACIONAL DAS COOPERATIVAS CENTRAIS DE CRÉDITO E ECONOMIA COM INTERAÇÃO SOLIDÁRIA ",
        "COOPERATIVA CENTRAL DE CRÉDITO ",
        "COOPERATIVA CENTRAL DE CREDITO ",
        "COOPERATIVA DE CRÉDITO DE LIVRE ADMISSÃO ",
        "COOPERATIVA DE CREDITO DE LIVRE ADMISSAO ",
        "COOPERATIVA DE CRÉDITO MÚTUO ",
        "COOPERATIVA DE CREDITO MUTUO ",
        "COOPERATIVA DE CRÉDITO ",
        "COOPERATIVA DE CREDITO ",
        "COOPERATIVA DE ECONOMIA E CRÉDITO MÚTUO ",
        "COOPERATIVA DE ECONOMIA E CREDITO MUTUO ",
        "CONFEDERAÇÃO NACIONAL DAS COOPERATIVAS ",
        "CENTRAL DAS COOPERATIVAS ",
    ]
    for p in sorted(prefixos, key=len, reverse=True):
        if upper.startswith(p.upper()):
            rest = nome[len(p):].strip()
            for suf in [" LTDA.", " LTDA", " S.A.", " S.A"]:
                if rest.upper().endswith(suf.upper()):
                    rest = rest[:len(rest)-len(suf)].strip()
            if rest:
                return rest[:40]

    # 3. Para nomes que contêm o sistema, extrair nome do sistema + complemento
    import re
    for sistema in ["UNICRED", "SICOOB", "SICREDI", "CRESOL"]:
        match = re.search(rf'({sistema}\s+\S+(?:\s+\S+)?)', upper)
        if match:
            start = match.start()
            return nome[start:start+40].strip()

    # 4. Fallback
    for suf in [" LTDA.", " LTDA", " S.A.", " S.A"]:
        if upper.endswith(suf.upper()):
            nome = nome[:len(nome)-len(suf)].strip()
    return nome[:40]


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
