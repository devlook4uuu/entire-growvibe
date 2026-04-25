import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

// Full-screen spinner shown while session is being restored on first load
function LoadingScreen() {
  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: '#F5F7FA',
        fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36,
            height: 36,
            border: '3px solid #E2E8F0',
            borderTopColor: '#1CACF3',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ fontSize: 14, color: '#94A3B8', margin: 0 }}>Loading...</p>
        </div>
      </div>
    </>
  );
}

export default function ProtectedRoute({ children }) {
  const { session, loading } = useSelector((s) => s.auth);

  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;

  return children;
}
