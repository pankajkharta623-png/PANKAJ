/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate,
  Link,
  useParams
} from 'react-router-dom';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  FacebookAuthProvider,
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  LogOut, 
  Plus, 
  FileText, 
  Video, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  AlertCircle,
  ChevronRight,
  Download,
  Play,
  Calendar,
  Award,
  Loader2,
  Menu,
  X,
  Lock,
  User as UserIcon,
  GraduationCap,
  Eye,
  EyeOff,
  Phone,
  Facebook,
  Mail,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  UserPlus,
  Shield,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

import { GoogleGenAI } from "@google/genai";

import { auth, db } from './firebase';
import { cn } from './lib/utils';
import { User, Course, Enrollment, Attendance, Test, TestScore, Material, UserRole } from './types';

// --- AI Service ---

async function getPerformanceInsight(studentData: any) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const prompt = `
      Analyze this student's academic performance and provide a concise summary and 3 actionable recommendations.
      Data: ${JSON.stringify(studentData)}
      
      Requirements:
      - Be encouraging but realistic.
      - Use simple, non-technical language.
      - Return the response as a JSON object with "summary" (string) and "recommendations" (array of strings).
    `;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });
    
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("AI Insight Error:", error);
    return { summary: "Performance analysis currently unavailable.", recommendations: [] };
  }
}

const ProfileSettings = ({ user }: { user: User }) => {
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) return alert("Passwords don't match");
    setLoading(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPass);
        alert('Password updated successfully!');
        setNewPass('');
        setConfirmPass('');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="glass-card p-8 rounded-3xl">
        <h2 className="text-2xl font-black mb-6">Profile Settings</h2>
        <div className="space-y-4 mb-8">
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Name</label>
            <p className="font-bold text-zinc-900">{user.name}</p>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Identifier</label>
            <p className="font-bold text-zinc-900">{user.studentId || user.email}</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 pt-6 border-t border-zinc-100">
          <h3 className="font-bold text-zinc-900">Change Password</h3>
          <input 
            type="password" 
            placeholder="New Password" 
            className="input-field" 
            required 
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="Confirm New Password" 
            className="input-field" 
            required 
            value={confirmPass}
            onChange={e => setConfirmPass(e.target.value)}
          />
          <button type="submit" disabled={loading} className="w-full btn-primary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

const LoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-zinc-50 z-50">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-zinc-900" />
      <p className="text-zinc-500 font-medium">Loading System...</p>
    </div>
  </div>
);

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setErrorInfo(event.error?.message || "An unexpected error occurred.");
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-zinc-200">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="w-8 h-8" />
            <h2 className="text-xl font-bold">System Error</h2>
          </div>
          <p className="text-zinc-600 mb-6">{errorInfo}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full btn-primary"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// --- Layout ---

const Sidebar = ({ role, user }: { role: UserRole, user: User }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = {
    admin: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
      { icon: Users, label: 'Manage Users', path: '/admin/users' },
      { icon: BookOpen, label: 'Courses', path: '/admin/courses' },
    ],
    teacher: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/teacher' },
      { icon: BookOpen, label: 'My Courses', path: '/teacher/courses' },
    ],
    student: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/student' },
      { icon: BookOpen, label: 'My Courses', path: '/student/courses' },
    ],
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-white rounded-xl shadow-sm border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-white border-r border-zinc-100 z-40 transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-8">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg shadow-zinc-200">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-black tracking-tighter text-zinc-900">EduFlow</h1>
            </div>
            <p className="micro-label ml-1">{role} Portal</p>
          </div>

          <nav className="flex-1 space-y-1.5">
            {navItems[role].map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all group",
                  location.pathname === item.path 
                    ? "bg-zinc-900 text-white shadow-md shadow-zinc-200" 
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-colors",
                  location.pathname === item.path ? "text-white" : "text-zinc-400 group-hover:text-zinc-900"
                )} />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="pt-8 border-t border-zinc-50">
            <div className="flex items-center gap-3 mb-8 px-2">
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center font-black text-zinc-900 text-sm border border-zinc-200">
                {user.name[0]}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-zinc-900 truncate">{user.name}</p>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate">{user.role}</p>
              </div>
            </div>
            <div className="space-y-1">
              <Link 
                to="/profile" 
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-3 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 rounded-xl transition-all font-semibold text-sm"
              >
                <UserIcon className="w-5 h-5" />
                Profile Settings
              </Link>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all font-semibold text-sm"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

// --- Pages ---

