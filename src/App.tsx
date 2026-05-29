import { Toaster } from "@/components/ui/toaster";
import React, { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingPage } from "@/components/common/LoadingSpinner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { getDefaultLandingPath } from "@/lib/permissions";

const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const ProjectEdit = lazy(() => import("@/pages/ProjectEdit"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const TaskDetail = lazy(() => import("@/pages/TaskDetail"));
const TaskEdit = lazy(() => import("@/pages/TaskEdit"));
const Mails = lazy(() => import("@/pages/Mails"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const Users = lazy(() => import("@/pages/Users"));
const UserDetail = lazy(() => import("@/pages/UserDetail"));
const UserEdit = lazy(() => import("@/pages/UserEdit"));
const Roles = lazy(() => import("@/pages/Roles"));
const Reports = lazy(() => import("@/pages/Reports"));
const Activity = lazy(() => import("@/pages/Activity"));
const Settings = lazy(() => import("@/pages/Settings"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Unauthorized = lazy(() => import("@/pages/Unauthorized"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const ContactAdmin = lazy(() => import("@/pages/ContactAdmin"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const FinanceDashboard = lazy(() => import("@/pages/finance/FinanceDashboard"));
const FinanceTaxCommissions = lazy(() => import("@/pages/finance/FinanceTaxCommissions"));
const Payments = lazy(() => import("@/pages/finance/Payments"));
const FinanceAccounts = lazy(() => import("@/pages/finance/FinanceAccounts"));
const Expenses = lazy(() => import("@/pages/finance/Expenses"));
const Salary = lazy(() => import("@/pages/finance/Salary"));
const Clients = lazy(() => import("@/pages/finance/Clients"));
const Founders = lazy(() => import("@/pages/finance/Founders"));
const FinanceSettings = lazy(() => import("@/pages/finance/FinanceSettings"));
const FutureFund = lazy(() => import("@/pages/finance/FutureFund"));
const TimeTracking = lazy(() => import("@/pages/time-tracking/TimeTracking"));
const Leads = lazy(() => import("@/pages/leads/Leads"));
const ManageTaxonomies = lazy(() => import("@/pages/leads/ManageTaxonomies"));
const Guidance = lazy(() => import("@/pages/Guidance"));
const SystemGuide = lazy(() => import("@/pages/SystemGuide"));
const ProjectRoles = lazy(() => import("@/pages/ProjectRoles"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const DefaultRouteRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingPage text="Loading page..." />;
  }

  return <Navigate to={isAuthenticated ? getDefaultLandingPath(user) : '/login'} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<LoadingPage text="Loading page..." />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/contact-admin" element={<ContactAdmin />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* Protected Routes */}
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={
                <ProtectedRoute permissions={["dashboard.view", "sales.dashboard.view"]}>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/sales-dashboard" element={
                <ProtectedRoute permissions={["sales.dashboard.view", "sales.view"]}>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/projects" element={
                <ProtectedRoute permission="projects.view">
                  <Projects />
                </ProtectedRoute>
              } />
              <Route path="/projects/:id" element={
                <ProtectedRoute permission="projects.view">
                  <ProjectDetail />
                </ProtectedRoute>
              } />
              <Route path="/projects/:id/roles" element={
                <ProtectedRoute permission="projects.view">
                  <ProjectRoles />
                </ProtectedRoute>
              } />
              <Route path="/projects/:id/edit" element={
                <ProtectedRoute permission="projects.update">
                  <ProjectEdit />
                </ProtectedRoute>
              } />
              <Route path="/tasks" element={
                <ProtectedRoute permission="tasks.view">
                  <Tasks />
                </ProtectedRoute>
              } />
              <Route path="/tasks/my" element={
                <ProtectedRoute permission="tasks.view">
                  <Tasks />
                </ProtectedRoute>
              } />
              <Route path="/tasks/:id" element={
                <ProtectedRoute permission="tasks.view">
                  <TaskDetail />
                </ProtectedRoute>
              } />
              <Route path="/tasks/:id/edit" element={
                <ProtectedRoute permission="tasks.update">
                  <TaskEdit />
                </ProtectedRoute>
              } />
              <Route path="/mails" element={
                <ProtectedRoute permission="mails.view">
                  <Mails />
                </ProtectedRoute>
              } />
              <Route path="/calendar" element={
                <ProtectedRoute permission="calendar.view">
                  <Calendar />
                </ProtectedRoute>
              } />
              <Route path="/users" element={
                <ProtectedRoute permission="users.view">
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="/users/:id" element={
                <ProtectedRoute permission="users.view">
                  <UserDetail />
                </ProtectedRoute>
              } />
              <Route path="/users/:id/edit" element={
                <ProtectedRoute permission="users.update">
                  <UserEdit />
                </ProtectedRoute>
              } />
              <Route path="/roles" element={
                <ProtectedRoute permission="roles.view">
                  <Roles />
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute permission="reports.view">
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="/finance" element={
                <ProtectedRoute permission="finance.view">
                  <FinanceDashboard />
                </ProtectedRoute>
              } />
              <Route path="/finance/records" element={
                <ProtectedRoute permission="finance.view">
                  <FinanceTaxCommissions />
                </ProtectedRoute>
              } />
              <Route path="/finance/payments" element={
                <ProtectedRoute permission="finance.view">
                  <Payments />
                </ProtectedRoute>
              } />
              <Route path="/finance/accounts" element={
                <ProtectedRoute permission="finance.view">
                  <FinanceAccounts />
                </ProtectedRoute>
              } />
              <Route path="/finance/expenses" element={
                <ProtectedRoute permission="finance.view">
                  <Expenses />
                </ProtectedRoute>
              } />
              <Route path="/finance/salary" element={
                <ProtectedRoute permission="finance.view">
                  <Salary />
                </ProtectedRoute>
              } />
              <Route path="/salary" element={
                <ProtectedRoute permission="finance.view">
                  <Salary />
                </ProtectedRoute>
              } />
              <Route path="/finance/clients" element={
                <ProtectedRoute permission="finance.view">
                  <Clients />
                </ProtectedRoute>
              } />
              <Route path="/finance/founders" element={
                <ProtectedRoute permission="finance.view">
                  <Founders />
                </ProtectedRoute>
              } />
              <Route path="/finance/settings" element={
                <ProtectedRoute permission="finance.view">
                  <FinanceSettings />
                </ProtectedRoute>
              } />
              <Route path="/finance/future-fund" element={
                <ProtectedRoute permission="finance.view">
                  <FutureFund />
                </ProtectedRoute>
              } />
              <Route path="/time-tracking" element={
                <ProtectedRoute permission="time.view">
                  <TimeTracking />
                </ProtectedRoute>
              } />
              <Route path="/leads" element={
                <ProtectedRoute permission="leads.view">
                  <Leads />
                </ProtectedRoute>
              } />
              <Route path="/leads/taxonomies" element={
                <ProtectedRoute permission="leads.taxonomies.manage">
                  <ManageTaxonomies />
                </ProtectedRoute>
              } />
              <Route path="/guidance" element={
                <ProtectedRoute permission="dashboard.view">
                  <Guidance />
                </ProtectedRoute>
              } />
              <Route path="/system-guide" element={
                <ProtectedRoute permission="dashboard.view">
                  <SystemGuide />
                </ProtectedRoute>
              } />
              <Route path="/activity" element={
                <ProtectedRoute permission="activity_logs.view">
                  <Activity />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute permission="users.view">
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/settings/profile" element={
                <ProtectedRoute permission="users.view">
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/notifications" element={
                <ProtectedRoute permission="notifications.view">
                  <Notifications />
                </ProtectedRoute>
              } />
            </Route>
            
            {/* Redirects */}
            <Route path="/" element={<DefaultRouteRedirect />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
