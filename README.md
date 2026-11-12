# Consulta do bônus por escola — BR 2025

Página estática para consultar o ICM de cada escola estadual de SP na Bonificação por Resultados do exercício 2025, conforme a **Resolução SEDUC nº 106, de 11/11/2026** (DOE de 12/11/2026).

- 4.972 escolas do Anexo Escola (págs. 1411–1455 da resolução)
- 1.320 Diamante (ICM 1,00), 3.073 parciais, 579 com ICM 0
- Busca por nome, CIE ou INEP; filtro por URE e situação; detalhe com SARESP + SAEB e gatilhos
- Link direto para uma escola: `.../#CIE` (ex.: `#12`)

## Publicar no GitHub Pages

1. Crie um repositório público no GitHub (ex.: `bonus-br-2025`).
2. Envie os arquivos desta pasta (`index.html`, `style.css`, `app.js`, `data/`, `tools/`, `README.md`):
   ```bash
   git init
   git add .
   git commit -m "Consulta bônus BR 2025"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/bonus-br-2025.git
   git push -u origin main
   ```
   (ou use "Add file → Upload files" no site do GitHub)
3. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. Em 1–2 minutos o site fica em `https://SEU_USUARIO.github.io/bonus-br-2025/`.

## Testar localmente

```bash
python -m http.server 8000
```
Abra http://localhost:8000 (abrir o `index.html` direto pelo arquivo não carrega os dados).

## Regerar os dados

```bash
pdftotext -enc UTF-8 -raw -f 1411 -l 1455 resolucao.pdf escolas.txt
pdftotext -enc UTF-8 -raw -f 1456 -l 1457 resolucao.pdf ures.txt
python tools/extrair.py escolas.txt ures.txt data/
```
O script confere os totais da Tabela 3 da resolução (4.972 escolas, 1.320 Diamante, 1.508 com ICM‑SAEB 0,50) e falha se não baterem.

Página não oficial. Em caso de divergência, vale a publicação no Diário Oficial.
