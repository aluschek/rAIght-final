using { raight } from '../db/schema';

/** The run log and the agents' usage, read-only – browse them in the Fiori preview. */
service MonitorService {
  @readonly entity Providers  as projection on raight.Providers;
  @readonly entity Agents     as projection on raight.Agents;
  @readonly entity Runs       as projection on raight.Runs;
  @readonly entity AgentUsage as projection on raight.AgentUsage;
}

annotate MonitorService.Agents with @UI.LineItem: [
  { Value: ID }, { Value: name }, { Value: provider_ID }, { Value: ladderStep }, { Value: retired }
];

annotate MonitorService.Runs with @UI: {
  SelectionFields: [ agent_ID, model, source ],
  LineItem: [
    { Value: startedAt }, { Value: agent_ID }, { Value: path }, { Value: model }, { Value: tokensIn }, { Value: tokensOut }, { Value: source }
  ]
} {
  startedAt @title: 'Started';
  agent     @title: 'Agent';
  path      @title: 'Path';
  model     @title: 'Model';
  tokensIn  @title: 'Tokens in';
  tokensOut @title: 'Tokens out';
  source    @title: 'Source';
};

// The agents with their numbers of the last 30 days: filter by status or provider, open an agent to see its runs.
annotate MonitorService.AgentUsage with @UI: {
  HeaderInfo: { TypeName: 'Agent', TypeNamePlural: 'Agents – last 30 days', Title: { Value: name }, Description: { Value: suggestion } },
  SelectionFields: [ state, unit, provider_ID ],
  LineItem: [
    { Value: name },
    { Value: unit },
    { Value: state, Criticality: stateCriticality },
    { Value: tokens30d },
    { Value: samePathPercent },
    { Value: cost30dEur },
    { Value: co2e30dKg },
    { Value: runs30d },
    { Value: owner },
    { Value: provider_ID },
    { Value: suggestion }
  ],
  FieldGroup #Usage: { Data: [
    { Value: state, Criticality: stateCriticality },
    { Value: runs30d },
    { Value: tokens30d },
    { Value: samePathPercent },
    { Value: daysSinceLastRun },
    { Value: cost30dEur },
    { Value: co2e30dKg }
  ] },
  Facets: [
    { $Type: 'UI.ReferenceFacet', Label: 'Last 30 days', Target: '@UI.FieldGroup#Usage' },
    { $Type: 'UI.ReferenceFacet', Label: 'Runs', Target: 'runs/@UI.LineItem' }
  ]
} {
  name             @title: 'Agent';
  owner            @title: 'Owner';
  unit             @title: 'Unit';
  provider         @title: 'Provider' @Common: { Text: provider.name, TextArrangement: #TextOnly };
  state            @title: 'Status';
  runs30d          @title: 'Runs';
  tokens30d        @title: 'Tokens';
  samePathPercent  @title: 'Same path (%)';
  daysSinceLastRun @title: 'Days since last run';
  cost30dEur       @title: 'Cost (EUR)';
  co2e30dKg        @title: 'CO₂e (kg)';
  suggestion       @title: 'rAIght suggests';
};

/**
 * Metrics for the pages as plain JSON – exactly the shapes of the files in app/data/. `agents`, `summary` and
 * `impact` show the demo's process owner (Lena); `company` aggregates all owners for the CIO office.
 */
@(protocol: 'rest', path: '/api/monitor')
service MonitorApi {
  function agents()  returns array of AgentMetrics;
  function summary() returns Summary;
  function impact()  returns Impact;
  function company() returns Company;

  /** The owner retires an agent: it stays in the list as retired, and a connected provider stops running it. */
  action retire(agent : String)  returns AgentDecision;
  /** Takes a retirement back. */
  action restore(agent : String) returns AgentDecision;
  /** The owner moves an agent to the lower step that rAIght suggests. A connected provider then runs that step. */
  action convert(agent : String) returns AgentDecision;
  /** "Reset demo": takes every retirement and every conversion back. */
  action reset() returns { restored : Integer; };
  /** The latest runs of one of the owner's agents, newest first, each with what it cost. */
  function runs(agent : String) returns array of LatestRun;

  type AgentDecision {
    agent        : String;
    retired      : Boolean;
    converted_to : String;
  }

  type LatestRun {
    started_at : Timestamp;
    steps      : array of String;
    model      : String;  // null for a run without a model call
    tokens     : Integer;
    cost_eur   : Double;
    source     : String;  // generated, or the provider that delivered it
  }

  type AgentMetrics {
    id                  : String;
    name                : String;
    provider            : String;
    owner               : String;
    purpose             : String;
    ladder_step         : raight.LadderStep;
    agent_reason        : String;
    status              : String enum { active; unused; retired; converted; };
    runs_30d            : Integer;
    tokens_30d          : Integer;
    same_path_share     : Double;  // null without runs in the last 30 days
    uniform_agent       : Boolean;
    // The owner's decision to convert and what the run log shows since then. Null without a decision.
    conversion          : { to : raight.LadderStep; since : Timestamp; runs : Integer; tokens : Integer; done : Boolean; };
    days_since_last_run : Integer;
    top_paths           : array of { steps : array of String; share : Double; };
    suggestion          : String;
    suggestion_text     : String;
    tokens_by_month     : array of Integer; // six 30-day windows, oldest first
    runs_by_day         : array of Integer; // last 30 days, oldest first
  }

  type Summary {
    period              : String;
    period_end          : Date;
    last_import         : DateTime;
    runs_30d            : Integer;
    tokens_30d          : Integer;
    tokens_30d_previous : Integer;
    agents_total        : Integer;
    agents_active       : Integer;
    agents_unused       : Integer;
    agents_converted    : Integer;
    agents_uniform      : Integer;
    tokens_uniform_30d  : Integer;
    uniform_threshold   : Double;
    providers           : array of { id : String; name : String; };
    tokens_by_month     : array of { month : String; tokens_uniform : Integer; tokens_other : Integer; };
  }

  /** Cost and footprint of the last 30 days: tokens × list price, output tokens × EcoLogits factor. */
  type ImpactValues {
    cost_30d_eur      : Double;
    co2e_30d_kg       : Double;          // the middle of the EcoLogits range
    co2e_30d_kg_range : array of Double; // [min, max]
    energy_30d_kwh    : Double;          // the middle of the EcoLogits range
  }

  type AgentImpact : ImpactValues {
    id                         : String;
    saved_since_conversion_eur : Double; // what the runs since the conversion would have cost as agent runs
  }

  /** Same shape as app/data/company.json, plus cost and footprint. Aggregated: no single run or agent. */
  type Company {
    period               : String;
    period_end           : Date;
    owners_total         : Integer;
    agents_total         : Integer;
    agents_uniform       : Integer;
    agents_unused        : Integer;
    tokens_30d           : Integer;
    tokens_30d_previous  : Integer;
    tokens_uniform_30d   : Integer;
    uniform_threshold    : Double;
    cost_30d_eur         : Double;
    cost_uniform_30d_eur : Double;
    saving_potential_30d_eur : Double; // what converting every uniform agent would save
    co2e_30d_kg          : Double;
    co2e_uniform_30d_kg  : Double;
    tokens_by_month      : array of { month : String; tokens_uniform : Integer; tokens_other : Integer; };
    owners               : array of {
      owner               : String;
      unit                : String;
      agents              : Integer;
      uniform_agents      : Integer;
      unused_agents       : Integer;
      tokens_30d          : Integer;
      tokens_uniform_30d  : Integer;
      tokens_30d_previous : Integer;
      cost_30d_eur        : Double;
      co2e_30d_kg         : Double;
    };
  }

  type Impact {
    period         : String;
    period_end     : Date;
    agents         : array of AgentImpact;
    total          : ImpactValues;
    uniform_agents : ImpactValues; // the part a workflow would no longer spend on model calls
    saving_potential_30d_eur : Double; // what converting every uniform agent would save
    assumptions    : {
      usd_to_eur : Double;
      saving_share_if_converted : Double;
      credit_billing : array of { provider : String; credits_per_step : Integer; usd_per_credit : Double; }; // providers billed per step
      prices     : array of { model : String; usd_per_million_input_tokens : Double; usd_per_million_output_tokens : Double; };
      footprints : array of { model : String; g_co2e_per_1k_output_tokens_range : array of Double; wh_per_1k_output_tokens_range : array of Double; };
    };
  }
}
