import * as XLSX from "xlsx";

export function exportJobsToFormat(jobs: any[], filenamePrefix: string, format: "csv" | "xlsx") {
  if (!jobs || jobs.length === 0) return;

  const data = jobs.map((job) => ({
    Title: job.title || "",
    Company: job.company || "",
    Location: job.location || "",
    Source: job.source || "",
    "Posted Time": job.posted_time || "",
    "Application Link": job.application_link || "",
    Description: job.description || "",
    "Match Score": job.match_score !== undefined && job.match_score !== null ? job.match_score : "",
    "Missing Keywords": job.missing_keywords || "",
    "Contact Email": job.contact_email || "",
    "Contact Phone": job.contact_phone || "",
    "Contact Website": job.contact_website || "",
    "Contact Info": job.contact_info || "",
    "Saved At": job.created_at ? new Date(job.created_at).toLocaleString() : "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Jobs");

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}_${dateStr}.${format}`;

  if (format === "csv") {
    XLSX.writeFile(workbook, filename, { bookType: "csv" });
  } else {
    XLSX.writeFile(workbook, filename, { bookType: "xlsx" });
  }
}
