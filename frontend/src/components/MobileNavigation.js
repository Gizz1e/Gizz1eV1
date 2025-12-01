"use client";

import React, { useState } from "react";
import MobileNavigation from "./MobileNavigation";

// Example placeholder sections – replace with your real components/content
const HomeSection = () => <div style={{ padding: 16 }}>Home content</div>;
const LiveStreamsSection = () => <div style={{ padding: 16 }}>Live Streams</div>;
const ModelsSection = () => <div style={{ padding: 16 }}>Models directory</div>;
const GizzleTvSection = () => <div style={{ padding: 16 }}>Gizzle TV content</div>;
const VideosSection = () => <div style={{ padding: 16 }}>Videos</div>;
const PicturesSection = () => <div style={{ padding: 16 }}>Pictures</div>;
const CommunitySection = () => <div style={{ padding: 16 }}>Community</div>;

// Map section IDs (must match MobileNavigation's navigationItems) to content
const SECTION_COMPONENTS = {
  home: HomeSection,
  "live-streams": LiveStreamsSection,
  models: ModelsSection,
  "gizzle-tv": GizzleTvSection,
  videos: VideosSection,
  pictures: PicturesSection,
  community: CommunitySection,
};

const HomeScreen = () => {
  // Main navigation state (shared with MobileNavigation and home screen buttons)
  const [activeSection, setActiveSection] = useState("home");

  // Auth-related state (wire these into your real auth system)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState({
    username: "Guest",
    account_type: "Viewer",
  });

  const [showViewerAuth, setShowViewerAuth] = useState(false);
  const [viewerAuthMode, setViewerAuthMode] = useState("login"); // "login" | "register"
  const [showModelLogin, setShowModelLogin] = useState(false);

  const logout = () => {
    // Replace with your real logout logic
    setIsAuthenticated(false);
    setUser({ username: "Guest", account_type: "Viewer" });
  };

  const CurrentSectionComponent =
    SECTION_COMPONENTS[activeSection] || SECTION_COMPONENTS.home;

  return (
    <div className="app-root">
      {/* Example desktop/top "Home Screen" buttons */}
      <header className="desktop-header">
        <div className="desktop-header-inner">
          <div className="desktop-logo">Gizzle TV</div>

          <nav className="desktop-nav">
            <button onClick={() => setActiveSection("home")}>Home</button>
            <button onClick={() => setActiveSection("live-streams")}>Live</button>
            <button onClick={() => setActiveSection("models")}>Models</button>
            <button onClick={() => setActiveSection("gizzle-tv")}>Gizzle TV</button>
            <button onClick={() => setActiveSection("videos")}>Videos</button>
            <button onClick={() => setActiveSection("pictures")}>Pictures</button>
            <button onClick={() => setActiveSection("community")}>Community</button>
          </nav>

          <div className="desktop-auth">
            {isAuthenticated ? (
              <>
                <span>Hi, {user.username}</span>
                <button onClick={logout}>Logout</button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setViewerAuthMode("login");
                    setShowViewerAuth(true);
                  }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setViewerAuthMode("register");
                    setShowViewerAuth(true);
                  }}
                >
                  Join
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main page content switches based on activeSection */}
      <main className="main-content">
        <CurrentSectionComponent />
      </main>

      {/* Mobile navigation bar & slide-out menu */}
      <MobileNavigation
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        setShowViewerAuth={setShowViewerAuth}
        setViewerAuthMode={setViewerAuthMode}
        setShowModelLogin={setShowModelLogin}
        isAuthenticated={isAuthenticated}
        user={user}
        logout={logout}
      />

      {/* Simple stubs: viewer auth/modal & model login – replace with your components */}
      {showViewerAuth && (
        <div className="modal-backdrop" onClick={() => setShowViewerAuth(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{viewerAuthMode === "login" ? "Sign In" : "Create Viewer Account"}</h2>
            <p>Replace this with your real viewer auth form.</p>
            <button onClick={() => setShowViewerAuth(false)}>Close</button>
          </div>
        </div>
      )}

      {showModelLogin && (
        <div className="modal-backdrop" onClick={() => setShowModelLogin(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Model Portal Login</h2>
            <p>Replace this with your real model login form.</p>
            <button onClick={() => setShowModelLogin(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Very basic styling so you can see it working; move to your CSS files as needed */}
      <style>{`
        .app-root {
          min-height: 100vh;
          background: #050816;
          color: #ffffff;
          padding-top: 56px; /* room for mobile header if reused */
          padding-bottom: 56px; /* room for mobile bottom nav */
        }

        .desktop-header {
          display: none;
        }

        .main-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3000;
        }

        .modal {
          background: #111827;
          padding: 24px;
          border-radius: 12px;
          max-width: 400px;
          width: 90%;
        }

        /* Desktop layout */
        @media (min-width: 769px) {
          .app-root {
            padding-top: 72px;
            padding-bottom: 0;
          }

          .desktop-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1500;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border-bottom: 1px solid rgba(229, 62, 62, 0.2);
          }

          .desktop-header-inner {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
          }

          .desktop-logo {
            font-size: 20px;
            font-weight: 700;
          }

          .desktop-nav {
            display: flex;
            gap: 8px;
          }

          .desktop-nav button {
            background: none;
            border: 1px solid transparent;
            border-radius: 999px;
            padding: 6px 12px;
            color: #e5e7eb;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
          }

          .desktop-nav button:hover {
            border-color: #e53e3e;
            color: #ffffff;
          }

          .desktop-auth {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
          }

          .desktop-auth button {
            background: #e53e3e;
            border: none;
            border-radius: 999px;
            padding: 6px 12px;
            color: #ffffff;
            cursor: pointer;
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
};

export default HomeScreen;