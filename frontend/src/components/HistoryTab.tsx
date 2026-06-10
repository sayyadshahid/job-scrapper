import { useState, useEffect } from "react";
import { fetchSavedJobs, draftEmail } from "../services/api";

export default function HistoryTab() {
  const [loading, setLoading] = useState(false);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [draftingId, setDraftingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});

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

  const groupedSessions = savedJobs.reduce((acc, job) => {
    const session = job.session_name || "Uncategorized Session";
    if (!acc[session]) acc[session] = [];
    acc[session].push(job);
    return acc;
  }, {} as Record<string, any[]>);

  const renderMatchScore = (score: number) => {
    let color = "#dc2626"; // red
    if (score >= 80) color = "#16a34a"; // green
    else if (score >= 50) color = "#f59e0b"; // orange
    return <span style={{ fontWeight: "bold", color }}>{score}% Match</span>;
  };

  return (
    <>
      <div className="content-header">
        <h2>Saved Jobs History</h2>
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
              <div key={sIdx} className="session-card" style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
                <div 
                  className="session-header" 
                  onClick={() => setExpandedSession(isExpanded ? null : session)}
                  style={{ padding: '1.25rem 1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isExpanded ? '#f8fafc' : '#fff' }}
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
                            <th style={{ width: '25%' }}>Title & Company</th>
                            <th style={{ width: '15%' }}>Score & Info</th>
                            <th style={{ width: '45%' }}>Details & Draft</th>
                            <th style={{ width: '15%' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionJobs.map((job) => (
                            <tr key={job.id}>
                              <td>
                                <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{job.title}</strong><br />
                                <span style={{ color: 'var(--secondary)', fontSize: '0.85rem' }}>{job.company}</span><br />
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                  {job.source && (
                                    <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', background: '#e0e7ff', color: '#4338ca', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{job.source}</span>
                                  )}
                                  {job.posted_time && (
                                    <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', background: '#fef3c7', color: '#d97706', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }} title="Time Posted">{job.posted_time}</span>
                                  )}
                                  {job.created_at && (
                                    <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }} title="Saved Date/Time">
                                      Saved: {new Date(job.created_at).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                {job.match_score !== null && renderMatchScore(job.match_score)}
                                {job.missing_keywords && (
                                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#dc2626' }}>
                                    <strong>Missing:</strong> {job.missing_keywords}
                                  </div>
                                )}
                              </td>
                              <td>
                                {(job.contact_email || job.contact_phone || job.contact_website) ? (
                                  <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#e0f2fe', borderLeft: '3px solid #0284c7', borderRadius: '6px', fontSize: '0.85rem' }}>
                                    <strong style={{ display: 'block', marginBottom: '0.35rem', color: '#0369a1' }}>Contact Information</strong>
                                    {job.contact_email && (
                                      <div style={{ marginBottom: '0.2rem' }}>
                                        <strong>Email:</strong> <a href={`mailto:${job.contact_email}`} style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{job.contact_email}</a>
                                      </div>
                                    )}
                                    {job.contact_phone && (
                                      <div style={{ marginBottom: '0.2rem' }}>
                                        <strong>Phone:</strong> <span style={{ color: 'var(--foreground)' }}>{job.contact_phone}</span>
                                      </div>
                                    )}
                                    {job.contact_website && (
                                      <div style={{ marginBottom: '0.2rem' }}>
                                        <strong>Website:</strong> <a href={job.contact_website} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{job.contact_website}</a>
                                      </div>
                                    )}
                                  </div>
                                ) : job.contact_info ? (
                                  <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: '#e0f2fe', borderLeft: '3px solid #0284c7', borderRadius: '4px', fontSize: '0.85rem' }}>
                                    <strong>Contact:</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{job.contact_info}</span>
                                  </div>
                                ) : null}
                                
                                {drafts[job.id] && (
                                  <div style={{ padding: '0.75rem', background: '#fef3c7', borderLeft: '3px solid #d97706', borderRadius: '4px', fontSize: '0.85rem', whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>
                                    <strong>Drafted Email:</strong><br/>
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
                                    className="btn-primary" 
                                    style={{ marginTop: '0.5rem', background: '#8b5cf6' }}
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
