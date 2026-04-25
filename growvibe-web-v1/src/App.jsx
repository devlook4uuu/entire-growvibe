import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Routes, Route, Navigate } from 'react-router-dom';
import { initAuthThunk } from './store/authSlice';
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import OwnerDashboard from './pages/dashboard/OwnerDashboard';
import PrincipalDashboard from './pages/dashboard/PrincipalDashboard';
import CoordinatorDashboard from './pages/dashboard/CoordinatorDashboard';
import TeacherDashboard from './pages/dashboard/TeacherDashboard';
import StudentDashboard from './pages/dashboard/StudentDashboard';
import ProfilePage from './pages/profile/ProfilePage';
import OwnersPage   from './pages/management/OwnersPage';
import SchoolsPage  from './pages/management/SchoolsPage';
import BranchesPage from './pages/management/BranchesPage';
import PaymentsPage from './pages/management/PaymentsPage';
import SessionsPage from './pages/management/SessionsPage';
import StaffPage    from './pages/management/StaffPage';
import ClassesPage  from './pages/management/ClassesPage';
import StudentsPage    from './pages/management/StudentsPage';
import FeeRecordsPage          from './pages/management/FeeRecordsPage';
import FeeReceiptsPage         from './pages/management/FeeReceiptsPage';
import TeacherAttendancePage   from './pages/management/TeacherAttendancePage';
import StudentAttendancePage   from './pages/management/StudentAttendancePage';
import GrowTasksPage           from './pages/management/GrowTasksPage';
import DiaryPage               from './pages/management/DiaryPage';
import BannerPage              from './pages/management/BannerPage';
import SupportPage             from './pages/management/SupportPage';
import MySupportPage           from './pages/management/MySupportPage';

const dashboardComponents = {
  admin: AdminDashboard,
  owner: OwnerDashboard,
  principal: PrincipalDashboard,
  coordinator: CoordinatorDashboard,
  teacher: TeacherDashboard,
  student: StudentDashboard,
};

function DashboardPage() {
  const { currentRole } = useSelector((state) => state.role);
  const DashboardComponent = dashboardComponents[currentRole] || AdminDashboard;
  return <DashboardComponent />;
}

function SupportRoute() {
  const { currentRole } = useSelector((s) => s.role);
  return currentRole === 'admin' ? <SupportPage /> : <MySupportPage />;
}

function PlaceholderPage({ name }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#1A1D21', margin: 0 }}>{name}</p>
        <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>This section is coming soon.</p>
      </div>
    </div>
  );
}

export default function App() {
  const dispatch = useDispatch();

  // Restore session on app mount
  useEffect(() => {
    dispatch(initAuthThunk());
  }, [dispatch]);

  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes — all wrapped in ProtectedRoute + DashboardLayout */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/owners" element={<OwnersPage />} />
                <Route path="/schools" element={<SchoolsPage />} />
                <Route path="/schools/:schoolId/branches" element={<BranchesPage />} />
                <Route path="/schools/:schoolId/payments" element={<PaymentsPage />} />
                <Route path="/sessions" element={<SessionsPage />} />
                <Route path="/staff"    element={<StaffPage />} />
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/fee-records" element={<FeeRecordsPage />} />
                <Route path="/orders" element={<PlaceholderPage name="Orders" />} />
                <Route path="/saas-revenue" element={<PlaceholderPage name="SaaS Revenue" />} />
                <Route path="/store" element={<PlaceholderPage name="Store" />} />
                <Route path="/support" element={<SupportRoute />} />
                <Route path="/branches" element={<PlaceholderPage name="Branches" />} />
                <Route path="/staff" element={<PlaceholderPage name="Staff" />} />
                <Route path="/fees" element={<PlaceholderPage name="Fee Management" />} />
                <Route path="/fee-receipts" element={<FeeReceiptsPage />} />
                <Route path="/applications" element={<PlaceholderPage name="Applications" />} />
                <Route path="/announcements" element={<PlaceholderPage name="Announcements" />} />
                <Route path="/classes" element={<ClassesPage />} />
                <Route path="/teachers" element={<PlaceholderPage name="Teachers" />} />
                <Route path="/growcoins" element={<PlaceholderPage name="GrowCoins" />} />
                <Route path="/chats" element={<PlaceholderPage name="Class Chats" />} />
                <Route path="/chat" element={<PlaceholderPage name="Class Chat" />} />
                <Route path="/timetable" element={<PlaceholderPage name="Timetable" />} />
                <Route path="/growtasks" element={<GrowTasksPage />} />
                <Route path="/diary"    element={<DiaryPage />} />
                <Route path="/banners" element={<BannerPage />} />
                <Route path="/leaderboard" element={<PlaceholderPage name="Leaderboard" />} />
                <Route path="/teacher-attendance"  element={<TeacherAttendancePage />} />
                <Route path="/student-attendance"  element={<StudentAttendancePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<PlaceholderPage name="Settings" />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
