export function completeness(missingData: string[] = []) {
  const missing = [...new Set(missingData)].sort();
  return {
    completeness: missing.length ? ("partial" as const) : ("complete" as const),
    missingData: missing,
  };
}
