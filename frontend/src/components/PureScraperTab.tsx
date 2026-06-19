import { useState, useEffect, useCallback, useRef } from "react";
import { pureScraperApi, PureJob, PureScrapeResponse, PlatformInfo } from "../services/pureScraperApi";
import { exportJobsToFormat } from "../utils/export";

const STATUS_MESSAGES: Record<string, string> = {
  remoteok: "Fetching RemoteOK...",
  remotive: "Fetching Remotive...",
  arbeitnow: "Fetching Arbeitnow...",
  jobicy: "Fetching Jobicy...",
  weworkremotely: "Parsing RSS feeds...",
  himalayas: "Fetching Himalayas...",
  eurojobs: "Scraping Eurojobs...",
  stepstone: "Scraping Stepstone...",
  jobstreet: "Scraping Jobstreet...",
  wellfound: "Scraping Wellfound...",
  themuse: "Fetching The Muse...",
};

export default function PureScraperTab() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [maxResults, setMaxResults] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [results, setResults] = useState<PureJob[]>([]);
  const [meta, setMeta] = useState<PureScrapeResponse | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'platform' | 'type'>('date');
  const [filterText, setFilterText] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [keywordError, setKeywordError] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pureScraperApi.getPlatforms().then((res) => {
      const list = res.data.platforms;
      setPlatforms(list);
      setSelectedPlatforms(list.map((p) => p.name));
    }).catch(() => {
      const fallback: PlatformInfo[] = [
        { name: "remoteok", method: "api", label: "RemoteOK" },
        { name: "remotive", method: "api", label: "Remotive" },
        { name: "arbeitnow", method: "api", label: "Arbeitnow" },
        { name: "jobicy", method: "api", label: "Jobicy" },
        { name: "weworkremotely", method: "rss", label: "We Work Remotely" },
        { name: "himalayas", method: "api", label: "Himalayas" },
        { name: "eurojobs", method: "html", label: "Eurojobs" },
        { name: "stepstone", method: "html", label: "Stepstone" },
        { name: "jobstreet", method: "html", label: "Jobstreet" },
        { name: "wellfound", method: "html", label: "Wellfound" },
        { name: "themuse", method: "api", label: "The Muse" },
      ];
      setPlatforms(fallback);
      setSelectedPlatforms(fallback.map((p) => p.name));
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const addKeyword = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords((prev) => [...prev, trimmed]);
    }
  }, [keywords]);

  const removeKeyword = useCallback((kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }, []);

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(keywordInput);
      setKeywordInput("");
    }
    setKeywordError(false);
  };

  const togglePlatform = (name: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const selectAllPlatforms = () => {
    setSelectedPlatforms(platforms.map((p) => p.name));
  };

  const deselectAllPlatforms = () => {
    setSelectedPlatforms([]);
  };

  const startStatusPolling = () => {
    let idx = 0;
    const keys = Object.keys(STATUS_MESSAGES);
    setStatusText(STATUS_MESSAGES[keys[0]] || "Scraping...");
    pollRef.current = setInterval(() => {
      idx = (idx + 1) % keys.length;
      setStatusText(STATUS_MESSAGES[keys[idx]] || "Scraping...");
    }, 3000);
  };

  const stopStatusPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setStatusText("");
  };

  const handleScrape = async () => {
    if (keywords.length === 0) {
      setKeywordError(true);
      return;
    }

    setIsLoading(true);
    setKeywordError(false);
    setResults([]);
    setMeta(null);
    setShowErrors(false);
    startStatusPolling();

    try {
      const res = await pureScraperApi.scrape({
        keywords,
        location: location || undefined,
        remote_only: remoteOnly,
        platforms: selectedPlatforms.length === platforms.length ? [] : selectedPlatforms,
        max_results: maxResults,
      });
      setResults(res.data.jobs);
      setMeta(res.data);
      if (res.data.errors.length > 0) {
        setShowErrors(true);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      stopStatusPolling();
      setIsLoading(false);
    }
  };

  const filteredAndSorted = [...results]
    .filter((job) => {
      if (!filterText) return true;
      const q = filterText.toLowerCase();
      return (
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        job.tags.some((t) => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        return (b.posted_date || "").localeCompare(a.posted_date || "");
      }
      if (sortBy === "platform") {
        return a.platform.localeCompare(b.platform);
      }
      return a.job_type.localeCompare(b.job_type);
    });

  const handleExport = (format: "csv" | "xlsx") => {
    const mapped = results.map((j) => ({
      title: j.title,
      company: j.company,
      location: j.location,
      source: j.platform,
      posted_time: j.posted_date,
      application_link: j.url,
      description: "",
      match_score: undefined,
      missing_keywords: "",
      contact_email: "",
      contact_phone: "",
      contact_website: "",
      contact_info: "",
      created_at: "",
      salary: j.salary,
      job_type: j.job_type,
    }));
    exportJobsToFormat(mapped, "pure_scraper_results", format);
  };

  const sourceTypeColor = (type: string) => {
    switch (type) {
      case "api": return { bg: "rgba(16,185,129,0.15)", color: "#34d399" };
      case "rss": return { bg: "rgba(59,130,246,0.15)", color: "#60a5fa" };
      case "html": return { bg: "rgba(245,158,11,0.15)", color: "#fbbf24" };
      default: return { bg: "rgba(148,163,184,0.15)", color: "#94a3b8" };
    }
  };

  const jobTypeColor = (type: string) => {
    switch (type) {
      case "remote": return { bg: "rgba(16,185,129,0.15)", color: "#34d399" };
      case "hybrid": return { bg: "rgba(59,130,246,0.15)", color: "#60a5fa" };
      default: return { bg: "rgba(148,163,184,0.15)", color: "#cbd5e1" };
    }
  };

  return (
    <div>
      <div className="content-header">
        <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          Pure Scraper
          <span style={{
            fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)",
            background: "var(--surface)", padding: "0.25rem 0.5rem",
            borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
          }}>
            no AI &bull; keyword-based
          </span>
        </h2>
      </div>

      <div className="profile-card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="form-group">
            <label>Keywords</label>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: "0.5rem",
              padding: "0.5rem", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", background: "var(--surface)",
              minHeight: "42px", alignItems: "center",
            }}>
              {keywords.map((kw) => (
                <span key={kw} className="skill-tag">
                  {kw}
                  <button
                    className="skill-tag-remove"
                    onClick={() => removeKeyword(kw)}
                    type="button"
                  >
                    &times;
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => { setKeywordInput(e.target.value); setKeywordError(false); }}
                onKeyDown={handleKeywordKeyDown}
                placeholder={keywords.length === 0 ? "Type keyword and press Enter..." : "Add more..."}
                style={{
                  flex: 1, minWidth: "120px", border: "none", background: "transparent",
                  color: "var(--foreground)", outline: "none", fontSize: "0.9rem",
                  fontFamily: "Inter, sans-serif",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div className="form-group" style={{ flex: "1 1 250px" }}>
              <label>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Netherlands (optional)"
              />
            </div>
            <div className="form-group" style={{ display: "flex", alignItems: "flex-end", paddingBottom: "0.35rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: 0, fontWeight: "normal" }}>
                <input
                  type="checkbox"
                  checked={remoteOnly}
                  onChange={(e) => setRemoteOnly(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "var(--primary)" }}
                />
                Remote only
              </label>
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Platforms
              <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>
                <button
                  type="button"
                  onClick={selectAllPlatforms}
                  style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.8rem", padding: 0, marginRight: "0.75rem" }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllPlatforms}
                  style={{ background: "none", border: "none", color: "var(--foreground-muted)", cursor: "pointer", fontSize: "0.8rem", padding: 0 }}
                >
                  Deselect
                </button>
              </span>
            </label>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: "0.5rem",
              padding: "0.75rem", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", background: "var(--surface)",
            }}>
              {platforms.map((p) => {
                const methodColor = sourceTypeColor(p.method);
                return (
                  <label
                    key={p.name}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.35rem",
                      padding: "0.3rem 0.6rem", borderRadius: "var(--radius-md)",
                      background: selectedPlatforms.includes(p.name)
                        ? "var(--primary-light)" : "transparent",
                      border: `1px solid ${selectedPlatforms.includes(p.name) ? "var(--primary)" : "var(--border)"}`,
                      cursor: "pointer", fontSize: "0.85rem", transition: "all 0.2s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlatforms.includes(p.name)}
                      onChange={() => togglePlatform(p.name)}
                      style={{ accentColor: "var(--primary)" }}
                    />
                    {p.label}
                    <span style={{
                      fontSize: "0.65rem", padding: "0.1rem 0.35rem",
                      borderRadius: "4px", background: methodColor.bg,
                      color: methodColor.color, fontWeight: 600,
                      textTransform: "uppercase",
                    }}>
                      {p.method}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label>Max results</label>
            <input
              type="number"
              value={maxResults}
              onChange={(e) => setMaxResults(Math.max(1, parseInt(e.target.value) || 50))}
              min={1}
              max={500}
              style={{ width: "120px" }}
            />
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleScrape}
            disabled={isLoading}
            style={{ alignSelf: "flex-start", minWidth: "200px" }}
          >
            {isLoading ? (
              <>
                <span className="spinner" style={{ marginRight: "0.5rem" }}></span>
                {statusText || "Scraping..."}
              </>
            ) : (
              "Scrape Jobs"
            )}
          </button>
          {keywordError && (
            <span style={{ color: "#f87171", fontSize: "0.85rem" }}>Add at least one keyword first.</span>
          )}

          {meta && meta.errors.length > 0 && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "var(--radius-md)", padding: "0.75rem 1rem",
            }}>
              <button
                type="button"
                onClick={() => setShowErrors(!showErrors)}
                style={{
                  background: "none", border: "none", color: "#f87171",
                  cursor: "pointer", fontWeight: 600, fontSize: "0.875rem",
                  padding: 0, display: "flex", alignItems: "center", gap: "0.5rem",
                  width: "100%", textAlign: "left",
                }}
              >
                {showErrors ? "▾" : "▸"} {meta.errors.length} platform(s) reported errors
              </button>
              {showErrors && (
                <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.5rem", fontSize: "0.8rem", color: "#fca5a5" }}>
                  {meta.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {meta && results.length > 0 && (
        <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.9rem", color: "var(--foreground-muted)" }}>
            <strong style={{ color: "var(--foreground)" }}>{meta.total}</strong> jobs found
            &nbsp;|&nbsp; {meta.duration_seconds}s
            &nbsp;|&nbsp; {meta.platforms_scraped.length} platform(s)
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              onClick={() => handleExport("csv")}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              onClick={() => handleExport("xlsx")}
            >
              Export Excel
            </button>
          </div>
        </div>
      )}

      {meta && results.length > 0 && (
        <div className="filters-bar" style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="Search by title, company, location, tags..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ flex: "1 1 250px" }}
          />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="date">Sort by Date</option>
            <option value="platform">Sort by Platform</option>
            <option value="type">Sort by Job Type</option>
          </select>
        </div>
      )}

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="profile-card"
              style={{
                padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem",
              }}
            >
              <div className="skeleton skeleton-title"></div>
              <div className="skeleton skeleton-text w-3-4"></div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <div className="skeleton skeleton-badge"></div>
                <div className="skeleton skeleton-badge"></div>
                <div className="skeleton skeleton-badge"></div>
              </div>
              <div className="skeleton skeleton-text w-full"></div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && results.length === 0 && meta === null && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "1rem", color: "var(--foreground-muted)" }}>
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <h3>No jobs found</h3>
          <p>Try broader keywords or enable more platforms.</p>
        </div>
      )}

      {!isLoading && meta && results.length === 0 && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "1rem", color: "var(--foreground-muted)" }}>
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line>
            <line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
          <h3>No jobs match your filters</h3>
          <p>Try clearing your search or filter selections.</p>
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredAndSorted.map((job, idx) => {
            const sColor = sourceTypeColor(job.source_type);
            const tColor = jobTypeColor(job.job_type);
            return (
              <div
                key={`${job.platform}-${idx}`}
                className="session-card"
                style={{ marginBottom: 0 }}
              >
                <div className="session-header" style={{ cursor: "default" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "1.05rem", color: "var(--primary)", fontFamily: "Outfit, sans-serif" }}>
                        {job.title}
                      </strong>
                      <span style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", fontWeight: 500 }}>
                        {job.company}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        {job.location || "N/A"}
                      </span>
                      {job.salary && (
                        <span style={{ fontSize: "0.85rem", color: "var(--success)" }}>
                          {job.salary}
                        </span>
                      )}
                      <span className="badge" style={{ background: tColor.bg, color: tColor.color }}>
                        {job.job_type}
                      </span>
                      <span className="badge" style={{ background: sColor.bg, color: sColor.color }}>
                        {job.platform}
                      </span>
                      <span className="badge" style={{
                        background: sColor.bg, color: sColor.color,
                        textTransform: "uppercase", fontSize: "0.65rem",
                      }}>
                        {job.source_type}
                      </span>
                      {job.posted_date && (
                        <span className="badge badge-warning" style={{ fontSize: "0.75rem" }}>
                          {job.posted_date}
                        </span>
                      )}
                    </div>
                    {job.tags.length > 0 && (
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                        {job.tags.slice(0, 8).map((tag) => (
                          <span key={tag} className="skill-tag" style={{ fontSize: "0.75rem" }}>
                            {tag}
                          </span>
                        ))}
                        {job.tags.length > 8 && (
                          <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                            +{job.tags.length - 8} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {job.url && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                      style={{ whiteSpace: "nowrap", padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
                    >
                      Apply
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {filteredAndSorted.length === 0 && (
            <div className="empty-state" style={{ padding: "2rem" }}>
              <p>No jobs match your search filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
