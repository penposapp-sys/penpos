export const isValidObjectId = (v) => {
  if (!v) return false;
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[a-fA-F0-9]{24}$/.test(s);
};
