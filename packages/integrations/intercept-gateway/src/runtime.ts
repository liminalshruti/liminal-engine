import { AuditLedger, type Clock, type IdGen } from "@liminal-engine/governance";
import {
  FileInterceptQueue,
  FilePolicyStore,
  InMemoryInterceptQueue,
  InMemoryPolicyStore,
} from "@liminal-engine/integration-policy-store";
import type { InterceptQueue, PolicyMode, PolicyStore, ProxyScope } from "@liminal-engine/policy";
import { InterceptGateway } from "./gateway.ts";
import { FileProxyHistory, InMemoryProxyHistory, type ProxyHistory } from "./history.ts";
import type { MatchReplaceRule } from "./match-replace.ts";

export interface GatewayRuntimeOptions {
  mode?: PolicyMode;
  sessionDir?: string;
  scope?: ProxyScope;
  matchReplaceRules?: readonly MatchReplaceRule[];
  caseId?: string;
  dealId?: string;
  decidingActor?: string;
  clock?: Clock;
  idGen?: IdGen;
}

export interface GatewayRuntime {
  gateway: InterceptGateway;
  policyStore: PolicyStore;
  interceptQueue: InterceptQueue;
  history: ProxyHistory;
  ledger: AuditLedger;
}

export function createGatewayRuntime(options: GatewayRuntimeOptions = {}): GatewayRuntime {
  const policyStore = options.sessionDir === undefined
    ? new InMemoryPolicyStore()
    : new FilePolicyStore(options.sessionDir);
  const interceptQueue = options.sessionDir === undefined
    ? new InMemoryInterceptQueue()
    : new FileInterceptQueue(options.sessionDir);
  const history = options.sessionDir === undefined
    ? new InMemoryProxyHistory()
    : new FileProxyHistory(options.sessionDir);
  const ledger = new AuditLedger();
  const gateway = new InterceptGateway({
    policyStore,
    interceptQueue,
    history,
    ledger,
    clock: options.clock ?? systemClock(),
    idGen: options.idGen ?? processIdGen(),
    mode: options.mode ?? "intercept",
    ...(options.scope !== undefined ? { scope: options.scope } : {}),
    ...(options.matchReplaceRules !== undefined ? { matchReplaceRules: options.matchReplaceRules } : {}),
    caseId: options.caseId ?? "gc_policy_gateway",
    dealId: options.dealId ?? "deal_policy_gateway",
    decidingActor: options.decidingActor ?? "Operator",
  });
  return { gateway, policyStore, interceptQueue, history, ledger };
}

function systemClock(): Clock {
  return { now: () => new Date().toISOString() };
}

function processIdGen(): IdGen {
  let i = 0;
  const prefix = `gw_${process.pid}`;
  return { next: () => `${prefix}_${++i}` };
}
