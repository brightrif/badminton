export function getTier(priority = 0) {
  if (priority >= 80) return "title";
  if (priority >= 40) return "gold";
  return "standard";
}
