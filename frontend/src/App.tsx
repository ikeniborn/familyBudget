import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from './components/auth/AuthGuard';
import { ToastContainer } from './components/common/ToastContainer';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';

// Lazy load other pages
const FactPage = React.lazy(() => import('./pages/Fact'));
const BudgetPage = React.lazy(() => import('./pages/Budget'));
const ReportsPage = React.lazy(() => import('./pages/Reports'));
const ProductsPage = React.lazy(() => import('./pages/Products'));

function App() {
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
          <Route path="/login" element={<LoginPage />} />
          
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
            element={
              <AuthGuard>
                <ReportsPage />
              </AuthGuard>
            }
          />
          
          <Route
            path="/products"
            element={
              <AuthGuard>
                <ProductsPage />
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