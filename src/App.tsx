import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Shell from './layout/Shell';
import Login from './pages/Login';
import Forgot from './pages/Forgot';
import Reset from './pages/Reset';
import Dashboard from './pages/Dashboard';
import AdmissionsChannelPage from './pages/admissions/AdmissionsChannelPage';
import LegacyAdmissionsRedirect from './pages/admissions/LegacyAdmissionsRedirect';
import RegistrationsChannelPage from './pages/registrations/RegistrationsChannelPage';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Permissions from './pages/Permissions';
import Profile from './pages/Profile';
import OfficeSetup from './pages/OfficeSetup';
import OfficeApprovals from './pages/OfficeApprovals';
import AcademicLayout from './pages/academic/AcademicLayout';
import { AcademicResourceGuard } from './pages/academic/AcademicResourceGuard';
import {
  CampusesPage, CollegesPage, CoursesPage, DepartmentsPage, IntakesPage,
  LevelsPage, OlevelPage, ProgrammesPage, SessionsPage,
} from './pages/academic/pages';
import { GraduationPage } from './pages/academic/GraduationPage';
import {
  CourseRegistrationPage, OfferingsPage, RegistrationExtensionsPage, UnitLimitsPage,
} from './pages/academic/enrolment';
import {
  ResultsApprovalsPage,
  ResultsBoardPage,
  ResultsDashboardPage,
  ResultsGradingScalePage,
  ResultsImportPage,
  ResultsReleasePage,
  ResultsStudentDetailPage,
  ResultsStudentsPage,
} from './pages/academic/results';
import { CandidateDataPage } from './pages/academic/CandidateDataPage';
import { ImportApplicantsPage } from './pages/academic/ImportApplicantsPage';
import { ImportStudentsPage } from './pages/academic/ImportStudentsPage';
import { ImportInvoicesPage } from './pages/finance/ImportInvoicesPage';
import { ImportWalletPage } from './pages/finance/ImportWalletPage';
import ApplicationSettings from './pages/ApplicationSettings';
import ExamClearance from './pages/ExamClearance';
import Resources from './pages/Resources';
import ResourceView from './pages/ResourceView';
import HostelManagement from './pages/HostelManagement';
import {
  Documents, Finance, Institution,
  GenerateInvoice, Integrations, Invoices, Medical, Notifications, ProgrammeFees, Rebates, Students, StudentFinance, FeeCategories,
} from './pages/Modules';
import Announcements from './pages/Announcements';
import Audit from './pages/Audit';
import ReportsHome from './pages/reports/ReportsHome';
import ReportBuilder from './pages/reports/ReportBuilder';
import ReportRun from './pages/reports/ReportRun';
import PaymentCallback from './pages/PaymentCallback';

const STUDENT_PORTAL = import.meta.env.VITE_STUDENT_URL || 'http://localhost:5174/student';

