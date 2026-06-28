/**
 * substrate — the real-data layer. An operator ingests ARBITRARY streams (call
 * transcripts, docs, tickets, agent traces) and pins them as permissioned context
 * the governance loop reasons over — instead of a hardcoded fixture scenario.
 *
 * This is the input side that makes Liminal a real product (DIRECTIVE.md): it runs
 * cold on whatever real data is ingested, not one staged case. [BUILD_PLAN.md Gap 2]
 */

/** The kind of source a stream came from — open vocabulary, arbitrary inputs. */
export type StreamSourceType = string;

/** Whether a stream is pinned (retained context) or transient. */
export type StreamProvenance = "pinned" | "transient";

/** An ingested stream the operator pointed Liminal at. */
export interface Stream {
  readonly id: string;
  readonly sourceType: StreamSourceType;
  readonly title: string;
  readonly content: string;
  readonly provenance: StreamProvenance;
}

/** What the caller provides to ingest — everything but the assigned id. */
export type StreamInput = Omit<Stream, "id">;

/**
 * The substrate: the pinned/permissioned set of streams the loop reasons over.
 * In-memory adapter; a persisted adapter slots in behind the same shape later.
 */
export class InMemorySubstrate {
  #streams: Stream[] = [];
  #seq = 0;

  /** Ingest an arbitrary stream; assigns an id and stores it. */
  ingest(input: StreamInput): Stream {
    const stream: Stream = { id: `stream_${++this.#seq}`, ...input };
    this.#streams.push(stream);
    return stream;
  }

  /** Every ingested stream, in ingest order. */
  streams(): Stream[] {
    return [...this.#streams];
  }
}