// --- Pages ---

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FBFBFB] overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg shadow-zinc-200">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black tracking-tighter text-zinc-900">EduFlow</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#features" className="text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors">Features</a>
            <a href="#about" className="text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors">About</a>
            <button 
              onClick={() => navigate('/login')}
              className="btn-primary px-8 py-3 rounded-xl text-sm"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="px-4 py-1.5 rounded-full bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-zinc-200 mb-8 inline-block">
              Next-Gen Academic Management
            </span>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-zinc-900 mb-8 leading-[0.9]">
              Empowering <br />
              <span className="text-zinc-400">Education</span> with AI.
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-zinc-500 font-medium mb-12 leading-relaxed">
              EduFlow is a professional academic ecosystem designed to streamline management, 
              enhance teaching, and personalize student learning through intelligent insights.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto btn-primary px-10 py-5 rounded-2xl text-base flex items-center justify-center gap-3 group"
              >
                Get Started Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="w-full sm:w-auto px-10 py-5 rounded-2xl text-base font-bold text-zinc-900 border-2 border-zinc-100 hover:bg-zinc-50 transition-all">
                Watch Demo
              </button>
            </div>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-24 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#FBFBFB] via-transparent to-transparent z-10"></div>
            <div className="glass-card rounded-[3rem] p-4 shadow-2xl shadow-zinc-200 overflow-hidden border-8 border-white">
              <img 
                src="https://picsum.photos/seed/dashboard/1600/900" 
                alt="EduFlow Dashboard" 
                className="w-full h-auto rounded-[2rem] opacity-80"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-4xl font-black tracking-tighter text-zinc-900 mb-4">Built for Every Role</h2>
            <p className="text-zinc-400 font-medium">A unified platform for administrators, teachers, and students.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                title: "Administrators",
                desc: "Full control over users, courses, and system-wide analytics. Manage the entire institution from a single pane of glass.",
                icon: Shield,
                features: ["User Management", "Course Creation", "System Analytics"]
              },
              {
                title: "Teachers",
                desc: "Streamline attendance, manage course materials, and grade tests with ease. Focus more on teaching, less on paperwork.",
                icon: BookOpen,
                features: ["Attendance Tracking", "Resource Sharing", "Automated Grading"]
              },
              {
                title: "Students",
                desc: "Access learning materials, track performance, and receive AI-driven insights to excel in your academic journey.",
                icon: GraduationCap,
                features: ["Learning Resources", "Performance Tracking", "AI Insights"]
              }
            ].map((role, i) => (
              <div key={i} className="group">
                <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-zinc-900 group-hover:text-white transition-all duration-500">
                  <role.icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-zinc-900 mb-4">{role.title}</h3>
                <p className="text-zinc-500 font-medium mb-8 leading-relaxed">{role.desc}</p>
                <ul className="space-y-3">
                  {role.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm font-bold text-zinc-900">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-900"></div>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Section */}
      <section id="about" className="py-32 px-6">
        <div className="max-w-7xl mx-auto glass-card p-12 md:p-24 rounded-[4rem] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-zinc-100 rounded-full -mr-48 -mt-48 opacity-50"></div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center mb-8 shadow-lg shadow-zinc-200">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-900 mb-8 leading-tight">
                Intelligent Insights <br />
                <span className="text-zinc-400">Powered by Gemini.</span>
              </h2>
              <p className="text-lg text-zinc-500 font-medium mb-12 leading-relaxed">
                Our AI engine analyzes student performance data in real-time to provide personalized recommendations, 
                helping students identify strengths and overcome challenges faster than ever.
              </p>
              <div className="flex items-center gap-6">
                <div className="flex -space-x-4">
                  {[1,2,3,4].map(i => (
                    <img key={i} src={`https://i.pravatar.cc/100?u=${i}`} className="w-12 h-12 rounded-full border-4 border-white shadow-sm" alt="User" referrerPolicy="no-referrer" />
                  ))}
                </div>
                <p className="text-sm font-bold text-zinc-900">Trusted by 2,000+ students</p>
              </div>
            </div>
            <div className="bg-zinc-900 rounded-[3rem] p-8 shadow-2xl shadow-zinc-300">
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-white/10 rounded-2xl border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                  <p className="text-xs font-bold text-white/80 uppercase tracking-widest">AI Analysis in Progress</p>
                </div>
                <div className="space-y-4">
                  <div className="h-4 bg-white/20 rounded-full w-3/4"></div>
                  <div className="h-4 bg-white/20 rounded-full w-1/2"></div>
                  <div className="h-32 bg-white/5 rounded-3xl border border-white/10 p-6">
                    <p className="text-sm text-white/60 italic font-medium">"Student shows high aptitude in Mathematics but requires additional focus on Calculus fundamentals..."</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-zinc-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black tracking-tighter text-zinc-900">EduFlow</span>
          </div>
          <div className="flex items-center gap-12">
            <a href="#" className="text-sm font-bold text-zinc-400 hover:text-zinc-900 transition-colors">Twitter</a>
            <a href="#" className="text-sm font-bold text-zinc-400 hover:text-zinc-900 transition-colors">LinkedIn</a>
            <a href="#" className="text-sm font-bold text-zinc-400 hover:text-zinc-900 transition-colors">GitHub</a>
          </div>
          <p className="text-sm font-bold text-zinc-400">© 2026 EduFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

const Login = ({ setUser }: { setUser: (u: User | null) => void }) => {
  const navigate = useNavigate();
  const [isStudent, setIsStudent] = useState(false);
  const [identifier, setIdentifier] = useState(''); // Email or Student ID
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSocialLogin = async (providerType: 'google') => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await handleUserRedirect(result.user);
    } catch (err: any) {
      setError(`Failed to sign in with ${providerType}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleUserRedirect = async (user: FirebaseUser) => {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data() as User;
      setUser(userData);
      navigate(`/${userData.role}`);
    } else {
      const role: UserRole = user.email === 'pankajkharta623@gmail.com' ? 'admin' : 'student';
      const newUser: User = {
        uid: user.uid,
        name: user.displayName || 'New User',
        email: user.email || '',
        role,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', user.uid), newUser);
      setUser(newUser);
      navigate(`/${role}`);
    }
  };

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let email = identifier;
      if (isStudent) {
        email = `${identifier.toLowerCase()}@student.app`;
      }
      const result = await signInWithEmailAndPassword(auth, email, password);
      await handleUserRedirect(result.user);
    } catch (err: any) {
      setError('Invalid credentials. Check your ID/Email and Password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FBFBFB]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[440px] w-full"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-zinc-200">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-zinc-900 mb-2">EduFlow</h1>
          <p className="text-zinc-400 font-medium text-sm">Professional Academic Management</p>
        </div>

        <div className="glass-card p-10 rounded-[2.5rem]">
          <form onSubmit={handleCredentialLogin} className="space-y-6">
            <div className="flex p-1 bg-zinc-50 rounded-xl mb-8">
              <button 
                type="button"
                onClick={() => setIsStudent(false)}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  !isStudent ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                Admin/Teacher
              </button>
              <button 
                type="button"
                onClick={() => setIsStudent(true)}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  isStudent ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                Student
              </button>
            </div>

            <div className="space-y-5">
              <div className="group">
                <label className="micro-label mb-2 block ml-1">
                  {isStudent ? 'Student ID' : 'Email Address'}
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
                  <input 
                    type={isStudent ? "text" : "email"}
                    required
                    placeholder={isStudent ? "Enter ID" : "name@example.com"}
                    className="input-field pl-12"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
              </div>

              <div className="group">
                <label className="micro-label mb-2 block ml-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
                  <input 
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    className="input-field pl-12 pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-900 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-zinc-900 text-white py-4 rounded-xl text-sm font-black shadow-lg shadow-zinc-200 flex items-center justify-center gap-3 hover:bg-zinc-800 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  Login to Portal
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl text-xs flex items-center gap-3 font-bold border border-red-100"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="mt-10">
            <div className="relative flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-zinc-100"></div>
              <span className="text-[9px] font-black text-zinc-300 uppercase tracking-[0.2em]">Or Continue With</span>
              <div className="flex-1 h-px bg-zinc-100"></div>
            </div>

            <button 
              onClick={() => handleSocialLogin('google')}
              className="w-full flex items-center justify-center gap-3 py-3.5 bg-white border border-zinc-200 rounded-xl font-bold text-sm text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              Continue with Google
            </button>
          </div>

          <p className="text-center text-[10px] text-zinc-400 mt-10 leading-relaxed font-medium">
            By accessing the portal, you agree to our <br />
            <span className="text-zinc-900 font-bold cursor-pointer hover:underline">Terms of Service</span> & <span className="text-zinc-900 font-bold cursor-pointer hover:underline">Privacy Policy</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// --- Admin Dashboard ---

const AdminDashboard = () => {
  const [stats, setStats] = useState({ teachers: 0, students: 0, courses: 0 });

  useEffect(() => {
    const fetchData = async () => {
      const usersSnap = await getDocs(collection(db, 'users'));
      const coursesSnap = await getDocs(collection(db, 'courses'));
      
      const users = usersSnap.docs.map(d => d.data() as User);
      setStats({
        teachers: users.filter(u => u.role === 'teacher').length,
        students: users.filter(u => u.role === 'student').length,
        courses: coursesSnap.size
      });
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-3xl font-black tracking-tighter text-zinc-900 mb-1">Admin Overview</h2>
        <p className="text-zinc-400 font-medium">System-wide performance and management</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Teachers', value: stats.teachers, icon: Users, color: 'bg-zinc-900' },
          { label: 'Total Students', value: stats.students, icon: Users, color: 'bg-zinc-900' },
          { label: 'Active Courses', value: stats.courses, icon: BookOpen, color: 'bg-zinc-900' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card glass-card-hover p-8 rounded-3xl flex items-center gap-6">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-zinc-100", stat.color)}>
              <stat.icon className="w-7 h-7" />
            </div>
            <div>
              <p className="micro-label mb-1">{stat.label}</p>
              <p className="text-3xl font-black text-zinc-900 data-value">{stat.value.toString().padStart(2, '0')}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8 rounded-[2.5rem]">
          <h3 className="text-lg font-black tracking-tight mb-8 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-zinc-400" />
            Recent Activity
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-center py-12 bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200">
              <p className="text-zinc-400 text-sm font-medium italic">No recent activity to display.</p>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-8 rounded-[2.5rem]">
          <h3 className="text-lg font-black tracking-tight mb-8 flex items-center gap-3">
            <Award className="w-5 h-5 text-zinc-400" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Link to="/admin/users" className="p-6 bg-zinc-50/50 border border-zinc-100 rounded-2xl hover:bg-zinc-100 hover:border-zinc-200 transition-all text-center group">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-zinc-900" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-zinc-900">Manage Users</span>
            </Link>
            <Link to="/admin/courses" className="p-6 bg-zinc-50/50 border border-zinc-100 rounded-2xl hover:bg-zinc-100 hover:border-zinc-200 transition-all text-center group">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6 text-zinc-900" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-zinc-900">Manage Courses</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Teacher Dashboard ---

const TeacherDashboard = ({ user }: { user: User }) => {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'courses'), where('teacherId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
    });
    return unsub;
  }, [user.uid]);

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-3xl font-black tracking-tighter text-zinc-900 mb-1">Teacher Portal</h2>
        <p className="text-zinc-400 font-medium">Manage your assigned courses and students</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <motion.div 
            key={course.id}
            whileHover={{ y: -5 }}
            className="glass-card glass-card-hover p-8 rounded-[2.5rem] group"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center font-black text-zinc-900 text-xs border border-zinc-100 shadow-sm">
                {course.code}
              </div>
              <span className="micro-label bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-100">
                {course.credits} Credits
              </span>
            </div>
            <h3 className="text-xl font-black text-zinc-900 mb-1 tracking-tight">{course.name}</h3>
            <p className="text-sm text-zinc-400 font-medium mb-8">{course.semester}</p>
            
            <div className="space-y-2">
              {[
                { label: 'Attendance', path: `/teacher/courses/${course.id}/attendance` },
                { label: 'Materials', path: `/teacher/courses/${course.id}/materials` },
                { label: 'Tests & Grading', path: `/teacher/courses/${course.id}/tests` },
              ].map((link) => (
                <Link 
                  key={link.label}
                  to={link.path}
                  className="w-full flex items-center justify-between p-4 bg-zinc-50/50 border border-zinc-100/50 rounded-2xl hover:bg-zinc-900 hover:text-white transition-all group/link"
                >
                  <span className="text-xs font-black uppercase tracking-widest">{link.label}</span>
                  <ChevronRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              ))}
            </div>
          </motion.div>
        ))}
        
        {courses.length === 0 && (
          <div className="col-span-full py-24 text-center glass-card rounded-[3rem] border-dashed border-2">
            <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-8 h-8 text-zinc-200" />
            </div>
            <p className="text-zinc-400 font-bold tracking-tight">No courses assigned yet.</p>
            <p className="text-zinc-300 text-sm">Contact admin to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Student Dashboard ---

const StudentDashboard = ({ user }: { user: User }) => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [aiInsight, setAiInsight] = useState<{ summary: string, recommendations: string[] } | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'enrollments'), where('studentId', '==', user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const ens = snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment));
      setEnrollments(ens);
      
      if (ens.length > 0) {
        const courseIds = ens.map(e => e.courseId);
        const coursesSnap = await getDocs(collection(db, 'courses'));
        setCourses(coursesSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Course))
          .filter(c => courseIds.includes(c.id))
        );
      }
    });
    return unsub;
  }, [user.uid]);

  const generateInsight = async () => {
    setLoadingInsight(true);
    const attendanceSnap = await getDocs(query(collection(db, 'attendance'), where('studentId', '==', user.uid)));
    const scoresSnap = await getDocs(query(collection(db, 'test_scores'), where('studentId', '==', user.uid)));
    
    const data = {
      attendance: attendanceSnap.docs.map(d => d.data()),
      scores: scoresSnap.docs.map(d => d.data())
    };
    
    const insight = await getPerformanceInsight(data);
    setAiInsight(insight);
    setLoadingInsight(false);
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-zinc-900 mb-1">Student Dashboard</h2>
          <p className="text-zinc-400 font-medium">Welcome back, {user.name.split(' ')[0]}!</p>
        </div>
        <button 
          onClick={generateInsight}
          disabled={loadingInsight}
          className="btn-primary flex items-center gap-3"
        >
          {loadingInsight ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
          AI Performance Analysis
        </button>
      </header>

      <AnimatePresence>
        {aiInsight && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-10 bg-zinc-900 text-white rounded-[2.5rem] shadow-2xl shadow-zinc-200 relative overflow-hidden"
          >
            <div className="absolute -top-12 -right-12 p-8 opacity-5">
              <GraduationCap className="w-64 h-64" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-black tracking-tight">AI Performance Insights</h3>
              </div>
              <p className="text-zinc-300 mb-10 max-w-2xl leading-relaxed font-medium">
                {aiInsight.summary}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {aiInsight.recommendations.map((rec, i) => (
                  <div key={i} className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10 group hover:bg-white/10 transition-colors">
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Recommendation {i + 1}</p>
                    <p className="text-sm font-bold leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <Link 
            key={course.id}
            to={`/student/courses/${course.id}`}
            className="glass-card glass-card-hover p-8 rounded-[2.5rem] group"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center font-black text-zinc-900 text-xs border border-zinc-100 shadow-sm">
                {course.code}
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-300 group-hover:text-zinc-900 group-hover:bg-zinc-50 transition-all">
                <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            <h3 className="text-xl font-black text-zinc-900 mb-1 tracking-tight">{course.name}</h3>
            <p className="text-sm text-zinc-400 font-medium">{course.semester}</p>
          </Link>
        ))}
        
        {courses.length === 0 && (
          <div className="col-span-full py-24 text-center glass-card rounded-[3rem] border-dashed border-2">
            <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-8 h-8 text-zinc-200" />
            </div>
            <p className="text-zinc-400 font-bold tracking-tight">No courses enrolled yet.</p>
            <p className="text-zinc-300 text-sm">Browse the catalog to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Admin Modules ---

const AdminUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'student' as UserRole, studentId: '', password: '' });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => d.data() as User));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const email = newUser.role === 'student' ? `${newUser.studentId.toLowerCase()}@student.app` : newUser.email;
      const userCred = await createUserWithEmailAndPassword(auth, email, newUser.password);
      const uid = userCred.user.uid;

      const userData: User = {
        uid,
        name: newUser.name,
        email: email,
        role: newUser.role,
        createdAt: new Date().toISOString(),
        ...(newUser.role === 'student' && { studentId: newUser.studentId })
      };

      await setDoc(doc(db, 'users', uid), userData);
      setShowAdd(false);
      setNewUser({ name: '', email: '', role: 'student', studentId: '', password: '' });
      alert('User created successfully!');
    } catch (err: any) {
      console.error(err);
      alert('Error creating user: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (uid: string, currentRole: UserRole) => {
    const nextRole: UserRole = currentRole === 'teacher' ? 'student' : 'teacher';
    await updateDoc(doc(db, 'users', uid), { role: nextRole });
  };

  return (
    <div className="space-y-10">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-zinc-900 mb-1">User Management</h2>
          <p className="text-zinc-400 font-medium">Manage system access and roles</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-3">
          <Plus className="w-5 h-5" /> Add User
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {users.map((u) => (
          <div key={u.uid} className="glass-card p-6 rounded-[2rem] flex items-center justify-between group hover:bg-zinc-50 transition-all">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 font-black text-xl border border-zinc-200">
                {u.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-black text-zinc-900 tracking-tight">{u.name}</h3>
                <p className="text-sm text-zinc-400 font-medium">{u.studentId || u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`micro-label px-4 py-2 rounded-full border ${
                u.role === 'admin' ? 'bg-zinc-900 text-white border-zinc-900' :
                u.role === 'teacher' ? 'bg-zinc-100 text-zinc-900 border-zinc-200' :
                'bg-white text-zinc-500 border-zinc-100'
              }`}>
                {u.role}
              </span>
              {u.role !== 'admin' && (
                <button 
                  onClick={() => toggleRole(u.uid, u.role)}
                  className="p-3 hover:bg-zinc-200 rounded-xl text-zinc-400 hover:text-zinc-900 transition-all"
                  title="Toggle Role"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-10 rounded-[3rem] w-full max-w-md shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)]"
            >
              <h3 className="text-2xl font-black tracking-tighter mb-8">Create New User</h3>
              <form onSubmit={handleAddUser} className="space-y-5">
                <div className="space-y-2">
                  <label className="micro-label ml-1">Account Role</label>
                  <select 
                    className="input-field" 
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="micro-label ml-1">Full Name</label>
                  <input 
                    placeholder="e.g. John Doe" 
                    className="input-field" 
                    required 
                    value={newUser.name}
                    onChange={e => setNewUser({...newUser, name: e.target.value})}
                  />
                </div>

                {newUser.role === 'student' ? (
                  <div className="space-y-2">
                    <label className="micro-label ml-1">Student ID</label>
                    <input 
                      placeholder="e.g. STU001" 
                      className="input-field" 
                      required 
                      value={newUser.studentId}
                      onChange={e => setNewUser({...newUser, studentId: e.target.value})}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="micro-label ml-1">Email Address</label>
                    <input 
                      type="email"
                      placeholder="e.g. teacher@school.com" 
                      className="input-field" 
                      required 
                      value={newUser.email}
                      onChange={e => setNewUser({...newUser, email: e.target.value})}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="micro-label ml-1">Password</label>
                  <input 
                    type="password"
                    placeholder="Min. 6 characters" 
                    className="input-field" 
                    required 
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowAdd(false)}
                    className="flex-1 p-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-zinc-200 hover:bg-zinc-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 btn-primary"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create User'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminCourses = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showEnroll, setShowEnroll] = useState<string | null>(null);
  const [newCourse, setNewCourse] = useState({ code: '', name: '', credits: 3, semester: 'Fall 2026', teacherId: '' });
  const [selectedStudent, setSelectedStudent] = useState('');

  useEffect(() => {
    onSnapshot(collection(db, 'courses'), (snap) => {
      setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
    });
    onSnapshot(query(collection(db, 'users'), where('role', '==', 'teacher')), (snap) => {
      setTeachers(snap.docs.map(d => d.data() as User));
    });
    onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), (snap) => {
      setStudents(snap.docs.map(d => d.data() as User));
    });
  }, []);

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = Math.random().toString(36).substr(2, 9);
    await setDoc(doc(db, 'courses', id), { ...newCourse, id });
    setShowAdd(false);
    setNewCourse({ code: '', name: '', credits: 3, semester: 'Fall 2026', teacherId: '' });
  };

  const handleEnroll = async () => {
    if (!selectedStudent || !showEnroll) return;
    const id = `${selectedStudent}_${showEnroll}`;
    await setDoc(doc(db, 'enrollments', id), {
      studentId: selectedStudent,
      courseId: showEnroll,
      enrollmentDate: new Date().toISOString()
    });
    setShowEnroll(null);
    setSelectedStudent('');
  };

  return (
    <div className="space-y-10">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-zinc-900 mb-1">Course Management</h2>
          <p className="text-zinc-400 font-medium">Create and assign academic courses</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-3">
          <Plus className="w-5 h-5" /> Create Course
        </button>
      </header>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-10 rounded-[3rem] w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-black tracking-tighter mb-8">Create New Course</h3>
              <form onSubmit={handleAddCourse} className="space-y-5">
                <div className="space-y-2">
                  <label className="micro-label ml-1">Course Code</label>
                  <input placeholder="e.g. CS101" className="input-field" required value={newCourse.code} onChange={e => setNewCourse({...newCourse, code: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="micro-label ml-1">Course Name</label>
                  <input placeholder="e.g. Introduction to Programming" className="input-field" required value={newCourse.name} onChange={e => setNewCourse({...newCourse, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="micro-label ml-1">Credits</label>
                    <input type="number" className="input-field" required value={newCourse.credits} onChange={e => setNewCourse({...newCourse, credits: parseInt(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="micro-label ml-1">Semester</label>
                    <input placeholder="e.g. Fall 2026" className="input-field" required value={newCourse.semester} onChange={e => setNewCourse({...newCourse, semester: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="micro-label ml-1">Instructor</label>
                  <select className="input-field" required value={newCourse.teacherId} onChange={e => setNewCourse({...newCourse, teacherId: e.target.value})}>
                    <option value="">Select Teacher</option>
                    {teachers.map(t => <option key={t.uid} value={t.uid}>{t.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 p-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-zinc-200 hover:bg-zinc-50 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 btn-primary">Create Course</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showEnroll && (
          <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-10 rounded-[3rem] w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-black tracking-tighter mb-2">Enroll Student</h3>
              <p className="text-zinc-400 font-medium mb-8">Select a student to add to the course</p>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="micro-label ml-1">Student</label>
                  <select className="input-field" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
                    <option value="">Select Student</option>
                    {students.map(s => <option key={s.uid} value={s.uid}>{s.name} ({s.email})</option>)}
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowEnroll(null)} className="flex-1 p-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-zinc-200 hover:bg-zinc-50 transition-all">Cancel</button>
                  <button onClick={handleEnroll} className="flex-1 btn-primary">Enroll Now</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map(course => (
          <div key={course.id} className="glass-card glass-card-hover p-8 rounded-[2.5rem] group">
            <div className="flex justify-between items-start mb-8">
              <div className="w-12 h-12 bg-zinc-900 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-lg shadow-zinc-200">
                {course.code}
              </div>
              <button 
                onClick={async () => await deleteDoc(doc(db, 'courses', course.id))} 
                className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <h3 className="text-xl font-black text-zinc-900 mb-1 tracking-tight">{course.name}</h3>
            <p className="text-sm text-zinc-400 font-medium mb-8">{course.semester}</p>
            
            <div className="flex items-center justify-between pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-black border border-zinc-200">
                  {teachers.find(t => t.uid === course.teacherId)?.name.charAt(0) || '?'}
                </div>
                <div className="flex flex-col">
                  <span className="micro-label text-zinc-400">Instructor</span>
                  <span className="text-xs font-bold text-zinc-900">
                    {teachers.find(t => t.uid === course.teacherId)?.name || 'Unassigned'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowEnroll(course.id)}
                className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all"
                title="Enroll Student"
              >
                <UserPlus className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Teacher Modules ---

const TeacherAttendance = () => {
  const { id: courseId } = useParams();
  const [students, setStudents] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const fetchStudents = async () => {
      const ensSnap = await getDocs(query(collection(db, 'enrollments'), where('courseId', '==', courseId)));
      const studentIds = ensSnap.docs.map(d => d.data().studentId);
      if (studentIds.length > 0) {
        const usersSnap = await getDocs(collection(db, 'users'));
        setStudents(usersSnap.docs
          .map(d => d.data() as User)
          .filter(u => studentIds.includes(u.uid))
        );
      }
    };
    fetchStudents();
  }, [courseId]);

  const markAttendance = async (studentId: string, status: 'present' | 'absent') => {
    const id = `${studentId}_${courseId}_${date}`;
    await setDoc(doc(db, 'attendance', id), {
      studentId,
      courseId,
      date,
      status,
      teacherId: auth.currentUser?.uid
    });
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  return (
    <div className="space-y-10">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-zinc-900 mb-1">Attendance Tracking</h2>
          <div className="flex items-center gap-2 text-zinc-400 font-medium">
            <Calendar className="w-4 h-4" />
            <input 
              type="date" 
              className="bg-transparent border-none focus:ring-0 p-0 text-sm font-bold text-zinc-900 cursor-pointer" 
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="glass-card rounded-[2.5rem] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/50 border-b border-zinc-100">
              <th className="px-8 py-5">
                <span className="micro-label">Student Name</span>
              </th>
              <th className="px-8 py-5 text-right">
                <span className="micro-label">Attendance Status</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {students.map(s => (
              <tr key={s.uid} className="hover:bg-zinc-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-black border border-zinc-200 group-hover:bg-white transition-colors">
                      {s.name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-900">{s.name}</span>
                      <span className="text-xs text-zinc-400 font-medium">{s.email}</span>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end gap-3">
                    <button 
                      onClick={() => markAttendance(s.uid, 'present')}
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm",
                        attendance[s.uid] === 'present' 
                          ? "bg-green-500 text-white shadow-green-200 scale-110" 
                          : "bg-zinc-50 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-500"
                      )}
                      title="Present"
                    >
                      <CheckCircle className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={() => markAttendance(s.uid, 'absent')}
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm",
                        attendance[s.uid] === 'absent' 
                          ? "bg-red-500 text-white shadow-red-200 scale-110" 
                          : "bg-zinc-50 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-500"
                      )}
                      title="Absent"
                    >
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={2} className="px-8 py-12 text-center">
                  <p className="text-zinc-400 font-medium italic">No students enrolled in this course.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TeacherMaterials = () => {
  const { id: courseId } = useParams();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ title: '', description: '', fileUrl: '', type: 'pdf' as 'pdf' | 'video' });

  useEffect(() => {
    const q = query(collection(db, 'materials'), where('courseId', '==', courseId));
    const unsub = onSnapshot(q, (snap) => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
    });
    return unsub;
  }, [courseId]);

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = Math.random().toString(36).substr(2, 9);
    await setDoc(doc(db, 'materials', id), {
      ...newMaterial,
      id,
      courseId,
      uploadedBy: auth.currentUser?.uid,
      uploadedAt: new Date().toISOString()
    });
    setShowAdd(false);
    setNewMaterial({ title: '', description: '', fileUrl: '', type: 'pdf' });
  };

  return (
    <div className="space-y-10">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-zinc-900 mb-1">Course Materials</h2>
          <p className="text-zinc-400 font-medium">Upload and manage study resources</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-3">
          <Plus className="w-5 h-5" /> Add Material
        </button>
      </header>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-10 rounded-[3rem] w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-black tracking-tighter mb-8">New Material</h3>
              <form onSubmit={handleAddMaterial} className="space-y-5">
                <div className="space-y-2">
                  <label className="micro-label ml-1">Title</label>
                  <input placeholder="e.g. Lecture 1 Notes" className="input-field" required value={newMaterial.title} onChange={e => setNewMaterial({...newMaterial, title: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="micro-label ml-1">Description</label>
                  <textarea placeholder="Brief summary of the material..." className="input-field min-h-[100px]" required value={newMaterial.description} onChange={e => setNewMaterial({...newMaterial, description: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="micro-label ml-1">File URL</label>
                  <input placeholder="https://..." className="input-field" required value={newMaterial.fileUrl} onChange={e => setNewMaterial({...newMaterial, fileUrl: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="micro-label ml-1">Type</label>
                  <select className="input-field" value={newMaterial.type} onChange={e => setNewMaterial({...newMaterial, type: e.target.value as 'pdf' | 'video'})}>
                    <option value="pdf">PDF Document</option>
                    <option value="video">Video Lesson</option>
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 p-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-zinc-200 hover:bg-zinc-50 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 btn-primary">Upload</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {materials.map(m => (
          <div key={m.id} className="glass-card glass-card-hover p-8 rounded-[2.5rem] flex items-start gap-6 group">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg",
              m.type === 'pdf' ? "bg-red-50 text-red-500 shadow-red-100" : "bg-blue-50 text-blue-500 shadow-blue-100"
            )}>
              {m.type === 'pdf' ? <FileText className="w-8 h-8" /> : <Video className="w-8 h-8" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-lg font-black text-zinc-900 truncate tracking-tight">{m.title}</h4>
                <button 
                  onClick={async () => await deleteDoc(doc(db, 'materials', m.id))}
                  className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-zinc-400 font-medium line-clamp-2 mb-6">{m.description}</p>
              <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
                <span className="micro-label text-zinc-300">
                  {format(new Date(m.uploadedAt), 'MMM dd, yyyy')}
                </span>
                <a 
                  href={m.fileUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-xs font-black uppercase tracking-widest text-zinc-900 hover:underline"
                >
                  View Resource
                </a>
              </div>
            </div>
          </div>
        ))}
        {materials.length === 0 && (
          <div className="md:col-span-2 py-20 text-center glass-card rounded-[2.5rem] border-dashed border-2 border-zinc-100">
            <FileText className="w-12 h-12 text-zinc-100 mx-auto mb-4" />
            <p className="text-zinc-400 font-medium italic">No materials uploaded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const TeacherTests = () => {
  const { id: courseId } = useParams();
  const [tests, setTests] = useState<Test[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTest, setNewTest] = useState({ name: '', maxMarks: 100, dueDate: format(new Date(), 'yyyy-MM-dd') });

  useEffect(() => {
    onSnapshot(query(collection(db, 'tests'), where('courseId', '==', courseId)), (snap) => {
      setTests(snap.docs.map(d => ({ id: d.id, ...d.data() } as Test)));
    });

    const fetchStudents = async () => {
      const ensSnap = await getDocs(query(collection(db, 'enrollments'), where('courseId', '==', courseId)));
      const studentIds = ensSnap.docs.map(d => d.data().studentId);
      if (studentIds.length > 0) {
        const usersSnap = await getDocs(collection(db, 'users'));
        setStudents(usersSnap.docs
          .map(d => d.data() as User)
          .filter(u => studentIds.includes(u.uid))
        );
      }
    };
    fetchStudents();
  }, [courseId]);

  const handleAddTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = Math.random().toString(36).substr(2, 9);
    await setDoc(doc(db, 'tests', id), {
      ...newTest,
      id,
      courseId,
      teacherId: auth.currentUser?.uid
    });
    setShowAdd(false);
  };

  const updateScore = async (studentId: string, testId: string, marks: number, maxMarks: number) => {
    const id = `${studentId}_${testId}`;
    const grade = marks >= maxMarks * 0.9 ? 'A' : marks >= maxMarks * 0.8 ? 'B' : marks >= maxMarks * 0.7 ? 'C' : 'D';
    await setDoc(doc(db, 'test_scores', id), {
      studentId,
      testId,
      marks,
      grade
    });
  };

  return (
    <div className="space-y-10">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-zinc-900 mb-1">Tests & Grading</h2>
          <p className="text-zinc-400 font-medium">Manage assessments and student scores</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-3">
          <Plus className="w-5 h-5" /> Create Test
        </button>
      </header>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-10 rounded-[3rem] w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-black tracking-tighter mb-8">New Test</h3>
              <form onSubmit={handleAddTest} className="space-y-5">
                <div className="space-y-2">
                  <label className="micro-label ml-1">Test Name</label>
                  <input placeholder="e.g. Midterm Examination" className="input-field" required value={newTest.name} onChange={e => setNewTest({...newTest, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="micro-label ml-1">Max Marks</label>
                    <input type="number" className="input-field" required value={newTest.maxMarks} onChange={e => setNewTest({...newTest, maxMarks: parseInt(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="micro-label ml-1">Due Date</label>
                    <input type="date" className="input-field" required value={newTest.dueDate} onChange={e => setNewTest({...newTest, dueDate: e.target.value})} />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 p-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-zinc-200 hover:bg-zinc-50 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 btn-primary">Create</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-12">
        {tests.map(test => (
          <div key={test.id} className="glass-card rounded-[2.5rem] overflow-hidden">
            <div className="p-8 bg-zinc-50/50 border-b border-zinc-100 flex justify-between items-center">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-zinc-100">
                  <Award className="w-7 h-7 text-zinc-900" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-zinc-900 tracking-tight">{test.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="micro-label text-zinc-400">Max Marks: {test.maxMarks}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-200"></span>
                    <span className="micro-label text-zinc-400">Due: {test.dueDate}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={async () => await deleteDoc(doc(db, 'tests', test.id))} 
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm border border-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/50 border-b border-zinc-100">
                    <th className="px-8 py-5">
                      <span className="micro-label">Student</span>
                    </th>
                    <th className="px-8 py-5 text-right">
                      <span className="micro-label">Marks Obtained</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {students.map(s => (
                    <tr key={s.uid} className="hover:bg-zinc-50/30 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-black border border-zinc-200">
                            {s.name.charAt(0)}
                          </div>
                          <span className="font-bold text-zinc-900">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <input 
                            type="number" 
                            className="w-24 h-12 px-4 bg-zinc-50 border border-zinc-200 rounded-xl text-right font-black text-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                            placeholder="0"
                            onBlur={(e) => updateScore(s.uid, test.id, parseInt(e.target.value), test.maxMarks)}
                          />
                          <span className="text-sm font-bold text-zinc-400">/ {test.maxMarks}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-8 py-12 text-center">
                        <p className="text-zinc-400 font-medium italic">No students enrolled in this course.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {tests.length === 0 && (
          <div className="py-20 text-center glass-card rounded-[2.5rem] border-dashed border-2 border-zinc-100">
            <Award className="w-12 h-12 text-zinc-100 mx-auto mb-4" />
            <p className="text-zinc-400 font-medium italic">No tests created yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Student Modules ---

const StudentCourseDetails = () => {
  const { id: courseId } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [scores, setScores] = useState<TestScore[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  useEffect(() => {
    if (!courseId) return;
    getDoc(doc(db, 'courses', courseId)).then(d => setCourse(d.data() as Course));
    
    onSnapshot(query(collection(db, 'materials'), where('courseId', '==', courseId)), (snap) => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
    });

    onSnapshot(query(collection(db, 'test_scores'), where('studentId', '==', auth.currentUser?.uid)), (snap) => {
      setScores(snap.docs.map(d => d.data() as TestScore));
    });

    onSnapshot(query(collection(db, 'attendance'), where('studentId', '==', auth.currentUser?.uid), where('courseId', '==', courseId)), (snap) => {
      setAttendance(snap.docs.map(d => d.data() as Attendance));
    });
  }, [courseId]);

  const attendanceRate = useMemo(() => {
    if (attendance.length === 0) return 0;
    const present = attendance.filter(a => a.status === 'present').length;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  return (
    <div className="space-y-10">
      <header>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-zinc-900 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-lg shadow-zinc-200">
            {course?.code}
          </div>
          <h2 className="text-3xl font-black tracking-tighter text-zinc-900">{course?.name}</h2>
        </div>
        <p className="text-zinc-400 font-medium ml-16">{course?.semester} • Academic Year 2026</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black tracking-tight text-zinc-900 flex items-center gap-3">
                <FileText className="w-6 h-6 text-zinc-400" />
                Learning Resources
              </h3>
              <span className="micro-label text-zinc-300">{materials.length} Items</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {materials.map(m => (
                <div key={m.id} className="glass-card glass-card-hover p-6 rounded-[2rem] flex items-center gap-5 group">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                    m.type === 'pdf' ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
                  )}>
                    {m.type === 'pdf' ? <FileText className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-zinc-900 text-sm truncate tracking-tight">{m.title}</p>
                    <p className="text-xs text-zinc-400 font-medium truncate">{m.description}</p>
                  </div>
                  <a 
                    href={m.fileUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all"
                  >
                    {m.type === 'pdf' ? <Download className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </a>
                </div>
              ))}
              {materials.length === 0 && (
                <div className="col-span-2 py-12 text-center glass-card rounded-[2rem] border-dashed border-2 border-zinc-100">
                  <p className="text-zinc-400 font-medium italic">No materials available yet.</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-black tracking-tight text-zinc-900 mb-6 flex items-center gap-3">
              <Award className="w-6 h-6 text-zinc-400" />
              Academic Performance
            </h3>
            <div className="glass-card rounded-[2.5rem] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 border-b border-zinc-100">
                    <th className="px-8 py-5">
                      <span className="micro-label">Assessment</span>
                    </th>
                    <th className="px-8 py-5">
                      <span className="micro-label">Score</span>
                    </th>
                    <th className="px-8 py-5 text-right">
                      <span className="micro-label">Grade</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {scores.map((s, i) => (
                    <tr key={i} className="hover:bg-zinc-50/30 transition-colors">
                      <td className="px-8 py-6">
                        <span className="font-bold text-zinc-900">Test {i + 1}</span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="data-value text-zinc-900">{s.marks}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className={cn(
                          "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm",
                          s.grade === 'A' ? "bg-green-500 text-white shadow-green-100" :
                          s.grade === 'B' ? "bg-blue-500 text-white shadow-blue-100" :
                          "bg-zinc-900 text-white shadow-zinc-200"
                        )}>
                          Grade {s.grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {scores.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-8 py-12 text-center">
                        <p className="text-zinc-400 font-medium italic">No scores recorded yet.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-10">
          <div className="glass-card p-10 rounded-[3rem] text-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
            <div className="relative">
              <div className="w-28 h-28 rounded-full border-8 border-zinc-50 flex items-center justify-center mx-auto mb-6 shadow-inner">
                <span className="text-3xl font-black text-zinc-900">{attendanceRate}%</span>
              </div>
              <h4 className="text-lg font-black text-zinc-900 tracking-tight">Attendance Rate</h4>
              <p className="text-xs text-zinc-400 font-medium mt-1">Based on {attendance.length} sessions</p>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[2.5rem]">
            <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-6 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-zinc-400" />
              Recent Logs
            </h4>
            <div className="space-y-4">
              {attendance.slice(-5).reverse().map((a, i) => (
                <div key={i} className="flex justify-between items-center p-4 rounded-2xl bg-zinc-50/50 border border-zinc-100/50">
                  <span className="text-xs font-bold text-zinc-500">{format(new Date(a.date), 'MMM dd, yyyy')}</span>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg",
                    a.status === 'present' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                  )}>
                    {a.status}
                  </span>
                </div>
              ))}
              {attendance.length === 0 && (
                <p className="text-xs text-zinc-400 italic text-center py-4">No attendance logs found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- App Root ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          }
        } catch (error) {
          console.error("Auth sync error:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen">
          {user && <Sidebar role={user.role} user={user} />}
          <main className={cn(
            "p-4 md:p-8 lg:p-12 transition-all",
            user ? "lg:ml-64" : ""
          )}>
            <div className="max-w-7xl mx-auto">
              <Routes>
                <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to={`/${user.role}`} />} />
                
                {/* Admin Routes */}
                <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" />} />
                <Route path="/admin/users" element={user?.role === 'admin' ? <AdminUsers /> : <Navigate to="/login" />} />
                <Route path="/admin/courses" element={user?.role === 'admin' ? <AdminCourses /> : <Navigate to="/login" />} />

                {/* Teacher Routes */}
                <Route path="/teacher" element={user?.role === 'teacher' ? <TeacherDashboard user={user} /> : <Navigate to="/login" />} />
                <Route path="/teacher/courses/:id/attendance" element={user?.role === 'teacher' ? <TeacherAttendance /> : <Navigate to="/login" />} />
                <Route path="/teacher/courses/:id/materials" element={user?.role === 'teacher' ? <TeacherMaterials /> : <Navigate to="/login" />} />
                <Route path="/teacher/courses/:id/tests" element={user?.role === 'teacher' ? <TeacherTests /> : <Navigate to="/login" />} />

                {/* Student Routes */}
                <Route path="/student" element={user?.role === 'student' ? <StudentDashboard user={user} /> : <Navigate to="/login" />} />
                <Route path="/student/courses/:id" element={user?.role === 'student' ? <StudentCourseDetails /> : <Navigate to="/login" />} />

                {/* Common Routes */}
                <Route path="/profile" element={user ? <ProfileSettings user={user} /> : <Navigate to="/login" />} />

                <Route path="/" element={user ? <Navigate to={`/${user.role}`} /> : <LandingPage />} />
              </Routes>
            </div>
          </main>
        </div>
      </Router>
    </ErrorBoundary>
  );
}
