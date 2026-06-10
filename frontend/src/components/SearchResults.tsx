import { useState } from "react";
import { saveJobs } from "../services/api";

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
                {isAllFilteredSelected ? "Deselect All Visible" : "Select All Visible"}
              </button>
            )}
            {selectedJobIndices.size > 0 && (
              <button onClick={bulkSave} disabled={isBulkSaving} className="btn-success" style={{ width: 'auto' }}>
                {isBulkSaving ? "Saving & Analyzing..." : `Save Selected (${selectedJobIndices.size})`}
              </button>
            )}
          </div>
        </div>

        {jobs.length > 0 && (
          <div className="filters-bar" style={{ display: 'flex', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', flexWrap: 'wrap', border: '1px solid #e2e8f0' }}>
            <input 
              type="text" 
              placeholder="Search title, company, description, location..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ flex: '1 1 250px', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.9rem' }} 
            />
            <select 
              value={workModeFilter} 
              onChange={e => setWorkModeFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.9rem', backgroundColor: '#fff' }}
            >
              <option value="All">All Work Modes</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>
            <select 
              value={sourceFilter} 
              onChange={e => setSourceFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.9rem', backgroundColor: '#fff' }}
            >
              <option value="All">All Platforms</option>
              {uniqueSources.map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
            </select>
            <select 
              value={timeFilter} 
              onChange={e => setTimeFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.9rem', backgroundColor: '#fff' }}
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
        <div className="empty-state"><p>Scraping jobs...</p></div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <h3>No jobs found</h3>
          <p>Try adjusting your search criteria and run a new scrape.</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="empty-state">
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
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
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
                <tr key={originalIndex} style={{ background: selectedJobIndices.has(originalIndex) ? '#f0fdf4' : '' }}>
                  <td>
                    <input type="checkbox" checked={selectedJobIndices.has(originalIndex)} onChange={() => toggleSelection(originalIndex)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  </td>
                  <td>
                    <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{job.title}</strong><br />
                    <span style={{ color: 'var(--secondary)', fontSize: '0.85rem' }}>{job.company}</span><br />
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', background: '#e0e7ff', color: '#4338ca', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{job.source}</span>
                      {job.posted_time && (
                        <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', background: '#fef3c7', color: '#d97706', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }} title="Time Posted">{job.posted_time}</span>
                      )}
                    </div>
                  </td>
                  <td>{job.location}</td>
                  <td>
                    <p style={{ margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{job.description}</p>
                  </td>
                  <td>
                    <div className="table-actions">
                      {job.application_link && (
                        <a href={job.application_link} target="_blank" rel="noreferrer" className="btn-secondary">Apply</a>
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
