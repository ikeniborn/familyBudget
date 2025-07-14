import React from 'react';

const CleanReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Clean Reports Page</h1>
          <p className="text-slate-600">
            This is a completely clean version with no chart imports to test basic functionality.
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Test Section</h2>
          <p>If you can see this, React routing and Layout are working correctly.</p>
        </div>
    </div>
  );
};

export default CleanReportsPage;