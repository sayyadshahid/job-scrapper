import { useState, useEffect } from "react";
import { fetchSavedJobs, draftEmail } from "../services/api";
import { exportJobsToFormat } from "../utils/export";

export default function HistoryTab() {
  const [loading, setLoading] = useState(false);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [draftingId, setDraftingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [timeFilter, setTimeFilter] = useState("All Time");
  const [workModeFilter, setWorkModeFilter] = useState("All");

  useEffect(() => {
    setLoading(true);
    fetchSavedJobs().then(data => setSavedJobs(data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleDraftEmail = async (jobId: number) => {
    setDraftingId(jobId);
    try {
      const data = await draftEmail(jobId);
      setDrafts(prev => ({ ...prev, [jobId]: data.email_draft }));
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setDraftingId(null);
    }
  };

  const uniqueSources = Array.from(new Set(savedJobs.map(j => j.source))).filter(Boolean);

  const filteredJobs = savedJobs.filter(job => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const match = (job.title?.toLowerCase().includes(term)) ||
                    (job.company?.toLowerCase().includes(term)) ||
                    (job.description?.toLowerCase().includes(term)) ||
                    (job.location?.toLowerCase().includes(term));
      if (!match) return false;
    }

    if (sourceFilter && sourceFilter !== "All") {
      if (job.source !== sourceFilter) return false;
    }

    if (timeFilter && timeFilter !== "All Time") {
      const pt = job.posted_time?.toLowerCase() || "";
      if (timeFilter === "Last 24 hours") {
        if (!pt.includes("hour") && !pt.includes("today") && !pt.includes("now") && !pt.includes("minute") && !pt.includes("second") && pt !== "1 day ago") return false;
      } else if (timeFilter === "Last 7 days") {
        if (pt.includes("month") || pt.includes("year") || pt.includes("2 week") || pt.includes("3 week") || pt.includes("4 week")) return false;
      } else if (timeFilter === "Last 30 days") {
        if (pt.includes("year") || pt.includes("2 month") || pt.includes("3 month")) return false;
      }
    }

    if (workModeFilter && workModeFilter !== "All") {
      const isRemote = job.location?.toLowerCase().includes("remote") || job.title?.toLowerCase().includes("remote") || job.description?.toLowerCase().includes("remote") || job.location?.toLowerCase().includes("wfh") || job.description?.toLowerCase().includes("wfh");
      const isHybrid = job.location?.toLowerCase().includes("hybrid") || job.title?.toLowerCase().includes("hybrid") || job.description?.toLowerCase().includes("hybrid");
      
      if (workModeFilter === "Remote" && !isRemote) return false;
      if (workModeFilter === "Hybrid" && !isHybrid) return false;
      if (workModeFilter === "On-site" && (isRemote || isHybrid)) return false;
    }

    return true;
  });

  const groupedSessions = filteredJobs.reduce((acc, job) => {
    const session = job.session_name || "Uncategorized Session";
    if (!acc[session]) acc[session] = [];
    acc[session].push(job);
    return acc;
  }, {} as Record<string, any[]>);

  const renderMatchScore = (score: number) => {
    let scoreClass = "score-badge-low";
    if (score >= 80) scoreClass = "score-badge-high";
    else if (score >= 50) scoreClass = "score-badge-mid";
    return (
      <div className={`score-badge ${scoreClass}`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>{score}% Match</span>
      </div>
    );
  };

  return (
    <>
      <div className="content-header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2>Saved Jobs History {savedJobs.length > 0 && `(${filteredJobs.length} visible)`}</h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className="btn-secondary" 
              onClick={() => exportJobsToFormat(filteredJobs, "saved_jobs_history", "csv")}
              disabled={filteredJobs.length === 0}
              style={{ padding: '0.5rem 1rem', width: 'auto' }}
            >
              Download CSV
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => exportJobsToFormat(filteredJobs, "saved_jobs_history", "xlsx")}
              disabled={filteredJobs.length === 0}
              style={{ padding: '0.5rem 1rem', width: 'auto' }}
            >
              Download Excel
            </button>
          </div>
        </div>
        {savedJobs.length > 0 && (
          <div className="filters-bar">
            <input 
              type="text" 
              placeholder="Search title, company, description, location..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ flex: '1 1 250px' }} 
            />
            <select 
              value={workModeFilter} 
              onChange={e => setWorkModeFilter(e.target.value)}
            >
              <option value="All">All Work Modes</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>
            <select 
              value={sourceFilter} 
              onChange={e => setSourceFilter(e.target.value)}
            >
              <option value="All">All Platforms</option>
              {uniqueSources.map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
            </select>
            <select 
              value={timeFilter} 
              onChange={e => setTimeFilter(e.target.value)}
            >
              <option value="All Time">All Time</option>
              <option value="Last 24 hours">Last 24 hours</option>
              <option value="Last 7 days">Last 7 days</option>
              <option value="Last 30 days">Last 30 days</option>
            </select>
          </div>
        )}
      </div>
      {loading ? (
        <div className="empty-state"><p>Loading history...</p></div>
      ) : Object.keys(groupedSessions).length === 0 ? (
        <div className="empty-state">
          <h3>No saved jobs</h3>
          <p>You haven't saved any jobs yet.</p>
        </div>
      ) : (
        <div className="sessions-list">
          {(Object.entries(groupedSessions) as [string, any[]][]).map(([session, sessionJobs], sIdx) => {
            const isExpanded = expandedSession === session;
            return (
              <div key={sIdx} className="session-card">
                <div 
                  className={`session-header ${isExpanded ? 'expanded' : ''}`} 
                  onClick={() => setExpandedSession(isExpanded ? null : session)}
                >
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--foreground)' }}>{session}</h3>
                  <span style={{ background: 'var(--primary)', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {sessionJobs.length} Jobs
                  </span>
                </div>
                {isExpanded && (
                  <div className="session-content" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: '28%' }}>Title & Company</th>
                            <th style={{ width: '18%' }}>Score & Info</th>
                            <th style={{ width: '42%' }}>Details & Draft</th>
                            <th style={{ width: '12%' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionJobs.map((job) => (
                            <tr key={job.id}>
                              <td>
                                <strong style={{ color: 'var(--primary)', fontSize: '1.05rem', fontFamily: 'Outfit, sans-serif' }}>{job.title}</strong><br />
                                <span style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', fontWeight: 500 }}>{job.company}</span><br />
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                                  {job.source && (
                                    <span className="badge badge-primary">{job.source}</span>
                                  )}
                                  {job.posted_time && (
                                    <span className="badge badge-warning" title="Time Posted">{job.posted_time}</span>
                                  )}
                                  {job.created_at && (
                                    <span className="badge badge-neutral" title="Saved Date/Time">
                                      Saved: {new Date(job.created_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                {job.match_score !== null && renderMatchScore(job.match_score)}
                                {job.missing_keywords && (
                                  <div className="missing-keywords-box">
                                    <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Missing Keywords:</strong>
                                    {job.missing_keywords}
                                  </div>
                                )}
                              </td>
                              <td>
                                {(job.contact_email || job.contact_phone || job.contact_website) ? (
                                  <div className="contact-card">
                                    <strong className="contact-card-title">Contact Information</strong>
                                    {job.contact_email && (
                                      <div className="contact-item">
                                        <strong>Email:</strong> <a href={`mailto:${job.contact_email}`}>{job.contact_email}</a>
                                      </div>
                                    )}
                                    {job.contact_phone && (
                                      <div className="contact-item">
                                        <strong>Phone:</strong> <span>{job.contact_phone}</span>
                                      </div>
                                    )}
                                    {job.contact_website && (
                                      <div className="contact-item">
                                        <strong>Website:</strong> <a href={job.contact_website} target="_blank" rel="noreferrer">{job.contact_website}</a>
                                      </div>
                                    )}
                                  </div>
                                ) : job.contact_info ? (
                                  <div className="contact-card">
                                    <strong className="contact-card-title">Contact Information</strong>
                                    <span style={{ whiteSpace: 'pre-wrap' }}>{job.contact_info}</span>
                                  </div>
                                ) : null}
                                
                                {drafts[job.id] && (
                                  <div className="draft-card">
                                    <strong className="draft-card-title">Drafted Email</strong>
                                    {drafts[job.id]}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div className="table-actions">
                                  {job.application_link && (
                                    <a href={job.application_link} target="_blank" rel="noreferrer" className="btn-secondary">Apply Now</a>
                                  )}
                                  <button 
                                    onClick={() => handleDraftEmail(job.id)} 
                                    disabled={draftingId === job.id} 
                                    className="btn-purple"
                                  >
                                    {draftingId === job.id ? "Drafting..." : "Draft Email"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
