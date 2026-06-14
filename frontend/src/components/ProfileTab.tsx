import { useState, useEffect, useRef } from "react";
import { fetchProfile, saveProfile as saveProfileApi } from "../services/api";

export default function ProfileTab() {
  const [resumeText, setResumeText] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile()
      .then((data) => setResumeText(data.resume_text || ""))
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProfileApi(resumeText);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (e) {
      console.error(e);
      alert("Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setResumeText(event.target.result as string);
      }
    };
    reader.readAsText(file);
  };

  // Helper algorithms for real-time analysis
  const calculateStrength = (text: string) => {
    if (!text.trim()) return 0;
    let score = 0;
    
    // Length contribution (up to 30 points)
    score += Math.min(30, Math.floor(text.trim().length / 60));
    
    // Keywords check (10 points each, max 50 points)
    const keywords = [/skills/i, /experience/i, /education/i, /project/i, /work/i];
    keywords.forEach((regex) => {
      if (regex.test(text)) score += 10;
    });
    
    // Contact details check (20 points)
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
    const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text);
    if (hasEmail) score += 10;
    if (hasPhone) score += 10;
    
    return Math.min(100, score);
  };

  const extractSkills = (text: string) => {
    if (!text.trim()) return [];
    const skillPool = [
      "React", "TypeScript", "JavaScript", "Python", "Node.js", "SQL", "PostgreSQL",
      "Docker", "AWS", "Kubernetes", "Git", "FastAPI", "Django", "Next.js", "HTML",
      "CSS", "Tailwind", "Java", "C++", "Go", "Rust", "NoSQL", "MongoDB", "Redis",
      "Machine Learning", "Data Analysis", "AI", "REST API", "GraphQL", "CI/CD"
    ];
    return skillPool.filter((skill) => {
      const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      return regex.test(text);
    });
  };

  const extractContact = (text: string) => {
    if (!text.trim()) return { email: null, phone: null };
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    return {
      email: emailMatch ? emailMatch[0] : null,
      phone: phoneMatch ? phoneMatch[0] : null,
    };
  };

  const strength = calculateStrength(resumeText);
  const skills = extractSkills(resumeText);
  const contact = extractContact(resumeText);
  const wordCount = resumeText.trim() === "" ? 0 : resumeText.trim().split(/\s+/).length;
  const charCount = resumeText.length;

  const strengthColor = () => {
    if (strength >= 80) return "var(--success)";
    if (strength >= 50) return "var(--warning)";
    return "var(--danger)";
  };

  return (
    <div>
      <div className="content-header" style={{ marginBottom: "2rem" }}>
        <h2>Profile & Resume Intelligence</h2>
        <p style={{ color: "var(--foreground-muted)", marginTop: "0.5rem" }}>
          Maintain your professional resume content here. Our AI engine uses this data to calculate compatibility scores and draft highly personalized, contextual applications for you.
        </p>
      </div>

      <div className="profile-container">
        {/* Left Column: Editor */}
        <div className="profile-card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="profile-card-header" style={{ margin: 0 }}>
            <div>
              <h3 className="profile-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Resume Content
              </h3>
              <p className="profile-card-subtitle">Paste, edit or upload your resume text</p>
            </div>
          </div>

          {/* Upload Zone */}
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p style={{ fontSize: "0.9rem", color: "var(--foreground)", fontWeight: 500, margin: 0 }}>Import from Document</p>
            <p style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", margin: "0.25rem 0 0 0" }}>Click to select a raw text file (.txt, .rtf)</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".txt,.rtf" 
              style={{ display: "none" }} 
            />
          </div>

          <div style={{ position: "relative" }}>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your full resume text here (include Contact, Experience, Skills, and Education sections for optimal AI analysis)..."
              style={{
                width: "100%",
                height: "380px",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                fontSize: "0.95rem",
                fontFamily: "monospace",
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
                resize: "vertical",
                boxSizing: "border-box",
                lineHeight: "1.5"
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.5rem" }}>
              <span>{charCount} characters</span>
              <span>{wordCount} words</span>
            </div>
          </div>

          <button 
            onClick={handleSave} 
            disabled={isSaving} 
            className="btn-primary" 
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            {isSaving ? "Saving..." : profileSaved ? "Profile Saved!" : "Save Profile & Update Engine"}
          </button>
        </div>

        {/* Right Column: Insights */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Card 1: Strength */}
          <div className="profile-card">
            <h3 className="profile-card-title" style={{ marginBottom: "1rem" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: strengthColor() }}>
                <path d="M12 20V10"></path>
                <path d="M18 20V4"></path>
                <path d="M6 20v-4"></path>
              </svg>
              Resume Strength Meter
            </h3>

            <div className="strength-container">
              <div className="strength-header">
                <span style={{ color: "var(--foreground-muted)" }}>Completeness Score</span>
                <span style={{ color: strengthColor() }}>{strength}%</span>
              </div>
              <div className="strength-bar-bg">
                <div 
                  className="strength-bar-fill" 
                  style={{ 
                    width: `${strength}%`, 
                    backgroundColor: strengthColor(),
                    boxShadow: `0 0 8px ${strengthColor()}`
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <div className="checklist-item">
                <span className={`checklist-icon ${charCount > 500 ? "checked" : "unchecked"}`}>
                  {charCount > 500 ? "✓" : "○"}
                </span>
                <span style={{ color: charCount > 500 ? "var(--foreground)" : "var(--foreground-muted)" }}>
                  Optimal length (&gt;500 chars)
                </span>
              </div>
              <div className="checklist-item">
                <span className={`checklist-icon ${contact.email || contact.phone ? "checked" : "unchecked"}`}>
                  {contact.email || contact.phone ? "✓" : "○"}
                </span>
                <span style={{ color: contact.email || contact.phone ? "var(--foreground)" : "var(--foreground-muted)" }}>
                  Contact Information present
                </span>
              </div>
              <div className="checklist-item">
                <span className={`checklist-icon ${/skills/i.test(resumeText) ? "checked" : "unchecked"}`}>
                  {/skills/i.test(resumeText) ? "✓" : "○"}
                </span>
                <span style={{ color: /skills/i.test(resumeText) ? "var(--foreground)" : "var(--foreground-muted)" }}>
                  Skills section found
                </span>
              </div>
              <div className="checklist-item">
                <span className={`checklist-icon ${/experience|work/i.test(resumeText) ? "checked" : "unchecked"}`}>
                  {/experience|work/i.test(resumeText) ? "✓" : "○"}
                </span>
                <span style={{ color: /experience|work/i.test(resumeText) ? "var(--foreground)" : "var(--foreground-muted)" }}>
                  Professional Experience section
                </span>
              </div>
              <div className="checklist-item">
                <span className={`checklist-icon ${/education/i.test(resumeText) ? "checked" : "unchecked"}`}>
                  {/education/i.test(resumeText) ? "✓" : "○"}
                </span>
                <span style={{ color: /education/i.test(resumeText) ? "var(--foreground)" : "var(--foreground-muted)" }}>
                  Education details found
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Extracted Details */}
          <div className="profile-card">
            <h3 className="profile-card-title" style={{ marginBottom: "1rem" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              Detected Info & Skills
            </h3>

            {/* Contact details */}
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.5rem" }}>Contact Details</p>
              {contact.email || contact.phone ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", background: "var(--background)", padding: "0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "0.85rem" }}>
                  {contact.email && (
                    <div style={{ wordBreak: "break-all" }}>
                      <strong style={{ color: "var(--foreground-muted)", marginRight: "0.25rem" }}>Email:</strong> {contact.email}
                    </div>
                  )}
                  {contact.phone && (
                    <div>
                      <strong style={{ color: "var(--foreground-muted)", marginRight: "0.25rem" }}>Phone:</strong> {contact.phone}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", fontStyle: "italic", margin: 0 }}>No contact email/phone detected in resume text.</p>
              )}
            </div>

            {/* Extracted Skills */}
            <div>
              <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.5rem" }}>Extracted Core Skills ({skills.length})</p>
              {skills.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {skills.map((skill) => (
                    <span 
                      key={skill} 
                      className="badge badge-primary" 
                      style={{ borderRadius: "4px", padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", fontStyle: "italic", margin: 0 }}>No matching skills from our taxonomy detected.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
