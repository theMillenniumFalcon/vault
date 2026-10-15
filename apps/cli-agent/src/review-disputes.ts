import {
  listOpenDisputes,
  resolveDispute,
  type OpenDispute,
  type VaultDb,
  type VectorStore,
} from "vault-memory";

export function formatDisputePrompt(dispute: OpenDispute): string {
  return [
    `${dispute.entity} conflict`,
    `  1. ${dispute.claimB.sourceAgent} (in use): "${dispute.claimB.text}"`,
    `  2. ${dispute.claimA.sourceAgent} (saved, not used): "${dispute.claimA.text}"`,
    "Pick 1 or 2, or press Enter to leave it open: ",
  ].join("\n");
}

export function choiceToWinningClaimId(
  dispute: OpenDispute,
  choice: string,
): string | "skip" | "invalid" {
  const trimmed = choice.trim().toLowerCase();
  if (trimmed === "" || trimmed === "skip") return "skip";
  if (trimmed === "1") return dispute.claimB.id;
  if (trimmed === "2") return dispute.claimA.id;
  return "invalid";
}

export async function reviewOpenDisputes(options: {
  db: VaultDb;
  vectorStore: VectorStore;
  ask: (prompt: string) => Promise<string>;
  log?: (line: string) => void;
  /** When set, only review disputes that involve one of these claim ids. */
  onlyClaimIds?: string[];
}): Promise<void> {
  const log = options.log ?? console.log;
  const open = await listOpenDisputes(options.db);
  const selected = options.onlyClaimIds
    ? open.filter(
        (dispute) =>
          options.onlyClaimIds!.includes(dispute.claimAId) ||
          options.onlyClaimIds!.includes(dispute.claimBId),
      )
    : open;

  if (selected.length === 0) {
    log("No open disputes.");
    return;
  }

  for (const dispute of selected) {
    while (true) {
      const answer = await options.ask(formatDisputePrompt(dispute));
      const choice = choiceToWinningClaimId(dispute, answer);
      if (choice === "skip") {
        log("Left open.");
        break;
      }
      if (choice === "invalid") {
        log("Enter 1, 2, or press Enter to skip.");
        continue;
      }

      const resolved = await resolveDispute(
        options.db,
        options.vectorStore,
        dispute.id,
        choice,
      );
      log(
        `Kept "${resolved.winner.text}" (${resolved.winner.sourceAgent}). Filed "${resolved.loser.text}" as old.`,
      );
      break;
    }
  }
}
