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

  return (
    <>
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h2>Search Results</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {jobs.length > 0 && (
            <button 
              onClick={() => {
                if (selectedJobIndices.size === jobs.length) {
                  setSelectedJobIndices(new Set());
                } else {
                  setSelectedJobIndices(new Set(jobs.map((_, idx) => idx)));
                }
              }} 
              className="btn-secondary" 
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
            >
              {selectedJobIndices.size === jobs.length ? "Deselect All" : "Select All"}
            </button>
          )}
          {selectedJobIndices.size > 0 && (
            <button onClick={bulkSave} disabled={isBulkSaving} className="btn-success" style={{ width: 'auto' }}>
              {isBulkSaving ? "Saving & Analyzing..." : `Save Selected (${selectedJobIndices.size})`}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><p>Scraping jobs...</p></div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <h3>No jobs found</h3>
          <p>Try adjusting your search criteria and run a new scrape.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '5%' }}>
                  <input 
                    type="checkbox" 
                    checked={jobs.length > 0 && selectedJobIndices.size === jobs.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedJobIndices(new Set(jobs.map((_, idx) => idx)));
                      } else {
                        setSelectedJobIndices(new Set());
                      }
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    title="Select All / Deselect All"
                  />
                </th>
                <th style={{ width: '25%' }}>Title & Company</th>
                <th style={{ width: '15%' }}>Location</th>
                <th style={{ width: '45%' }}>Description</th>
                <th style={{ width: '10%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, idx) => (
                <tr key={idx} style={{ background: selectedJobIndices.has(idx) ? '#f0fdf4' : '' }}>
                  <td>
                    <input type="checkbox" checked={selectedJobIndices.has(idx)} onChange={() => toggleSelection(idx)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
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
