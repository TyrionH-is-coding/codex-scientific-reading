// Acceptance only: put input in DSH's real durable inbox without starting a turn.
export const name = 'csr-acceptance-cancel';
export const inject = ['webServer', 'agents'];
export async function apply(ctx, config) {
  const { inspectDispatchEvidence } = await import(config.bridgeModule);
  ctx.webServer.register({ kind: 'exact', path: '/__workbench/acceptance-cancel', async handler(req, res) {
    try {
      const agent = ctx.agents.get(config.sessionId);
      if (req.url.endsWith('?queue') || req.url.endsWith('?queue-owned')) {
        if (!agent || agent.status === 'running') throw new Error('acceptance_agent_not_idle');
        for (const [suffix, rpcId, target] of [['ours-turn', config.rpcId, 'next-turn'],
          ['ours-step', config.rpcId, 'next-step'], ['other', config.otherRpcId, 'next-turn']]) {
          if (suffix === 'other' && req.url.endsWith('?queue-owned')) continue;
          agent.inbox.append(target, { id: config.rpcId + '-' + suffix,
            role: 'user', content: [{ type: 'text', text: 'Synthetic cancellation acceptance ' + suffix }],
            source: { kind: 'user', rpcId } });
        }
      }
      const messages = agent ? [...agent.inbox.nextTurn, ...agent.inbox.nextStep] : [];
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ live: Boolean(agent), running: agent?.status === 'running',
        evidence: inspectDispatchEvidence(agent, config.rpcId),
        otherEvidence: inspectDispatchEvidence(agent, config.otherRpcId),
        queued: messages.map(message => ({ id: message.id, rpcId: message.source?.rpcId })),
        canceled: agent?.session.events.filter(event => event.type === 'agent/inbox/spliced'
          && event.data.outcome === 'canceled').length ?? 0 }));
      // Crash only this disposable test host after the response. Graceful DSH
      // shutdown intentionally cancels its inbox and cannot test crash replay.
      if (req.url.endsWith('?crash')) setTimeout(() => process.exit(91), 100);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  } });
}
