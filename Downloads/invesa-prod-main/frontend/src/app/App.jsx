import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthData } from '@neondatabase/neon-js/auth/react';

import Navbar from '../shared/components/layout/Navbar';
import Home from '../features/ideas/pages/Home';
import Login from '../features/auth/pages/Login';
import Register from '../features/auth/pages/Register';
import ForgotPassword from '../features/auth/pages/ForgotPassword';
import ResetPassword from '../features/auth/pages/ResetPassword';
import PostIdea from '../features/ideas/pages/PostIdea';
import Profile from '../features/profile/pages/Profile';
import Chat from '../features/chat/pages/Chat';
import Footer from '../shared/components/layout/Footer';
import ErrorBoundary from '../shared/components/layout/ErrorBoundary';
import api from '../shared/services/api';

// GuestRoute: redirects authenticated users away from auth pages
const GuestRoute = ({ children, isAuthed }) => {
  return isAuthed ? <Navigate to="/" replace /> : children;
};

// ProtectedRoute: redirects unauthenticated users to login
const ProtectedRoute = ({ children, isAuthed }) => {
  return isAuthed ? children : <Navigate to="/login" replace />;
};

const App = () => {
  const { user, isPending } = useAuthData();
  const isAuthed = Boolean(user);
  // Safety net: if auth is still pending after 5s (e.g. DNS failure), stop waiting
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, []);

  // Provision local user row in our DB after Neon Auth login
  useEffect(() => {
    if (!user) return;
    api.post('/auth/provision', {
      id: user.id,
      username: user.username || user.name || user.email?.split('@')[0] || 'user',
      email: user.email,
      role: user.role || 'Entrepreneur',
      bio: user.bio || '',
    }).catch(() => {/* Non-critical: provision may already exist */ });
  }, [user]);

  if (isPending && !timedOut) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <span className="h-6 w-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground pt-16">
        <Navbar user={user} />
        <main>
          <Routes>
            <Route
              path="/"
              element={isAuthed ? <Home /> : <Login />}
            />
            <Route path="/login" element={<GuestRoute isAuthed={isAuthed}><Login /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute isAuthed={isAuthed}><Register /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute isAuthed={isAuthed}><ForgotPassword /></GuestRoute>} />
            <Route path="/reset-password" element={<GuestRoute isAuthed={isAuthed}><ResetPassword /></GuestRoute>} />

            <Route path="/post" element={<PostIdea />} />
            <Route path="/profile" element={
              <ProtectedRoute isAuthed={isAuthed}>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/chat" element={
              <ProtectedRoute isAuthed={isAuthed}>
                <Chat />
              </ProtectedRoute>
            } />
          </Routes>
        </main>
        <Footer />
      </div>
    </ErrorBoundary>
  );
};

const AppWrapper = () => (
  <Router>
    <App />
  </Router>
);

export default AppWrapper;
