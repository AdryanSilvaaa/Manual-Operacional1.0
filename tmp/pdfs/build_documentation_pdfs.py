from pathlib import Path
import re
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
OUT = Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)

SOURCES = [
    (DOCS / "PROJETO.md", "01-Visao-Geral-do-Projeto.pdf"),
    (DOCS / "INSTALACAO-E-OPERACAO.md", "02-Instalacao-e-Operacao.pdf"),
    (DOCS / "GUIA-TREINAMENTO-E-PAINEL.md", "03-Treinamento-Painel-e-Seguranca.pdf"),
    (DOCS / "ARMAZENAMENTO_GOOGLE_CLOUD.md", "04-Armazenamento-Google-Cloud.pdf"),
    (DOCS / "API.md", "05-Referencia-Consolidada-da-API.pdf"),
    (DOCS / "API-DETALHADA.md", "06-API-Detalhada-Endpoint-por-Endpoint.pdf"),
    (DOCS / "BANCO-DE-DADOS.md", "07-Banco-de-Dados.pdf"),
    (DOCS / "BANCO-DE-DADOS-DETALHADO.md", "08-Banco-de-Dados-Detalhado.pdf"),
    (DOCS / "TABELAS-DO-BANCO.md", "09-Tabelas-do-Banco-de-Dados.pdf"),
    (DOCS / "apis" / "HEALTH.md", "10-API-Saude.pdf"),
    (DOCS / "apis" / "AUTH.md", "11-API-Autenticacao.pdf"),
    (DOCS / "apis" / "USERS.md", "12-API-Usuarios.pdf"),
    (DOCS / "apis" / "SECTORS.md", "13-API-Setores.pdf"),
    (DOCS / "apis" / "SYSTEMS.md", "14-API-Sistemas.pdf"),
    (DOCS / "apis" / "MANUALS.md", "15-API-Manuais.pdf"),
    (DOCS / "apis" / "PROGRESS.md", "16-API-Progresso.pdf"),
    (DOCS / "apis" / "QUIZ.md", "17-API-Questionarios.pdf"),
]

font_regular = Path("C:/Windows/Fonts/arial.ttf")
font_bold = Path("C:/Windows/Fonts/arialbd.ttf")
if font_regular.exists() and font_bold.exists():
    pdfmetrics.registerFont(TTFont("DocRegular", str(font_regular)))
    pdfmetrics.registerFont(TTFont("DocBold", str(font_bold)))
    REGULAR, BOLD = "DocRegular", "DocBold"
else:
    REGULAR, BOLD = "Helvetica", "Helvetica-Bold"

NAVY = colors.HexColor("#142B4A")
BLUE = colors.HexColor("#2563A6")
LIGHT = colors.HexColor("#EAF1F8")
MID = colors.HexColor("#C9D7E6")
TEXT = colors.HexColor("#202A35")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="DocTitle", fontName=BOLD, fontSize=22, leading=27,
                          textColor=NAVY, alignment=TA_CENTER, spaceAfter=18))
styles.add(ParagraphStyle(name="DocSubtitle", fontName=REGULAR, fontSize=10, leading=14,
                          textColor=colors.HexColor("#536273"), alignment=TA_CENTER))
styles.add(ParagraphStyle(name="H1x", fontName=BOLD, fontSize=16, leading=20,
                          textColor=NAVY, spaceBefore=12, spaceAfter=7, keepWithNext=True))
styles.add(ParagraphStyle(name="H2x", fontName=BOLD, fontSize=12.5, leading=16,
                          textColor=BLUE, spaceBefore=10, spaceAfter=5, keepWithNext=True))
styles.add(ParagraphStyle(name="H3x", fontName=BOLD, fontSize=10.5, leading=14,
                          textColor=NAVY, spaceBefore=8, spaceAfter=4, keepWithNext=True))
styles.add(ParagraphStyle(name="Bodyx", fontName=REGULAR, fontSize=9.2, leading=13.2,
                          textColor=TEXT, spaceAfter=5, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="Bulletx", parent=styles["Bodyx"], leftIndent=12,
                          firstLineIndent=-7, bulletIndent=2, spaceAfter=3))
styles.add(ParagraphStyle(name="Codex", fontName="Courier", fontSize=7.6, leading=10,
                          textColor=colors.HexColor("#17202A"), backColor=colors.HexColor("#F4F6F8"),
                          borderColor=MID, borderWidth=.5, borderPadding=6, spaceBefore=3, spaceAfter=7))
styles.add(ParagraphStyle(name="TableHead", fontName=BOLD, fontSize=7.5, leading=9.5,
                          textColor=colors.white))
