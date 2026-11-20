namespace raight;

using { cuid } from '@sap/cds/common';

/** The six steps of the automation ladder (glossary). */
type LadderStep : String(20) enum { rule; workflow; classic_ml; genai_call; agent; multi_agent; }

/** External platform an automation is built with (ADR 0005) – shown by name only. */
entity Providers {
  key ID   : String(40);
      name : String(100);
}

/** An automation a process owner built, with the owner's triage note (agent_reason) and rAIght's suggestion. */
entity Agents {
  key ID             : String(40);
      name           : String(100);
      provider       : Association to Providers;
      owner          : String(100);
      unit           : String(100); // the owner's organisational unit
      purpose        : String(500);
      ladderStep     : LadderStep;
      agentReason    : String(1000);
      suggestion     : String(100);
      suggestionText : String(1000);
      retired        : Boolean default false;
      convertedTo    : LadderStep; // the owner's decision to move it to a lower step; empty without one
      convertedAt    : Timestamp;
      runs           : Association to many Runs on runs.agent = $self;
}

/**
 * The metrics per agent for the last 30 days, as a snapshot: computed from the run log with srv/lib/metrics.js
 * and impact.js whenever the run log is filled. For lists that filter and sort in the database (Fiori); the pages
 * get the same numbers live from MonitorApi.
 */
entity AgentUsage {
  key ID               : String(40); // the agent's ID
      name             : String(100);
      provider         : Association to Providers;
      owner            : String(100);
      unit             : String(100);
      state            : String(10) enum { healthy; uniform; unused; retired; converted; };
      stateCriticality : Integer; // status colour in Fiori: 1 red, 2 orange, 3 green, 0 none
      runs30d          : Integer;
      tokens30d        : Integer;
      samePathPercent  : Integer; // null without runs in the last 30 days
      daysSinceLastRun : Integer;
      cost30dEur       : Decimal(11, 2);
      co2e30dKg        : Decimal(11, 3);
      suggestion       : String(100);
      runs             : Association to many Runs on runs.agent.ID = ID;
}

/** One run of an agent, as the provider's run log delivers it. */
entity Runs : cuid {
  agent     : Association to Agents;
  startedAt : Timestamp;
  path      : String(1000); // the steps the run took, joined with " > "
  model     : String(40);
  tokensIn  : Integer;
  tokensOut : Integer;
  source    : String(20) default 'generated'; // generated = demo data; otherwise the provider that delivered it (n8n)
}
