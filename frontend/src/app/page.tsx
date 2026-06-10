"use client";

import { useState } from "react";
import Sidebar from "../components/Sidebar";
import ProfileTab from "../components/ProfileTab";
import HistoryTab from "../components/HistoryTab";
import SearchResults from "../components/SearchResults";
import { scrapeJobs } from "../services/api";

export default function Home() {
  const [activeTab, setActiveTab] = useState("search");
  
  // Search state
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionContext, setSessionContext] = useState({ role: "", location: "", targetSite: "" });

  const handleSearch = async (payload: any) => {
    setLoading(true);
    setJobs([]);
    setSessionContext({ role: payload.role, location: payload.location, targetSite: payload.target_site });
    
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
        <div className="header-title">
          <h1>Job Scraper Pro</h1>
        </div>
      </header>

      <div className="dashboard-body">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onSearch={handleSearch} 
          loading={loading} 
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
