import { useState, useEffect } from "react";
import { fetchProfile, saveProfile as saveProfileApi } from "../services/api";

export default function ProfileTab() {
  const [resumeText, setResumeText] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    fetchProfile().then(data => setResumeText(data.resume_text || "")).catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      await saveProfileApi(resumeText);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <div className="content-header">
        <h2>My Profile & Resume</h2>
      </div>
      <textarea 
        value={resumeText}
        onChange={(e) => setResumeText(e.target.value)}
        placeholder="Paste your full resume text here..."
        style={{ width: '100%', height: '400px', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.95rem', fontFamily: 'monospace' }}
      />
      <button onClick={handleSave} className="btn-primary" style={{ marginTop: '1rem', width: 'auto' }}>
        {profileSaved ? "Saved!" : "Save Profile"}
      </button>
    </div>
  );
}
