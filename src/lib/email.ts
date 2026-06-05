export function isOverdue(estimatedRepairDate: string | null, status: string): boolean {
  if (!estimatedRepairDate || status === "Complete") return false;
  return new Date(estimatedRepairDate) < new Date();
}
