import { useState, useEffect, useRef } from "react";
import { fetchProfile, saveProfile as saveProfileApi, parseResume } from "../services/api";

interface ProfileData {
  resume_text: string;
  full_name: string;
  title: string;
  location: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
  skills: string;
  bio: string;
}

const emptyProfile: ProfileData = {
  resume_text: "",
  full_name: "",
  title: "",
  location: "",
  email: "",
  phone: "",
  linkedin: "",
  github: "",
  portfolio: "",
  skills: "",
  bio: "",
};

export default function ProfileTab() {
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchProfile()
      .then((data) => {
        const hasData = data.resume_text || data.full_name;
        setProfile({ ...emptyProfile, ...data });
        if (hasData && data.resume_text) {
          setFileName("Saved resume");
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    try {
      const text = await file.text();
      setProfile((prev) => ({ ...prev, resume_text: text }));
      const parsed = await parseResume(text);
      setProfile((prev) => ({
        ...prev,
        resume_text: text,
        full_name: parsed.full_name || "",
        title: parsed.title || "",
        location: parsed.location || "",
        email: parsed.email || "",
        phone: parsed.phone || "",
        linkedin: parsed.linkedin || "",
        github: parsed.github || "",
        portfolio: parsed.portfolio || "",
        skills: parsed.skills || "",
        bio: parsed.bio || "",
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      await saveProfileApi(profile);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const skillsArray = profile.skills
    ? profile.skills.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const saveButtonLabel = () => {
    if (saving) return "Saving...";
    if (saveStatus === "saved") return "Profile Saved!";
    if (saveStatus === "error") return "Failed to Save";
    return "Save Profile & Update Engine";
  };

  const saveButtonClass = () => {
    if (saveStatus === "saved") return "btn-success";
    if (saveStatus === "error") return "btn-secondary";
    return "btn-primary";
  };

  if (loading) {
    return (
      <div>
        <div className="content-header" style={{ marginBottom: "2rem" }}>
          <div className="skeleton skeleton-title" style={{ width: "300px" }} />
          <div className="skeleton skeleton-text w-3-4" style={{ marginTop: "0.5rem" }} />
        </div>
        <div className="profile-container">
          <div className="profile-card">
            <div className="skeleton skeleton-title" style={{ width: "200px" }} />
            <div className="skeleton skeleton-text w-full" style={{ height: "200px", marginTop: "1rem" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="profile-card">
              <div className="skeleton skeleton-title" style={{ width: "180px" }} />
              <div className="skeleton skeleton-text w-full" style={{ marginTop: "1rem", height: "6rem" }} />
            </div>
            <div className="profile-card">
              <div className="skeleton skeleton-title" style={{ width: "160px" }} />
              <div className="skeleton skeleton-badge" />
              <div className="skeleton skeleton-badge" />
              <div className="skeleton skeleton-badge" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="content-header" style={{ marginBottom: "2rem" }}>
        <h2>Profile & Resume Intelligence</h2>
        <p style={{ color: "var(--foreground-muted)", marginTop: "0.5rem" }}>
          Upload your resume and our AI engine auto-extracts your profile details to calculate compatibility scores and draft personalized applications.
        </p>
      </div>

      <div className="profile-container">
        {/* Left Column: Upload & Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Upload Card */}
          <div className="profile-card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="profile-card-header" style={{ margin: 0 }}>
              <div>
                <h3 className="profile-card-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Resume Upload
                </h3>
                <p className="profile-card-subtitle">Upload your resume file — AI parses it automatically</p>
              </div>
            </div>

            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p style={{ fontSize: "0.9rem", color: "var(--foreground)", fontWeight: 500, margin: 0 }}>
                {fileName ? `File: ${fileName}` : "Click to select a resume file"}
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", margin: "0.25rem 0 0 0" }}>
                Supports .txt and .rtf files
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".txt,.rtf"
                style={{ display: "none" }}
              />
            </div>

            {parsing && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem", background: "var(--background)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                <span className="spinner" />
                <div>
                  <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--foreground)" }}>Parsing resume with AI...</p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem", color: "var(--foreground-muted)" }}>Extracting name, skills, contact, and more</p>
                </div>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving || parsing || !profile.resume_text}
              className={saveButtonClass()}
              style={{ width: "100%" }}
            >
              {saving ? (
                <>
                  <span className="spinner" />
                  Saving...
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Profile Saved!
                </>
              ) : saveStatus === "error" ? (
                "Failed - Try Again"
              ) : (
                "Save Profile & Update Engine"
              )}
            </button>
          </div>

          {/* Resume Preview (collapsible) */}
          {profile.resume_text && (
            <details className="profile-card" style={{ cursor: "pointer" }}>
              <summary className="profile-card-header" style={{ cursor: "pointer", margin: 0 }}>
                <h3 className="profile-card-title" style={{ fontSize: "1rem" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground-muted)" }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  View Resume Text ({profile.resume_text.length} chars)
                </h3>
              </summary>
              <pre style={{
                margin: "1rem 0 0",
                padding: "1rem",
                background: "var(--background)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                fontSize: "0.8rem",
                fontFamily: "monospace",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--foreground)",
                maxHeight: "300px",
                overflowY: "auto",
              }}>
                {profile.resume_text}
              </pre>
            </details>
          )}
        </div>

        {/* Right Column: AI-Extracted Profile */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <ResumeStrengthCard resumeText={profile.resume_text} />

          <div className="profile-card">
            <h3 className="profile-card-title" style={{ marginBottom: "1rem" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              Extracted Profile
            </h3>

            {profile.full_name || profile.title || profile.email || profile.bio ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {(profile.full_name || profile.title) && (
                  <div style={{ padding: "0.75rem", background: "var(--background)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                    {profile.full_name && (
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.15rem" }}>
                        {profile.full_name}
                      </div>
                    )}
                    {profile.title && (
                      <div style={{ fontSize: "0.85rem", color: "var(--primary)" }}>
                        {profile.title}
                      </div>
                    )}
                    {profile.location && (
                      <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                        {profile.location}
                      </div>
                    )}
                  </div>
                )}

                {(profile.email || profile.phone) && (
                  <div>
                    <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.4rem" }}>Contact</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0.75rem", background: "var(--background)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "0.85rem" }}>
                      {profile.email && <div style={{ wordBreak: "break-all" }}><strong style={{ color: "var(--foreground-muted)", marginRight: "0.25rem" }}>Email:</strong> {profile.email}</div>}
                      {profile.phone && <div><strong style={{ color: "var(--foreground-muted)", marginRight: "0.25rem" }}>Phone:</strong> {profile.phone}</div>}
                      {profile.linkedin && <div style={{ wordBreak: "break-all" }}><strong style={{ color: "var(--foreground-muted)", marginRight: "0.25rem" }}>LinkedIn:</strong> {profile.linkedin}</div>}
                      {profile.github && <div style={{ wordBreak: "break-all" }}><strong style={{ color: "var(--foreground-muted)", marginRight: "0.25rem" }}>GitHub:</strong> {profile.github}</div>}
                      {profile.portfolio && <div style={{ wordBreak: "break-all" }}><strong style={{ color: "var(--foreground-muted)", marginRight: "0.25rem" }}>Portfolio:</strong> {profile.portfolio}</div>}
                    </div>
                  </div>
                )}

                {profile.bio && (
                  <div>
                    <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.4rem" }}>Summary</p>
                    <div style={{ fontSize: "0.85rem", lineHeight: "1.6", color: "var(--foreground)", padding: "0.75rem", background: "var(--background)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                      {profile.bio}
                    </div>
                  </div>
                )}

                {skillsArray.length > 0 && (
                  <div>
                    <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.4rem" }}>
                      Skills ({skillsArray.length})
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {skillsArray.map((skill) => (
                        <span key={skill} className="badge badge-primary" style={{ borderRadius: "4px", padding: "0.25rem 0.55rem", fontSize: "0.75rem" }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground-muted)", marginBottom: "0.75rem", opacity: 0.4 }}>
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                <p style={{ fontSize: "0.9rem", color: "var(--foreground-muted)", margin: 0 }}>
                  Upload your resume to see extracted profile details.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResumeStrengthCard({ resumeText }: { resumeText: string }) {
  const calculateStrength = (text: string) => {
    if (!text.trim()) return 0;
    let score = 0;
    score += Math.min(30, Math.floor(text.trim().length / 60));
    const keywords = [/skills/i, /experience/i, /education/i, /project/i, /work/i];
    keywords.forEach((regex) => {
      if (regex.test(text)) score += 10;
    });
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
    const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text);
    if (hasEmail) score += 10;
    if (hasPhone) score += 10;
    return Math.min(100, score);
  };

  const strength = calculateStrength(resumeText);
  const charCount = resumeText.length;
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(resumeText);
  const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(resumeText);
  const hasSkills = /skills/i.test(resumeText);
  const hasExperience = /experience|work/i.test(resumeText);
  const hasEducation = /education/i.test(resumeText);

  const strengthColor = () => {
    if (strength >= 80) return "var(--success)";
    if (strength >= 50) return "var(--warning)";
    return "var(--danger)";
  };

  return (
    <div className="profile-card">
      <h3 className="profile-card-title" style={{ marginBottom: "1rem" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: strengthColor() }}>
          <path d="M12 20V10" />
          <path d="M18 20V4" />
          <path d="M6 20v-4" />
        </svg>
        Resume Strength Meter
      </h3>

      <div className="strength-container">
        <div className="strength-header">
          <span style={{ color: "var(--foreground-muted)" }}>Completeness Score</span>
          <span style={{ color: strengthColor(), fontSize: "1.25rem", fontWeight: 700 }}>{strength}%</span>
        </div>
        <div className="strength-bar-bg">
          <div
            className="strength-bar-fill"
            style={{
              width: `${strength}%`,
              backgroundColor: strengthColor(),
              boxShadow: `0 0 8px ${strengthColor()}`,
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <ChecklistItem checked={charCount > 500} label="Optimal length (&gt;500 chars)" />
        <ChecklistItem checked={hasEmail || hasPhone} label="Contact Information present" />
        <ChecklistItem checked={hasSkills} label="Skills section found" />
        <ChecklistItem checked={hasExperience} label="Professional Experience section" />
        <ChecklistItem checked={hasEducation} label="Education details found" />
      </div>
    </div>
  );
}

function ChecklistItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="checklist-item">
      <span className={`checklist-icon ${checked ? "checked" : "unchecked"}`}>
        {checked ? "✓" : "○"}
      </span>
      <span style={{ color: checked ? "var(--foreground)" : "var(--foreground-muted)" }}>
        {label}
      </span>
    </div>
  );
}
