import React, { useState, useEffect } from 'react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  isFirebaseConfigured 
} from './firebase';

export default function App() {
  const [discordId, setDiscordId] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'signing-in' | 'verifying' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
  const [showDirectTest, setShowDirectTest] = useState(false);
  const [serverEndpoint, setServerEndpoint] = useState('http://localhost:8000/internal/verify-success');

  // Parse discord_id from URL query params (e.g. /auth?discord_id=123456789)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idFromQuery = params.get('discord_id');
    if (idFromQuery) {
      setDiscordId(idFromQuery.trim());
    }
  }, []);

  // Handler for sending verification payload to the backend server
  const sendVerificationToServer = async (userData) => {
    if (!discordId) {
      setStatus('error');
      setErrorMessage('Missing Discord User ID. Please open this page via Discord bot verification link or enter your Discord ID below.');
      return;
    }

    setStatus('verifying');
    setErrorMessage('');

    try {
      const payload = {
        discord_id: discordId,
        email: userData.email,
        name: userData.name || userData.displayName || 'SST Student'
      };

      const response = await fetch(serverEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned status ${response.status}`);
      }

      setSuccessData({
        ...data,
        email: userData.email,
        name: payload.name,
      });
      setStatus('success');
    } catch (err) {
      console.error('Verification error:', err);
      setStatus('error');
      setErrorMessage(
        err.message || 'Failed to communicate with the verification server. Ensure the backend server is running.'
      );
    }
  };

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    if (!discordId) {
      setErrorMessage('Please provide a Discord ID before signing in.');
      setStatus('error');
      return;
    }

    if (!isFirebaseConfigured) {
      // Firebase keys not provided in .env yet -> toggle simulated direct sign-in for testing
      setShowDirectTest(true);
      return;
    }

    setStatus('signing-in');
    setErrorMessage('');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Validate SST domain
      const email = user.email || '';
      const isSstDomain = email.endsWith('@sst.scaler.com') || email.endsWith('@sst.edu.in');

      if (!isSstDomain) {
        setStatus('error');
        setErrorMessage(
          `Unauthorized email (${email}). You must sign in using your official college email ending with @sst.scaler.com or @sst.edu.in`
        );
        return;
      }

      await sendVerificationToServer({
        email: user.email,
        name: user.displayName,
      });
    } catch (err) {
      console.error('Google Sign In error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Google Sign-In was cancelled or failed.');
    }
  };

  // Direct Simulated Test for Development
  const handleSimulatedSubmit = async (e) => {
    e.preventDefault();
    if (!testEmail) {
      setErrorMessage('Please enter an email address.');
      setStatus('error');
      return;
    }

    const email = testEmail.trim().toLowerCase();
    const isSstDomain = email.endsWith('@sst.scaler.com') || email.endsWith('@sst.edu.in');
    if (!isSstDomain) {
      setStatus('error');
      setErrorMessage(`Email must end with @sst.scaler.com or @sst.edu.in (Entered: ${email})`);
      return;
    }

    await sendVerificationToServer({
      email: email,
      name: testName.trim() || 'SST Student'
    });
  };

  const resetState = () => {
    setStatus('idle');
    setErrorMessage('');
    setSuccessData(null);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative'
    }}>
      {/* Header Badge */}
      <header style={{
        position: 'absolute',
        top: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #5865f2, #00d4ff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: '18px'
        }}>
          ⚡
        </div>
        <span style={{ 
          fontFamily: 'var(--font-display)', 
          fontWeight: 700, 
          fontSize: '16px',
          letterSpacing: '0.05em',
          color: '#e2e8f0'
        }}>
          REINFORCE SST
        </span>
      </header>

      {/* Main Landing / Auth Card */}
      <main className="glass-panel" style={{
        width: '100%',
        maxWidth: '460px',
        padding: '36px 32px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow corner accent */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(88, 101, 242, 0.4) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        {/* Status: SUCCESS */}
        {status === 'success' && successData ? (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(35, 165, 90, 0.15)',
              border: '1px solid rgba(35, 165, 90, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              color: '#57f287'
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>

            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              Verification Successful!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5, marginBottom: '24px' }}>
              Your SST Google account has been verified. The Discord Bot has granted your member role.
            </p>

            <div style={{
              background: 'rgba(13, 17, 28, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              textAlign: 'left',
              marginBottom: '24px',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{successData.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Discord ID:</span>
                <span style={{ color: '#8fa3ff', fontFamily: 'monospace' }}>{successData.discord_id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Role Granted:</span>
                <span style={{ color: '#57f287', fontWeight: 600 }}>{successData.role_granted || 'Verified Member'}</span>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              You may now return to Discord. Check your Direct Messages for confirmation!
            </p>

            <button 
              onClick={resetState}
              className="btn-secondary"
            >
              Verify Another Account
            </button>
          </div>
        ) : (
          <div>
            {/* Card Header */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '14px'
              }}>
                <span className={`pulse-badge ${discordId ? 'active' : 'warning'}`}>
                  <span className="pulse-dot" />
                  {discordId ? 'Discord Bot Connected' : 'Missing Discord ID'}
                </span>
              </div>

              <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '8px' }}>
                Member <span className="gradient-text">Verification</span>
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
                Sign in with your official SST Google account (<strong style={{ color: '#e2e8f0' }}>@sst.scaler.com</strong>) to unlock club channels and roles.
              </p>
            </div>

            {/* Discord ID Information Box */}
            <div style={{
              background: 'rgba(13, 17, 28, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: '24px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginBottom: '6px'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>
                  Discord Target User ID
                </span>
                {discordId && <span style={{ color: '#57f287', fontWeight: 600 }}>Detected</span>}
              </div>

              {discordId ? (
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '14px', 
                  color: '#8fa3ff', 
                  fontWeight: 600,
                  letterSpacing: '0.05em'
                }}>
                  {discordId}
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Enter Discord ID (e.g. 1549547403819090011)"
                    value={discordId}
                    onChange={(e) => setDiscordId(e.target.value.trim())}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                  <div style={{ fontSize: '11px', color: '#ff7b72', marginTop: '4px' }}>
                    Tip: Use <code>/auth</code> in Discord to auto-fill this link.
                  </div>
                </div>
              )}
            </div>

            {/* Error Message Box */}
            {status === 'error' && errorMessage && (
              <div className="animate-fade-in" style={{
                background: 'rgba(242, 63, 67, 0.12)',
                border: '1px solid rgba(242, 63, 67, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff7b72" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <div style={{ fontSize: '13px', color: '#ff7b72', lineHeight: 1.4 }}>
                  {errorMessage}
                </div>
              </div>
            )}

            {/* Action Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Primary Google Sign In Button */}
              <button
                onClick={handleGoogleSignIn}
                disabled={status === 'signing-in' || status === 'verifying'}
                className="btn-google"
                id="google-signin-btn"
              >
                {status === 'signing-in' || status === 'verifying' ? (
                  <>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      border: '2px solid rgba(0,0,0,0.2)',
                      borderTopColor: '#1e293b',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    <span>{status === 'signing-in' ? 'Connecting to Google...' : 'Verifying with Discord Bot...'}</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>

              {/* Development Quick Test Accordion */}
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowDirectTest(!showDirectTest)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    gap: '6px',
                    padding: '6px'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>
                  <span>{showDirectTest ? 'Hide Developer Test Panel' : 'Test Mode / Direct Bot Test'}</span>
                </button>

                {showDirectTest && (
                  <form 
                    onSubmit={handleSimulatedSubmit}
                    className="animate-fade-in"
                    style={{
                      background: 'rgba(13, 17, 28, 0.9)',
                      border: '1px solid rgba(88, 101, 242, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      marginTop: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#8fa3ff' }}>
                      🧪 Bot Verification Testing Tool
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        College Email:
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="student@sst.scaler.com"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Full Name (Optional):
                      </label>
                      <input
                        type="text"
                        placeholder="Arya Sharma"
                        value={testName}
                        onChange={(e) => setTestName(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Backend Endpoint:
                      </label>
                      <input
                        type="text"
                        value={serverEndpoint}
                        onChange={(e) => setServerEndpoint(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: '#94a3b8',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={status === 'verifying'}
                      className="btn-secondary"
                      style={{ marginTop: '4px' }}
                    >
                      {status === 'verifying' ? 'Dispatching...' : 'Dispatch Verification POST Request'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Footer Information */}
            <div style={{
              marginTop: '28px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-muted)'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#57f287" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Official Reinforce Club SST Bot Authentication</span>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
