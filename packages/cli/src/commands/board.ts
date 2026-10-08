import { writeln } from "../utils/output";

export async function launchboard(): Promise<number> {
  writeln("Launching board...");
  return 0;
}

export function getPreferredboardInstaller(): string {
  return "npm";
}
