import React, { useState, useEffect } from 'react';
import { db } from './services/mockDatabase';
import { Profile } from './types/database';
import { Header } from './components/layout/Header';
import { RoleSwitcherModal } from './components/common/RoleSwitcherModal';
import { LandingPage } from './components/home/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { StudentPortal } from './components/student/StudentPortal';
import { AssistantPortal } from './components/assistant/AssistantPortal';
import { TeacherPortal } from './components/teacher/TeacherPortal';
import { ParentPortal } from './components/parent/ParentPortal';
import { AdminPortal } from './components/admin/AdminPortal';
import { ArrowLeftRight, LogIn, Home } from 'lucide-react';

export default function App() {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(() => {
    return db.getCurrentProfile();
  });

  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'app'>(() => {
    const savedView = localStorage.getItem('eduflow_view') as 'landing' | 'login' | 'app' | null;
    const active = db.getCurrentProfile();
    if (active) {
      return savedView === 'login' ? 'app' : (savedView || 'app');
    }
    return savedView || 'landing';
  });

  const [loginInitialTab, setLoginInitialTab] = useState<'student' | 'teacher' | 'parent' | 'register'>('student');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [, setTick] = useState(0);

  // Synchronize current view to localStorage for persistence across reloads
  useEffect(() => {
    localStorage.setItem('eduflow_view', currentView);
  }, [currentView]);

  // Subscribe to db state changes
  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      setTick((t) => t + 1);
      // Keep currentProfile synchronized with updated state
      const currentId = db.state.currentUserId || currentProfile?.id;
      if (currentId) {
        const updated = db.getProfileById(currentId);
        if (updated) {
          setCurrentProfile(updated);
        }
      }
    });
    return unsubscribe;
  }, [currentProfile?.id]);

  const handleSelectProfile = (profile: Profile) => {
    db.setCurrentProfile(profile.id);
    setCurrentProfile(profile);
    setCurrentView('app');
    localStorage.setItem('eduflow_view', 'app');
    setIsRoleModalOpen(false);
  };

  const handleLogout = () => {
    db.logout();
    setCurrentProfile(null);
    setCurrentView('landing');
    localStorage.setItem('eduflow_view', 'landing');
  };

  // 1. Landing Welcome Page (Displays first when visiting the site)
  if (currentView === 'landing') {
    return (
      <LandingPage
        onNavigateToLogin={(tab) => {
          setLoginInitialTab(tab || 'student');
          setCurrentView('login');
          localStorage.setItem('eduflow_view', 'login');
        }}
      />
    );
  }

  // 2. Authentication Page (Login for Student, Teacher, Parent or Register)
  if (currentView === 'login' || !currentProfile) {
    return (
      <LoginPage
        initialRoleTab={loginInitialTab}
        onLoginSuccess={(profile) => {
          db.setCurrentProfile(profile.id);
          setCurrentProfile(profile);
          setCurrentView('app');
          localStorage.setItem('eduflow_view', 'app');
        }}
        onBackToHome={() => {
          setCurrentView('landing');
          localStorage.setItem('eduflow_view', 'landing');
        }}
      />
    );
  }

  // 3. Main Authenticated Application Dashboard
  return (
    <div className="min-h-screen app-shell-bg text-slate-900 font-sans flex flex-col" dir="rtl">
      {/* Sticky Top Header */}
      <Header
        currentProfile={currentProfile}
        onOpenRoleModal={() => setIsRoleModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Role-Based Content Area */}
      <main className="flex-1 pb-16 animate-fade-in">
        {currentProfile.role === 'student' && (
          <StudentPortal
            currentStudent={currentProfile}
            onUpdateStudent={(s) => handleSelectProfile(s)}
          />
        )}

        {currentProfile.role === 'assistant' && (
          <AssistantPortal currentAssistant={currentProfile} />
        )}

        {currentProfile.role === 'teacher' && (
          <TeacherPortal currentTeacher={currentProfile} />
        )}

        {currentProfile.role === 'parent' && (
          <ParentPortal currentParent={currentProfile} />
        )}

        {currentProfile.role === 'admin' && (
          <AdminPortal currentAdmin={currentProfile} />
        )}
      </main>

      {/* Floating Navigation & Role Switcher */}
      <div className="fixed bottom-5 left-5 z-40 flex items-center gap-2">
        <button
          onClick={() => {
            setCurrentView('landing');
            localStorage.setItem('eduflow_view', 'landing');
          }}
          className="p-2.5 rounded-full bg-slate-900 text-slate-300 hover:text-white hover:bg-blue-600 transition-all border border-slate-700/50 shadow-xl cursor-pointer"
          title="الصفحة الرئيسية الترحيبية"
        >
          <Home className="w-4 h-4" />
        </button>

        {currentProfile.role === 'admin' && (
          <button
            onClick={() => setIsRoleModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-xl shadow-slate-900/30 hover:bg-teal-600 hover:scale-105 transition-all duration-200 border border-slate-700/50 cursor-pointer"
            title="تبديل الحساب أو الصلاحية (خاص بالإدارة)"
          >
            <ArrowLeftRight className="w-4 h-4 text-teal-400" />
            <span>تبديل الصلاحية (خاص بالإدارة)</span>
          </button>
        )}

        <button
          onClick={handleLogout}
          className="p-2.5 rounded-full bg-slate-900 text-slate-300 hover:text-white hover:bg-rose-600 transition-all border border-slate-700/50 shadow-xl cursor-pointer"
          title="تسجيل الخروج"
        >
          <LogIn className="w-4 h-4" />
        </button>
      </div>

      {/* Role Switcher Modal */}
      {isRoleModalOpen && (
        <RoleSwitcherModal
          currentProfile={currentProfile}
          onSelectProfile={handleSelectProfile}
          onClose={() => setIsRoleModalOpen(false)}
        />
      )}
    </div>
  );
}
