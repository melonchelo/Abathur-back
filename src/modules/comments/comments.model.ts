/** Comentario plano, sin hilos. */
export interface Comment {
  id: string;
  proposalId: string;
  authorId: string;
  authorAlias: string;
  body: string;
  createdAt: string;
}

export interface CreateCommentRequest {
  body: string;
}
