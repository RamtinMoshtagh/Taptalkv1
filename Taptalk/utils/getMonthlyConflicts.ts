// utils/getMonthlyConflicts.ts
export function getMonthlyConflicts(all: { timestamp: string; tag: string }[]): { timestamp: string; tag: string }[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return all.filter(entry => {
    const date = new Date(entry.timestamp);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });
}
