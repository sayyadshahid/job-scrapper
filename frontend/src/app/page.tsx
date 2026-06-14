"use client";

import { useState } from "react";
import Sidebar from "../components/Sidebar";
import ProfileTab from "../components/ProfileTab";
import HistoryTab from "../components/HistoryTab";
import SearchResults from "../components/SearchResults";
import { scrapeJobs } from "../services/api";

export default function Home() {
  const [activeTab, setActiveTab] = useState("search");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Search state
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionContext, setSessionContext] = useState({ role: "", location: "", targetSite: "" });

  const handleSearch = async (payload: any) => {
    setLoading(true);
    setJobs([]);
    setSessionContext({ role: payload.role, location: payload.location, targetSite: payload.target_site });
    setIsSidebarOpen(false); // Close sidebar on mobile after search
    
    try {
      const data = await scrapeJobs(payload);
      setJobs(data);
    } catch (err: any) {
      alert(`Error occurred while scraping: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <header className="header">
        <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            className="mobile-toggle" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Toggle Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <h1>Job Scraper Pro</h1>
        </div>
      </header>

      <div className="dashboard-body">
        {/* Mobile overlay */}
        {isSidebarOpen && (
          <div 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 5 }}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onSearch={handleSearch} 
          loading={loading}
          isOpen={isSidebarOpen}
        />

        <main className="main-content">
          {activeTab === "profile" && <ProfileTab />}
          
          {activeTab === "search" && (
            <SearchResults 
              jobs={jobs} 
              loading={loading} 
              onClear={() => setJobs([])} 
              sessionContext={sessionContext} 
            />
          )}

          {activeTab === "saved" && <HistoryTab />}
        </main>
      </div>
    </div>
  );
}
