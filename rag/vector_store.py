import faiss
import numpy as np
import pickle

INDEX_PATH = "vector_db/faiss.index"
TEXT_PATH = "vector_db/texts.pkl"

def create_faiss_index(embeddings, texts):

    dimension = len(embeddings[0])

    index = faiss.IndexFlatL2(dimension)

    index.add(np.array(embeddings))

    faiss.write_index(index, INDEX_PATH)

    with open(TEXT_PATH, "wb") as f:
        pickle.dump(texts, f)

    print("FAISS index created")