import { useState } from "react";
import { saveJobs } from "../services/api";
import { exportJobsToFormat } from "../utils/export";
interface SearchResultsProps {
  jobs: any[];
  loading: boolean;
  onClear: () => void;
  sessionContext: { role: string; location: string; targetSite: string };
}

export default function SearchResults({ jobs, loading, onClear, sessionContext }: SearchResultsProps) {
  const [selectedJobIndices, setSelectedJobIndices] = useState<Set<number>>(new Set());
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [timeFilter, setTimeFilter] = useState("All Time");
  const [workModeFilter, setWorkModeFilter] = useState("All");

  const toggleSelection = (idx: number) => {
    const newSet = new Set(selectedJobIndices);
    if (newSet.has(idx)) newSet.delete(idx);
    else newSet.add(idx);
    setSelectedJobIndices(newSet);
  };

  const bulkSave = async () => {
    if (selectedJobIndices.size === 0) return;
    setIsBulkSaving(true);
    
    const jobsToSave = Array.from(selectedJobIndices).map(idx => jobs[idx]);
    const sessionName = `${sessionContext.role} in ${sessionContext.location} (${sessionContext.targetSite}) - ${new Date().toLocaleDateString()}`;

    try {
      await saveJobs(jobsToSave, sessionName);
      alert("Jobs saved successfully! Contact info and match scores extracted.");
      setSelectedJobIndices(new Set());
      onClear();
    } catch (err: any) {
      alert(`Error saving jobs: ${err.message}`);
    } finally {
      setIsBulkSaving(false);
    }
  };

  const uniqueSources = Array.from(new Set(jobs.map(j => j.source))).filter(Boolean);

  const filteredJobs = jobs.map((job, originalIndex) => ({ job, originalIndex })).filter(({ job }) => {
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

  const isAllFilteredSelected = filteredJobs.length > 0 && filteredJobs.every(f => selectedJobIndices.has(f.originalIndex));

  return (
    <>
      <div className="content-header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2>Search Results {jobs.length > 0 && `(${filteredJobs.length} visible)`}</h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {filteredJobs.length > 0 && (
              <>
                <button 
                  onClick={() => {
                    const newSet = new Set(selectedJobIndices);
                    if (isAllFilteredSelected) {
                      filteredJobs.forEach(f => newSet.delete(f.originalIndex));
                    } else {
                      filteredJobs.forEach(f => newSet.add(f.originalIndex));
                    }
                    setSelectedJobIndices(newSet);
                  }} 
                  className="btn-secondary" 
                  style={{ width: 'auto', padding: '0.5rem 1rem' }}
                >
                  {isAllFilteredSelected ? "Deselect All" : "Select All"}
                </button>
                <button 
                  onClick={() => exportJobsToFormat(filteredJobs.map(f => f.job), "search_results", "csv")} 
                  className="btn-secondary" 
                  style={{ width: 'auto', padding: '0.5rem 1rem' }}
                >
                  Download CSV
                </button>
                <button 
                  onClick={() => exportJobsToFormat(filteredJobs.map(f => f.job), "search_results", "xlsx")} 
                  className="btn-secondary" 
                  style={{ width: 'auto', padding: '0.5rem 1rem' }}
                >
                  Download Excel
                </button>
              </>
            )}
            {selectedJobIndices.size > 0 && (
              <button onClick={bulkSave} disabled={isBulkSaving} className="btn-success" style={{ width: 'auto' }}>
                {isBulkSaving ? "Saving & Analyzing..." : `Save Selected (${selectedJobIndices.size})`}
              </button>
            )}
          </div>
        </div>

        {jobs.length > 0 && (
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
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '5%' }}><div className="skeleton skeleton-text w-full"></div></th>
                <th style={{ width: '25%' }}><div className="skeleton skeleton-text w-3-4"></div></th>
                <th style={{ width: '15%' }}><div className="skeleton skeleton-text w-1-2"></div></th>
                <th style={{ width: '45%' }}><div className="skeleton skeleton-text w-full"></div></th>
                <th style={{ width: '10%' }}><div className="skeleton skeleton-text w-full"></div></th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((_, i) => (
                <tr key={i}>
                  <td><div className="skeleton skeleton-text" style={{ width: '18px', height: '18px' }}></div></td>
                  <td>
                    <div className="skeleton skeleton-title"></div>
                    <div className="skeleton skeleton-text w-1-2"></div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <div className="skeleton skeleton-badge"></div>
                      <div className="skeleton skeleton-badge"></div>
                    </div>
                  </td>
                  <td><div className="skeleton skeleton-text w-full"></div></td>
                  <td>
                    <div className="skeleton skeleton-text w-full"></div>
                    <div className="skeleton skeleton-text w-full"></div>
                    <div className="skeleton skeleton-text w-3-4"></div>
                  </td>
                  <td><div className="skeleton skeleton-button"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem', color: 'var(--foreground-muted)' }}>
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <h3>No jobs found</h3>
          <p>Try adjusting your search criteria and run a new scrape.</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem', color: 'var(--foreground-muted)' }}>
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
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '5%' }}>
                  <input 
                    type="checkbox" 
                    checked={isAllFilteredSelected}
                    onChange={(e) => {
                      const newSet = new Set(selectedJobIndices);
                      if (e.target.checked) {
                        filteredJobs.forEach(f => newSet.add(f.originalIndex));
                      } else {
                        filteredJobs.forEach(f => newSet.delete(f.originalIndex));
                      }
                      setSelectedJobIndices(newSet);
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                    title="Select All / Deselect All Visible"
                  />
                </th>
                <th style={{ width: '25%' }}>Title & Company</th>
                <th style={{ width: '15%' }}>Location</th>
                <th style={{ width: '45%' }}>Description</th>
                <th style={{ width: '10%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map(({ job, originalIndex }) => (
                <tr key={originalIndex} style={{ background: selectedJobIndices.has(originalIndex) ? 'var(--primary-light)' : '' }}>
                  <td>
                    <input type="checkbox" checked={selectedJobIndices.has(originalIndex)} onChange={() => toggleSelection(originalIndex)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }} />
                  </td>
                  <td>
                    <strong style={{ color: 'var(--primary)', fontSize: '1.05rem', fontFamily: 'Outfit, sans-serif' }}>{job.title}</strong><br />
                    <span style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', fontWeight: 500 }}>{job.company}</span><br />
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                      <span className="badge badge-primary">{job.source}</span>
                      {job.posted_time && (
                        <span className="badge badge-warning" title="Time Posted">{job.posted_time}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--foreground-muted)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                      {job.location}
                    </div>
                  </td>
                  <td>
                    <p style={{ margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--foreground)' }}>{job.description}</p>
                  </td>
                  <td>
                    <div className="table-actions">
                      {job.application_link && (
                        <a href={job.application_link} target="_blank" rel="noreferrer" className="btn-secondary" style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>Apply</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
