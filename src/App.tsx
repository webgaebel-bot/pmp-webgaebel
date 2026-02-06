import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import ProjectEdit from "@/pages/ProjectEdit";
import Tasks from "@/pages/Tasks";
import TaskDetail from "@/pages/TaskDetail";
import TaskEdit from "@/pages/TaskEdit";
import Mails from "@/pages/Mails";
import Calendar from "@/pages/Calendar";
import Users from "@/pages/Users";
import UserDetail from "@/pages/UserDetail";
import UserEdit from "@/pages/UserEdit";
import Roles from "@/pages/Roles";
import Reports from "@/pages/Reports";
import Activity from "@/pages/Activity";
import Settings from "@/pages/Settings";
import Notifications from "@/pages/Notifications";
import Unauthorized from "@/pages/Unauthorized";
import NotFound from "@/pages/NotFound";
import ContactAdmin from "@/pages/ContactAdmin";
import ForgotPassword from "@/pages/ForgotPassword";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/contact-admin" element={<ContactAdmin />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* Protected Routes */}
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={
                <ProtectedRoute permission="dashboard.view">
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
                <ProtectedRoute permission="users.edit">
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
              <Route path="/activity" element={
                <ProtectedRoute permission="activity.view">
                  <Activity />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/settings/profile" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/notifications" element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              } />
            </Route>
            
            {/* Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
