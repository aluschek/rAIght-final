// rAIght – tells the services that an agent's numbers are out of date: a run arrived for it, or its owner decided
// on it. A reader compares the version, and takes the changed agents to read only those again.
let version = 0;
const changedAgents = new Set();

module.exports = {
  /** Call after every change to an agent or to its runs. */
  changed(agentId) {
    changedAgents.add(agentId);
    return ++version;
  },
  version: () => version,
  /** The agents changed since the last call. There is one reader: MonitorApi. */
  takeChanged() {
    const ids = [...changedAgents];
    changedAgents.clear();
    return ids;
  },
};
