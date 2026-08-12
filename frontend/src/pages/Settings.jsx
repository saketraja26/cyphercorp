import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  ShieldCheck,
  Lock,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  LogOut,
  KeyRound,
  Fingerprint,
} from "lucide-react";
import { getCurrentUser, updateProfile, changePassword, logoutUser } from "../services/api";

function Settings() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("profile"); // "profile" | "security"

  // User state
  const [userData, setUserData] = useState({
    id: "",
    name: "",
    email: "",
    created_at: "",
  });
  const [loadingUser, setLoadingUser] = useState(true);

  // Profile Form state
  const [nameInput, setNameInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoadingUser(true);
        // Try local storage cache first
        const cached = localStorage.getItem("user_info");
        if (cached) {
          const parsed = JSON.parse(cached);
          setUserData(parsed);
          setNameInput(parsed.name || "");
        }

        // Fetch fresh user data
        const res = await getCurrentUser();
        if (res) {
          setUserData(res);
          setNameInput(res.name || "");
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUser();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName) {
      setProfileError("Please enter your name.");
      return;
    }

    try {
      setSavingProfile(true);
      setProfileError("");
      setProfileSuccess("");

      const updated = await updateProfile({ name: cleanName });
      setUserData((prev) => ({ ...prev, name: updated.name }));
      setNameInput(updated.name);
      setProfileSuccess("Profile updated successfully!");

      setTimeout(() => {
        setProfileSuccess("");
      }, 4000);
    } catch (err) {
      setProfileError(err.response?.data?.detail || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      setSavingPassword(true);
      const res = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setPasswordSuccess(res.message || "Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        setPasswordSuccess("");
      }, 4000);
    } catch (err) {
      setPasswordError(err.response?.data?.detail || "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const formattedDate = userData.created_at
    ? new Date(userData.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Active Member";

  const userInitials = userData.name
    ? userData.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-header-content">
          <div className="settings-eyebrow">
            <Fingerprint size={14} />
            <span>ACCOUNT & SECURITY</span>
          </div>
          <h1>Account Settings.</h1>
          <p>
            Manage your personal profile, credentials, active sessions, and security preferences.
          </p>
        </div>

        {/* Quick User Summary Bar */}
        <div className="settings-summary-pills">
          <div className="settings-pill-stat">
            <span className="pill-label">Account</span>
            <span className="pill-value highlight">{userData.name || "Loading..."}</span>
          </div>
          <div className="settings-pill-stat">
            <span className="pill-label">Email</span>
            <span className="pill-value">{userData.email || "—"}</span>
          </div>
          <div className="settings-pill-stat">
            <span className="pill-label">Member Since</span>
            <span className="pill-value">{formattedDate}</span>
          </div>
          <div className="settings-pill-stat">
            <span className="pill-label">Status</span>
            <span className="pill-value green">Active</span>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="settings-tabs-bar">
        <button
          className={`settings-tab-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <User size={16} />
          <span>Profile Details</span>
        </button>
        <button
          className={`settings-tab-btn ${activeTab === "security" ? "active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          <ShieldCheck size={16} />
          <span>Security & Password</span>
        </button>
      </div>

      {/* TAB 1: PROFILE DETAILS */}
      {activeTab === "profile" && (
        <div className="settings-section-body">
          {/* Profile Overview Card */}
          <div className="settings-card">
            <div className="profile-hero-row">
              <div className="profile-avatar-large">{userInitials}</div>
              <div className="profile-hero-info">
                <h3>{userData.name || "User Account"}</h3>
                <p className="profile-email-badge">
                  <Mail size={13} />
                  <span>{userData.email}</span>
                </p>
                <div className="profile-meta-tags">
                  <span className="meta-tag">
                    <Calendar size={12} />
                    <span>Joined {formattedDate}</span>
                  </span>
                  <span className="meta-tag green">
                    <CheckCircle2 size={12} />
                    <span>Verified</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Edit Profile Form Card */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="card-title-group">
                <div className="card-icon-box blue">
                  <User size={18} />
                </div>
                <div>
                  <h3>Personal Information</h3>
                  <p>Update your display name and view registered email credentials.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="settings-fields-stack">
              <div className="settings-two-col">
                {/* Full Name */}
                <div className="settings-field-group">
                  <label htmlFor="user-full-name">Full Name</label>
                  <input
                    id="user-full-name"
                    type="text"
                    className="settings-text-input"
                    placeholder="Enter your full name"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      setProfileError("");
                    }}
                  />
                  <span className="field-hint">Displayed across your dashboard and dataset workspaces.</span>
                </div>

                {/* Email Address (Read Only) */}
                <div className="settings-field-group">
                  <label htmlFor="user-email">Email Address</label>
                  <input
                    id="user-email"
                    type="email"
                    className="settings-text-input readonly"
                    value={userData.email}
                    disabled
                  />
                  <span className="field-hint">Email address is tied to your account identity.</span>
                </div>
              </div>

              {profileError && (
                <div className="status-feedback error">
                  <AlertCircle size={15} />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSuccess && (
                <div className="status-feedback success">
                  <CheckCircle2 size={15} />
                  <span>{profileSuccess}</span>
                </div>
              )}

              <div className="form-submit-row">
                <button
                  type="submit"
                  className="settings-btn-primary"
                  disabled={savingProfile || nameInput.trim() === userData.name}
                >
                  <Save size={15} />
                  <span>{savingProfile ? "Saving..." : "Save Profile"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY & PASSWORD */}
      {activeTab === "security" && (
        <div className="settings-section-body">
          {/* Change Password Card */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="card-title-group">
                <div className="card-icon-box orange">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3>Change Password</h3>
                  <p>Ensure your account uses a secure password of at least 6 characters.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="settings-fields-stack">
              {/* Current Password */}
              <div className="settings-field-group">
                <label htmlFor="current-pwd">Current Password</label>
                <div className="key-input-wrapper">
                  <input
                    id="current-pwd"
                    type={showCurrent ? "text" : "password"}
                    placeholder="Enter your current password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setPasswordError("");
                    }}
                  />
                  <button
                    type="button"
                    className="eye-toggle-btn"
                    onClick={() => setShowCurrent(!showCurrent)}
                  >
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="settings-two-col">
                {/* New Password */}
                <div className="settings-field-group">
                  <label htmlFor="new-pwd">New Password</label>
                  <div className="key-input-wrapper">
                    <input
                      id="new-pwd"
                      type={showNew ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordError("");
                      }}
                    />
                    <button
                      type="button"
                      className="eye-toggle-btn"
                      onClick={() => setShowNew(!showNew)}
                    >
                      {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="settings-field-group">
                  <label htmlFor="confirm-pwd">Confirm New Password</label>
                  <div className="key-input-wrapper">
                    <input
                      id="confirm-pwd"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordError("");
                      }}
                    />
                    <button
                      type="button"
                      className="eye-toggle-btn"
                      onClick={() => setShowConfirm(!showConfirm)}
                    >
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {passwordError && (
                <div className="status-feedback error">
                  <AlertCircle size={15} />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="status-feedback success">
                  <CheckCircle2 size={15} />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div className="form-submit-row">
                <button
                  type="submit"
                  className="settings-btn-primary"
                  disabled={savingPassword || !currentPassword || !newPassword}
                >
                  <Lock size={15} />
                  <span>{savingPassword ? "Updating Password..." : "Update Password"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Session & Sign Out Card */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="card-title-group">
                <div className="card-icon-box purple">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3>Session & Authentication</h3>
                  <p>Manage your current sign-in session and authorization tokens.</p>
                </div>
              </div>
            </div>

            <div className="session-info-box">
              <div className="session-info-left">
                <div className="session-status-dot" />
                <div>
                  <strong>Current Active Session</strong>
                  <p>Secured with JWT HS256 Bearer Token • Browser Storage</p>
                </div>
              </div>

              <button
                type="button"
                className="session-signout-btn"
                onClick={() => {
                  logoutUser();
                  navigate("/login", { replace: true });
                }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
