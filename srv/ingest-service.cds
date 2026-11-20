/**
 * Where a connected provider delivers its run log. v1 is built for n8n: its connector posts `record` for every
 * finished run and asks `state` for the owner's decisions (retired, converted). `record` needs the header x-raight-key.
 */
@(protocol: 'rest', path: '/api/ingest')
service IngestApi {
  /** One finished run. Give the steps as a list, or as `path` joined with " > ". A run without a model has no `model` and no tokens. */
  action record(agent : String, steps : array of String, path : String, model : String, tokensIn : Integer, tokensOut : Integer, startedAt : String, source : String) returns RunReceipt;

  /** The owner's decisions on the agent: retired, or converted to a lower step. */
  function state(agent : String) returns AgentState;

  type RunReceipt {
    accepted   : Boolean;
    agent      : String;
    runs_30d   : Integer; // the agent's numbers after this run
    tokens_30d : Integer;
  }

  type AgentState {
    agent        : String;
    retired      : Boolean;
    converted_to : String;    // the ladder step, or null
    converted_at : Timestamp; // when the owner decided
  }
}