function Guard({ children }: { children: React.ReactNode }) {
  const { auth, loading } = useAuth();
  if (loading) return <div className="p-10 text-slate-500">Loading…</div>;
  if (!auth) return <Navigate to="/login" replace />;
  if (!auth.is_staff) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-sky-50">
        <div className="bg-white border rounded-2xl p-8 max-w-md text-center space-y-4">
          <h1 className="text-lg font-semibold text-slate-800">Student portal required</h1>
          <p className="text-sm text-slate-600">
            This sign-in is for staff only. Applicants and students should use the student portal to apply or access their record.
          </p>
          <a href={STUDENT_PORTAL} className="inline-block bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm">
            Open student portal
          </a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<Forgot />} />
      <Route path="/reset-password" element={<Reset />} />
      <Route path="/payments/callback" element={<PaymentCallback />} />
      <Route
        path="/"
        element={
          <Guard>
            <Shell />
          </Guard>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="applications" element={<Navigate to="undergraduate" replace />} />
        <Route path="applications/:channel" element={<AdmissionsChannelPage />} />
        <Route path="admissions" element={<Navigate to="/applications/undergraduate" replace />} />
        <Route path="admissions/:channel" element={<LegacyAdmissionsRedirect />} />
        <Route path="registrations" element={<Navigate to="undergraduate" replace />} />
        <Route path="registrations/:channel" element={<RegistrationsChannelPage />} />
        <Route path="students" element={<Students />} />
        <Route path="academic" element={<AcademicLayout />}>
          <Route index element={<Navigate to="campuses" replace />} />
          <Route path="campuses" element={<AcademicResourceGuard resourceKey="campuses"><CampusesPage /></AcademicResourceGuard>} />
          <Route path="colleges" element={<AcademicResourceGuard resourceKey="colleges"><CollegesPage /></AcademicResourceGuard>} />
          <Route path="departments" element={<AcademicResourceGuard resourceKey="departments"><DepartmentsPage /></AcademicResourceGuard>} />
          <Route path="sessions" element={<AcademicResourceGuard resourceKey="sessions"><SessionsPage /></AcademicResourceGuard>} />
          <Route path="graduation" element={<AcademicResourceGuard resourceKey="graduation"><GraduationPage /></AcademicResourceGuard>} />
          <Route path="programmes" element={<AcademicResourceGuard resourceKey="programmes"><ProgrammesPage /></AcademicResourceGuard>} />
          <Route path="levels" element={<AcademicResourceGuard resourceKey="levels"><LevelsPage /></AcademicResourceGuard>} />
          <Route path="courses" element={<AcademicResourceGuard resourceKey="courses"><CoursesPage /></AcademicResourceGuard>} />
          <Route path="intakes" element={<AcademicResourceGuard resourceKey="intakes"><IntakesPage /></AcademicResourceGuard>} />
          <Route path="candidate-data" element={<AcademicResourceGuard resourceKey="candidate-data"><CandidateDataPage /></AcademicResourceGuard>} />
          <Route path="import-applicants" element={<AcademicResourceGuard resourceKey="import-applicants"><ImportApplicantsPage /></AcademicResourceGuard>} />
          <Route path="import-students" element={<AcademicResourceGuard resourceKey="import-students"><ImportStudentsPage /></AcademicResourceGuard>} />
          <Route path="olevel" element={<AcademicResourceGuard resourceKey="olevel"><OlevelPage /></AcademicResourceGuard>} />
          <Route path="offerings" element={<AcademicResourceGuard resourceKey="offerings"><OfferingsPage /></AcademicResourceGuard>} />
          <Route path="course-registration" element={<AcademicResourceGuard resourceKey="course-registration"><CourseRegistrationPage /></AcademicResourceGuard>} />
          <Route path="unit-limits" element={<AcademicResourceGuard resourceKey="unit-limits"><UnitLimitsPage /></AcademicResourceGuard>} />
          <Route path="registration-extensions" element={<AcademicResourceGuard resourceKey="registration-extensions"><RegistrationExtensionsPage /></AcademicResourceGuard>} />
          <Route path="results" element={<AcademicResourceGuard resourceKey="results"><ResultsDashboardPage /></AcademicResourceGuard>} />
          <Route path="results/students" element={<AcademicResourceGuard resourceKey="results-students"><ResultsStudentsPage /></AcademicResourceGuard>} />
          <Route path="results/students/:id" element={<AcademicResourceGuard resourceKey="results-students"><ResultsStudentDetailPage /></AcademicResourceGuard>} />
          <Route path="results/import" element={<AcademicResourceGuard resourceKey="results-import"><ResultsImportPage /></AcademicResourceGuard>} />
          <Route path="results/approvals" element={<AcademicResourceGuard resourceKey="results-approvals"><ResultsApprovalsPage /></AcademicResourceGuard>} />
          <Route path="results/board" element={<AcademicResourceGuard resourceKey="results-board"><ResultsBoardPage /></AcademicResourceGuard>} />
          <Route path="results/release" element={<AcademicResourceGuard resourceKey="results-release"><ResultsReleasePage /></AcademicResourceGuard>} />
          <Route path="results/grading-scale" element={<AcademicResourceGuard resourceKey="results-grading-scale"><ResultsGradingScalePage /></AcademicResourceGuard>} />
        </Route>
        <Route path="academic-setup" element={<Navigate to="/academic/campuses" replace />} />
        <Route path="exam-clearance" element={<ExamClearance />} />
        <Route path="finance" element={<Finance />} />
        <Route path="finance/sundry" element={<FeeCategories />} />
        <Route path="finance/categories" element={<FeeCategories />} />
        <Route path="finance/rebates" element={<Rebates />} />
        <Route path="finance/programme-fees" element={<ProgrammeFees />} />
        <Route path="finance/generate" element={<GenerateInvoice />} />
        <Route path="finance/invoices" element={<Invoices />} />
        <Route path="finance/student-status" element={<StudentFinance />} />
        <Route path="finance/import-invoices" element={<ImportInvoicesPage />} />
        <Route path="finance/import-wallet" element={<ImportWalletPage />} />
        <Route path="medical" element={<Medical />} />
        <Route path="hostel" element={<HostelManagement />} />
        <Route path="documents" element={<Documents />} />
        <Route path="users" element={<Users />} />
        <Route path="profile" element={<Profile />} />
        <Route path="roles" element={<Roles />} />
        <Route path="permissions" element={<Permissions />} />
        <Route path="office-setup" element={<OfficeSetup />} />
        <Route path="approvals" element={<OfficeApprovals />} />
        <Route path="institution" element={<Institution />} />
        <Route path="audit" element={<Audit />} />
        <Route path="reports" element={<ReportsHome />} />
        <Route path="reports/new" element={<ReportBuilder />} />
        <Route path="reports/:id/edit" element={<ReportBuilder />} />
        <Route path="reports/:id" element={<ReportRun />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="application-settings" element={<ApplicationSettings />} />
        <Route path="resources" element={<Resources />} />
        <Route path="resources/:slug" element={<ResourceView />} />
      </Route>
    </Routes>
  );
}
