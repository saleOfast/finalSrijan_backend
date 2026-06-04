const CP_ACTIVITY_VALUES = [
  "OPEN",
  "CONTACTED",
  "LINK SENT",
  "ONBOARDED",
  "NOT INTERESTED",
  "CALL",
  "VISIT",
  "FOLLOW UP",
];

const normalizeActivity = (raw) => {
  if (raw === undefined || raw === null || raw === "") return null;
  const value = String(raw).trim().toUpperCase();
  const matched = CP_ACTIVITY_VALUES.find(
    (item) => item.toUpperCase() === value
  );
  return matched || null;
};

module.exports = {
  CP_ACTIVITY_VALUES,
  normalizeActivity,
};
