"""Extrai o Anexo Escola e o Anexo SEDUC/URE da Resolução SEDUC nº 106/2026.

Uso:
  pdftotext -enc UTF-8 -raw -f 1411 -l 1455 resolucao.pdf escolas.txt
  pdftotext -enc UTF-8 -raw -f 1456 -l 1457 resolucao.pdf ures.txt
  python tools/extrair.py escolas.txt ures.txt data/
"""
import json
import os
import re
import sys
from collections import Counter

START = re.compile(r"^(\d+) (\d{8}) (.+)$")
CYCLE = {"AI", "AF", "EM", "+"}


def num(tok):
    if tok in ("-", ""):
        return None
    t = tok.replace("%", "").replace(".", "").replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def take_cycle(toks, i):
    out = []
    while i < len(toks) and toks[i] in CYCLE:
        out.append(toks[i])
        i += 1
    return " ".join(out), i


def parse_school(cie, inep, nome, rest):
    full = re.sub(r"(?<=[A-Z])(?=\d+,\d+%)", " ", nome + " " + rest)  # URE colada ao IFA
    toks = full.split()
    while not re.fullmatch(r"\d,\d\d", toks[-1]):  # cabeçalho de página colado
        toks.pop()
    if "SARESP/SAEB" in toks:
        b = toks.index("SARESP/SAEB")
        base = "SARESP/SAEB"
    else:
        b = toks.index("SARESP")
        base = "SARESP"
    pre = toks[:b]
    c = pre.index("Complexidade")
    v = pre.index("Vulnerabilidade")
    nome_tipo = pre[: c - 3]
    if nome_tipo[-3:] == ["ÁREA", "DE", "ASSENTAMENTO"]:
        nome_t, tipo = nome_tipo[:-3], "ÁREA DE ASSENTAMENTO"
    elif nome_tipo[-1] == "EE":
        nome_t, tipo = nome_tipo[:-1], "EE"
    elif nome_tipo[-1].endswith("EE"):
        nome_t, tipo = nome_tipo[:-1] + [nome_tipo[-1][:-2]], "EE"
    else:
        nome_t, tipo = nome_tipo, ""
    rec = {
        "cie": int(cie),
        "inep": inep,
        "nome": " ".join(nome_t),
        "tipo": tipo,
        "vinc": pre[c - 3],
        "jornada": pre[c - 2],
        "icg": pre[c - 1],
        "inse": pre[v - 1],
        "grupo": int(pre[v + 1]),
        "ure": " ".join(pre[v + 2 : -3]),
        "ifaMeta": num(pre[-3]),
        "ifa": num(pre[-2]),
        "ifaOk": pre[-1] == "1",
        "base": base,
    }
    rec["ciclos"], i = take_cycle(toks, b + 1)
    s = toks[i:]
    rec["tpsSrsp"] = num(s[0])
    rec["tpsSrspOk"] = s[1] == "1"
    rec["nfSrsp24"] = num(s[2])
    rec["nfSrsp"] = num(s[3])
    if base == "SARESP/SAEB":
        rec["iqSrsp"] = num(s[4])
        rec["metaSrsp"] = num(s[5])
        rec["icSrsp"] = num(s[6])
        rec["icmSrsp"] = num(s[7])
        rec["tpsSaeb"] = num(toks[-9])
        rec["tpsSaebOk"] = toks[-8] == "1"
        rec["nfSaeb23"] = num(toks[-7])
        rec["nfSaeb"] = num(toks[-6])
        rec["iqSaeb"] = num(toks[-5])
        rec["metaSaeb"] = num(toks[-4])
        rec["icSaeb"] = num(toks[-3])
        rec["icmSaeb"] = num(toks[-2])
    else:
        rec["iqSrsp"] = num(s[4])
        rec["metaSrsp"] = num(s[6])
        rec["metaSrspDiam"] = num(s[7])
        rec["icSrsp"] = num(s[8])
        rec["icmSrsp"] = num(s[9])
        rec["icmSaeb"] = None
    rec["icm"] = num(toks[-1])
    return rec


def parse_escolas(path):
    lines = open(path, encoding="utf-8").read().replace("\f", "\n").splitlines()
    recs, cur, buf = [], None, []

    def flush():
        if cur:
            recs.append(parse_school(*cur, " ".join(buf)))

    for ln in lines:
        m = START.match(ln)
        if m and not ln.startswith("Código"):
            flush()
            cur, buf = m.groups(), []
        elif ln.startswith("Código CIE"):
            flush()
            cur, buf = None, []
        elif cur:
            buf.append(ln)
    flush()
    return recs


def parse_ures(path):
    out = {}
    for ln in open(path, encoding="utf-8").read().replace("\f", "\n").splitlines():
        toks = ln.split()
        if len(toks) < 18:
            continue
        nums = toks[-18:]
        if not all(re.fullmatch(r"[\d.,%]+", t) for t in nums):
            continue
        nome = " ".join(toks[:-18]) or "SEDUC"
        out[nome] = {
            "icmSrsp": num(nums[9]),
            "icmSaeb": num(nums[16]),
            "icm": num(nums[17]),
        }
    return out


def main():
    esc, ure, outdir = sys.argv[1:4]
    recs = parse_escolas(esc)
    ures = parse_ures(ure)
    n = len(recs)
    diam = sum(1 for r in recs if r["icm"] == 1.0)
    ouro_saeb = sum(1 for r in recs if r["icmSaeb"] == 0.5)
    print("escolas", n, "diamante", diam, "icmSaeb=0,50", ouro_saeb, "ures", len(ures) - 1)
    print("tipos", Counter(r["tipo"] for r in recs).most_common(10))
    print("base", Counter(r["base"] for r in recs))
    missing = [r["cie"] for r in recs if r["icm"] is None]
    assert n == 4972, n
    assert diam == 1320, diam
    assert ouro_saeb == 1508, ouro_saeb
    assert not missing, missing[:10]
    bad_ure = sorted({r["ure"] for r in recs} - set(ures))
    assert not bad_ure, bad_ure
    os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(outdir, "escolas.json"), "w", encoding="utf-8") as f:
        json.dump(recs, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(outdir, "ures.json"), "w", encoding="utf-8") as f:
        json.dump(ures, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
