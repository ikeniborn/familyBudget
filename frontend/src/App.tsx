import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from './components/auth/AuthGuard';
import { ToastContainer } from './components/common/ToastContainer';
import { PasswordLogin } from './components/auth/PasswordLogin';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import TestPage from './pages/Test';
// Lazy load other pages
const FactPage = React.lazy(() => import('./pages/Fact'));
const BudgetPage = React.lazy(() => import('./pages/Budget'));
const ReportsPage = React.lazy(() => import('./pages/Reports'));
const ProductsPage = React.lazy(() => import('./pages/Products'));
const UIShowcasePage = React.lazy(() => import('./pages/UIShowcase'));
const FormValidationPage = React.lazy(() => import('./pages/FormValidation'));
const SettingsPage = React.lazy(() => import('./pages/Settings'));

function App() {
  console.log('App component rendering...');
  return (
    <Router>
      <ToastContainer />
      <React.Suspense 
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        }
      >
        <Routes>
          <Route path="/test" element={<TestPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/password" element={<PasswordLogin />} />
          
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <DashboardPage />
              </AuthGuard>
            }
          />
          
          <Route
            path="/fact"
            element={
              <AuthGuard>
                <FactPage />
              </AuthGuard>
            }
          />
          
          <Route
            path="/budget"
            element={
              <AuthGuard>
                <BudgetPage />
              </AuthGuard>
            }
          />
          
          <Route
            path="/reports"
            element={<ReportsPage />}
          />
          
          <Route
            path="/products"
            element={
              <AuthGuard>
                <ProductsPage />
              </AuthGuard>
            }
          />
          
          <Route
            path="/ui-showcase"
            element={
              <AuthGuard>
                <UIShowcasePage />
              </AuthGuard>
            }
          />
          
          <Route
            path="/form-validation"
            element={
              <AuthGuard>
                <FormValidationPage />
              </AuthGuard>
            }
          />
          
          <Route
            path="/settings/*"
            element={
              <AuthGuard>
                <SettingsPage />
              </AuthGuard>
            }
          />
          
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </React.Suspense>
    </Router>
  );
}

export default App;