styles.add(ParagraphStyle(name="TableCell", fontName=REGULAR, fontSize=7.3, leading=9.4,
                          textColor=TEXT))


def esc(value):
    value = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    value = re.sub(r"`([^`]+)`", r"<font name='Courier'>\1</font>", value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", value)
    return value


def footer(canvas, doc):
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(MID)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFont(REGULAR, 7.5)
    canvas.setFillColor(colors.HexColor("#667789"))
    canvas.drawString(18 * mm, 9 * mm, "Manual Operacional Digital")
    canvas.drawRightString(width - 18 * mm, 9 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


def parse_table(lines, index):
    rows = []
    while index < len(lines) and lines[index].strip().startswith("|"):
        row = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
        if not all(re.fullmatch(r":?-{3,}:?", cell or "") for cell in row):
            rows.append(row)
        index += 1
    if not rows:
        return None, index
    columns = max(len(row) for row in rows)
    data = []
    for ridx, row in enumerate(rows):
        row += [""] * (columns - len(row))
        style = styles["TableHead"] if ridx == 0 else styles["TableCell"]
        data.append([Paragraph(esc(cell), style) for cell in row])
    usable = A4[0] - 36 * mm
    widths = [usable / columns] * columns
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), .4, MID),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table, index


def markdown_story(text, source_name):
    lines = text.replace("\r\n", "\n").split("\n")
    title = next((line[2:].strip() for line in lines if line.startswith("# ")), source_name)
    story = [Spacer(1, 20 * mm), Paragraph(esc(title), styles["DocTitle"]),
             Paragraph("Documentacao tecnica - Manual Operacional Digital", styles["DocSubtitle"]),
             Spacer(1, 14 * mm)]
    in_code = False
    code = []
    paragraph = []

    def flush_paragraph():
        if paragraph:
            story.append(Paragraph(esc(" ".join(p.strip() for p in paragraph)), styles["Bodyx"]))
            paragraph.clear()

    i = 0
    skipped_title = False
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped.startswith("```"):
            flush_paragraph()
            if in_code:
                story.append(Paragraph("<br/>".join(esc(x).replace(" ", "&nbsp;") for x in code) or " ", styles["Codex"]))
                code = []
            in_code = not in_code
            i += 1
            continue
        if in_code:
            code.append(line)
            i += 1
            continue
        if not stripped:
            flush_paragraph()
            i += 1
            continue
        if stripped.startswith("|"):
            flush_paragraph()
            table, i = parse_table(lines, i)
            story.extend([table, Spacer(1, 5)])
            continue
        if line.startswith("# "):
            flush_paragraph()
            if not skipped_title:
                skipped_title = True
            else:
                story.append(Paragraph(esc(line[2:].strip()), styles["H1x"]))
        elif line.startswith("## "):
            flush_paragraph(); story.append(Paragraph(esc(line[3:].strip()), styles["H1x"]))
        elif line.startswith("### "):
            flush_paragraph(); story.append(Paragraph(esc(line[4:].strip()), styles["H2x"]))
        elif line.startswith("#### "):
            flush_paragraph(); story.append(Paragraph(esc(line[5:].strip()), styles["H3x"]))
        elif re.match(r"^[-*] ", stripped):
            flush_paragraph(); story.append(Paragraph("• " + esc(stripped[2:]), styles["Bulletx"]))
        elif re.match(r"^\d+\. ", stripped):
            flush_paragraph(); story.append(Paragraph(esc(stripped), styles["Bulletx"]))
        elif stripped == "---":
            flush_paragraph(); story.append(Spacer(1, 5))
        else:
            paragraph.append(stripped)
        i += 1
    flush_paragraph()
    if in_code and code:
        story.append(Paragraph("<br/>".join(esc(x) for x in code), styles["Codex"]))
    return story


def build(source, destination):
    frame = Frame(18 * mm, 18 * mm, A4[0] - 36 * mm, A4[1] - 34 * mm, id="main")
    doc = BaseDocTemplate(str(destination), pagesize=A4, rightMargin=18 * mm,
                          leftMargin=18 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
                          title=source.stem, author="Manual Operacional Digital")
    doc.addPageTemplates([PageTemplate(id="docs", frames=[frame], onPage=footer)])
    doc.build(markdown_story(source.read_text(encoding="utf-8"), source.stem))


for source, filename in SOURCES:
    if not source.exists():
        raise FileNotFoundError(source)
    build(source, OUT / filename)

print(f"Gerados {len(SOURCES)} PDFs em {OUT}")
