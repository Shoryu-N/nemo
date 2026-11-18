import {tokenize} from "./bm25";

export type SparseVector = Map<string, number>;

export type SimilarityDocument = {
  id: string;
  text: string;
};

export type SimilarityMatrix = Map<string, Map<string, number>>;

/**
 * Builds sparse TF-IDF vectors from one historical-candidate corpus.
 * Similarity is lexical and does not represent semantic equivalence.
 */
export function buildTfIdfVectors(
  documents: SimilarityDocument[],
): Map<string, SparseVector> {
  const tokenizedDocuments = documents.map((document) => ({
    ...document,
    tokens: tokenize(document.text),
  }));
  const documentFrequencies = new Map<string, number>();

  for (const {tokens} of tokenizedDocuments) {
    for (const term of new Set(tokens)) {
      documentFrequencies.set(
        term,
        (documentFrequencies.get(term) ?? 0) + 1,
      );
    }
  }

  const documentCount = tokenizedDocuments.length;
  const vectors = new Map<string, SparseVector>();

  for (const {id, tokens} of tokenizedDocuments) {
    const termFrequencies = countTerms(tokens);
    const vector: SparseVector = new Map();

    for (const [term, termFrequency] of termFrequencies) {
      const documentFrequency = documentFrequencies.get(term) ?? 0;
      const inverseDocumentFrequency = Math.log(
        (documentCount + 1) / (documentFrequency + 1),
      ) + 1;

      vector.set(term, termFrequency * inverseDocumentFrequency);
    }

    vectors.set(id, vector);
  }

  return vectors;
}

/**
 * Computes cosine similarity for sparse vectors and clamps floating-point
 * noise to the expected [0, 1] range.
 */
export function calculateCosineSimilarity(
  left: SparseVector,
  right: SparseVector,
): number {
  const leftNorm = calculateNorm(left);
  const rightNorm = calculateNorm(right);

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  const [smaller, larger] = left.size <= right.size ?
    [left, right] : [right, left];
  let dotProduct = 0;

  for (const [term, weight] of smaller) {
    dotProduct += weight * (larger.get(term) ?? 0);
  }

  return Math.min(1, Math.max(0, dotProduct / (leftNorm * rightNorm)));
}

/**
 * Computes every historical candidate pair once for one selection operation.
 */
export function buildSimilarityMatrix(
  documents: SimilarityDocument[],
): SimilarityMatrix {
  const vectors = buildTfIdfVectors(documents);
  const matrix: SimilarityMatrix = new Map(
    documents.map(({id}) => [id, new Map<string, number>()]),
  );

  for (let leftIndex = 0; leftIndex < documents.length; leftIndex += 1) {
    const leftId = documents[leftIndex].id;
    const leftVector = vectors.get(leftId) ?? new Map();

    for (
      let rightIndex = leftIndex;
      rightIndex < documents.length;
      rightIndex += 1
    ) {
      const rightId = documents[rightIndex].id;
      const rightVector = vectors.get(rightId) ?? new Map();
      const similarity = calculateCosineSimilarity(leftVector, rightVector);

      matrix.get(leftId)?.set(rightId, similarity);
      matrix.get(rightId)?.set(leftId, similarity);
    }
  }

  return matrix;
}

export function getSimilarity(
  matrix: SimilarityMatrix,
  leftId: string,
  rightId: string,
): number {
  return matrix.get(leftId)?.get(rightId) ?? 0;
}

function countTerms(tokens: string[]): Map<string, number> {
  const termFrequencies = new Map<string, number>();

  for (const token of tokens) {
    termFrequencies.set(token, (termFrequencies.get(token) ?? 0) + 1);
  }

  return termFrequencies;
}

function calculateNorm(vector: SparseVector): number {
  let squaredMagnitude = 0;

  for (const weight of vector.values()) {
    squaredMagnitude += weight ** 2;
  }

  return Math.sqrt(squaredMagnitude);
}
