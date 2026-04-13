export function formatBorrowerStatus(status: string | null | undefined) {
  switch (String(status || "").toLowerCase()) {
    case "pending_approval":
      return "Under review";
    case "approved":
      return "Approved";
    case "active":
      return "Active";
    case "overdue":
      return "Overdue";
    case "rejected":
      return "Not approved";
    case "pending":
      return "Scheduled";
    case "partial":
      return "Part paid";
    case "collected":
      return "Paid";
    case "missed":
      return "Missed";
    case "deferred":
      return "Rescheduled";
    default:
      return String(status || "Open")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
