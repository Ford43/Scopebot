import os
import fitz
import docx
import pandas as pd
import json
import re
from bs4 import BeautifulSoup
from langchain_core.documents import Document


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ฟังก์ชันอ่านแต่ละประเภทไฟล์
def load_pdf(path):
    with fitz.open(path) as doc:
        return "\n".join(page.get_text() for page in doc)


def load_pdf_pages(path, metadata):
    """Physical file pages, numbered from one; skip blanks without renumbering."""
    pages = []
    with fitz.open(path) as pdf:
        for number, page in enumerate(pdf, 1):
            text = page.get_text()
            if text.strip():
                pages.append(Document(page_content=text, metadata={**metadata,
                    "page": number, "page_count": len(pdf)}))
    return pages


def load_txt(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def load_docx(path):
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    doc = docx.Document(path)
    def blocks(parent):
        element = parent._element.body if hasattr(parent._element, "body") else parent._tc
        for child in element.iterchildren():
            if child.tag.endswith('}p'):
                yield Paragraph(child, parent).text
            elif child.tag.endswith('}tbl'):
                table = Table(child, parent)
                rows = [[" / ".join(t for t in blocks(cell) if t.strip()) for cell in row.cells]
                        for row in table.rows]
                if not rows:
                    continue
                header_properties = table.rows[0]._tr.trPr
                declared_header = header_properties is not None and any(
                    child.tag.endswith('}tblHeader') for child in header_properties)
                has_labels = declared_header or all(value.strip() and not re.search(r'\d', value) for value in rows[0])
                # Preserve the first row as well: headerless tables must not
                # silently lose their first record. Repeat labels on data rows.
                yield " | ".join(rows[0])
                for row in rows[1:]:
                    yield "- " + " | ".join(
                        f"{rows[0][i]}: {value}" if has_labels and i < len(rows[0]) and rows[0][i] else value
                        for i, value in enumerate(row))
    return "\n".join(blocks(doc))


def load_csv(path):
    df = pd.read_csv(path)
    return df.to_string(index=False)


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return json.dumps(data, ensure_ascii=False, indent=2)


def load_html(path):
    with open(path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")
    return soup.get_text()


def load_md(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def load_documents(bot_id=None, *, data_path=None, strict=False):

    data_path = data_path or os.path.join(BASE_DIR, "data", bot_id)
    print(f"[loader] Looking in: {data_path}")

    documents = []

    if not os.path.exists(data_path):
        print(f" No data folder for bot: {bot_id}")
        return documents

    for file in os.listdir(data_path):

        path = os.path.join(data_path, file)

        try:
            extension = os.path.splitext(file)[1].lower()
            if extension == ".pdf":
                pages = load_pdf_pages(path, {"source": file, "bot_id": bot_id})
                if strict and not pages:
                    raise ValueError(f"No readable text: {file}")
                documents.extend(pages)
                print(f"Loaded: {file} ({len(pages)} readable pages)")
                continue
            elif extension == ".docx":
                text = load_docx(path)
            elif extension == ".txt":
                text = load_txt(path)
            elif extension == ".csv":
                text = load_csv(path)
            elif extension == ".json":
                text = load_json(path)
            elif extension == ".html":
                text = load_html(path)
            elif extension == ".md":
                text = load_md(path)
            else:
                if strict:
                    raise ValueError(f"Unsupported file: {file}")
                print(f"[loader] Unsupported file: {file}")
                continue

            if strict and not text.strip():
                raise ValueError(f"No readable text: {file}")

            documents.append(
                Document(
                    page_content=text,
                    metadata={"source": file, "bot_id": bot_id}
                )
            )
            print(f"Loaded: {file}")

        except Exception as e:
            if strict:
                raise ValueError(f"Cannot read document: {file}") from e
            print(f"[loader] Error loading {file}: {e}")

    print(f"Total docs: {len(documents)}")
    return documents
