import type { ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import type { RemoteEnvironmentAuthorization } from "../authorization/service.ts";
import type { PreparedConnection } from "../connection/model.ts";
import * as ManagedRelay from "../relay/managedRelay.ts";
import * as ClientCapabilities from "../platform/capabilities.ts";
import {
  executeAuthenticatedEnvironmentHttpRequest,
  withOrchestrationProtocolHeader,
} from "./environmentHttpAuth.ts";

const DEFAULT_THREAD_HISTORY_TIMEOUT_MS = 6_000;

export const clientInlineWorkItemLimit = Effect.serviceOption(
  ClientCapabilities.ClientPresentation,
).pipe(
  Effect.map((presentation) =>
    Option.exists(
      presentation,
      ({ metadata }) => metadata.surface === "web" || metadata.surface === "desktop",
    )
      ? (150 as const)
      : (75 as const),
  ),
);

export const fetchEnvironmentThreadHistoryPage = Effect.fn(
  "clientRuntime.state.fetchEnvironmentThreadHistoryPage",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly threadId: ThreadId;
  readonly cursor: string;
  readonly throughEntryId?: string | undefined;
  readonly view?: "conversation" | "activity" | "work" | undefined;
  readonly signer: Option.Option<ManagedRelay.ManagedRelayDpopSigner["Service"]>;
  readonly remoteAuthorization?: Option.Option<RemoteEnvironmentAuthorization["Service"]>;
  readonly timeoutMs?: number;
}) {
  const inlineWorkItemLimit = yield* clientInlineWorkItemLimit;
  const endpoint = {
    params: { threadId: input.threadId },
    query: {
      cursor: input.cursor,
      compactIds: "1",
      inlineWorkItemLimit: inlineWorkItemLimit === 150 ? ("150" as const) : ("75" as const),
      ...(input.throughEntryId === undefined ? { deferWork: "1" } : {}),
      ...(input.view === undefined ? {} : { view: input.view }),
      ...(input.throughEntryId === undefined ? {} : { throughEntryId: input.throughEntryId }),
    },
  };
  return yield* executeAuthenticatedEnvironmentHttpRequest({
    ...input,
    group: "orchestration",
    method: "GET",
    url: (urls) => urls.threadHistoryPage(endpoint),
    timeoutMs: input.timeoutMs ?? DEFAULT_THREAD_HISTORY_TIMEOUT_MS,
    request: ({ client, headers }) =>
      client.threadHistoryPage({ ...endpoint, headers: withOrchestrationProtocolHeader(headers) }),
  });
});
