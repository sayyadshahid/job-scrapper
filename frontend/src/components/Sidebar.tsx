import { useState } from "react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSearch: (payload: any) => void;
  loading: boolean;
}

export default function Sidebar({ activeTab, setActiveTab, onSearch, loading }: SidebarProps) {
  const [location, setLocation] = useState("");
  const [role, setRole] = useState("");
  const [skills, setSkills] = useState("");
  const [targetSite, setTargetSite] = useState("linkedin");
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [workModel, setWorkModel] = useState("Any");
  const [datePosted, setDatePosted] = useState("Any");
  const [experienceLevel, setExperienceLevel] = useState("Any");
  const [jobType, setJobType] = useState("Any");
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [visaRelocation, setVisaRelocation] = useState(false);
  const [companySize, setCompanySize] = useState("Any");
  const [clearance, setClearance] = useState("None");
  const [easyApply, setEasyApply] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      location, role, skills, target_site: targetSite,
      work_model: workModel, date_posted: datePosted, experience_level: experienceLevel,
      job_type: jobType, exclude_keywords: excludeKeywords, min_salary: minSalary,
      visa_relocation: visaRelocation, company_size: companySize, clearance, easy_apply: easyApply
    });
  };

  return (
    <aside className="sidebar" style={{ overflowY: 'auto' }}>
      <nav className="sidebar-nav">
        <button className={activeTab === "search" ? "active" : ""} onClick={() => setActiveTab("search")}>Search</button>
        <button className={activeTab === "saved" ? "active" : ""} onClick={() => setActiveTab("saved")}>History</button>
        <button className={activeTab === "profile" ? "active" : ""} onClick={() => setActiveTab("profile")}>Profile</button>
      </nav>

      {activeTab === "search" && (
        <form onSubmit={handleSubmit} className="search-form">
          <div className="form-group">
            <label>Job Role</label>
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} required placeholder="e.g. Frontend Developer" />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} required placeholder="e.g. San Francisco, CA" />
          </div>
          <div className="form-group">
            <label>Skills</label>
            <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. React, TypeScript" />
          </div>
          <div className="form-group">
            <label>Target Site</label>
            <select value={targetSite} onChange={(e) => setTargetSite(e.target.value)}>
              <option value="all">All Platforms</option>
              <option value="linkedin">LinkedIn</option>
              <option value="naukri">Naukri</option>
              <option value="indeed">Indeed</option>
              <option value="glassdoor">Glassdoor</option>
              <option value="unstop">Unstop</option>
              <option value="workindia">WorkIndia</option>
              <option value="internshala">Internshala</option>
              <option value="shine">Shine</option>
              <option value="timesjobs">TimesJobs</option>
              <option value="foundit">FoundIt</option>
              <option value="wellfound">Wellfound</option>
              <option value="remotive">Remotive (API)</option>
              <option value="arbeitnow">Arbeitnow (API)</option>
              <option value="jobicy">Jobicy (API)</option>
            </select>
          </div>

          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button 
              type="button" 
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 'bold', cursor: 'pointer', padding: 0, width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}
            >
              Advanced Filters
              <span>{showAdvanced ? "▲" : "▼"}</span>
            </button>
            
            {showAdvanced && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Work Model</label>
                  <select value={workModel} onChange={(e) => setWorkModel(e.target.value)}>
                    <option value="Any">Any</option><option value="Remote">Remote</option><option value="Hybrid">Hybrid</option><option value="On-site">On-site</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Date Posted / Time Duration</label>
                  <select value={datePosted} onChange={(e) => setDatePosted(e.target.value)}>
                    <option value="Any">Any time</option>
                    <option value="Past 24 hours">Past 24 hours</option>
                    <option value="Past week">Past week</option>
                    <option value="Past month">Past month</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Experience Level</label>
                  <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
                    <option value="Any">Any</option><option value="Entry Level">Entry Level</option><option value="Mid-Senior">Mid-Senior</option><option value="Director/Executive">Director/Executive</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Job Type</label>
                  <select value={jobType} onChange={(e) => setJobType(e.target.value)}>
                    <option value="Any">Any</option><option value="Full-Time">Full-Time</option><option value="Contract">Contract</option><option value="Internship">Internship</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Exclude Keywords / Companies</label>
                  <input type="text" value={excludeKeywords} onChange={(e) => setExcludeKeywords(e.target.value)} placeholder="e.g. Revature, unpaid" />
                </div>
                <div className="form-group">
                  <label>Minimum Salary</label>
                  <input type="text" value={minSalary} onChange={(e) => setMinSalary(e.target.value)} placeholder="e.g. $80,000" />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={visaRelocation} onChange={(e) => setVisaRelocation(e.target.checked)} id="visaCb" />
                  <label htmlFor="visaCb" style={{ margin: 0, fontWeight: 'normal' }}>Must offer Visa/Relocation</label>
                </div>
                <div className="form-group">
                  <label>Company Size</label>
                  <select value={companySize} onChange={(e) => setCompanySize(e.target.value)}>
                    <option value="Any">Any</option><option value="Startup">Startup</option><option value="Mid-Size">Mid-Size</option><option value="Enterprise">Enterprise / Fortune 500</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Security Clearance</label>
                  <select value={clearance} onChange={(e) => setClearance(e.target.value)}>
                    <option value="None">None required</option><option value="Secret">Secret</option><option value="Top Secret">Top Secret</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={easyApply} onChange={(e) => setEasyApply(e.target.checked)} id="easyApplyCb" />
                  <label htmlFor="easyApplyCb" style={{ margin: 0, fontWeight: 'normal' }}>"Easy Apply" only</label>
                </div>
              </div>
            )}
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '1rem' }}>
            {loading ? "Scraping..." : "Search Jobs"}
          </button>
        </form>
      )}

      {activeTab === "saved" && (
        <div className="empty-state" style={{ padding: '2rem 0', textAlign: 'left' }}><p>View your previous search sessions in the main panel.</p></div>
      )}
      {activeTab === "profile" && (
        <div className="empty-state" style={{ padding: '2rem 0', textAlign: 'left' }}><p>Paste your resume here to enable AI Match Scoring and automated Email drafting.</p></div>
      )}
    </aside>
  );
}
