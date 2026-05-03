from sentence_transformers import SentenceTransformer

model = SentenceTransformer("BAAI/bge-m3")

def embed_texts(texts):

    embeddings = model.encode(texts)

    return embeddings