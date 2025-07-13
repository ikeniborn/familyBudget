import React from 'react';

const TestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Test Page</h1>
        <p className="text-lg text-slate-600">If you see this, React is working!</p>
        <div className="mt-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Status: OK</h2>
          <p>The application is rendering correctly.</p>
        </div>
      </div>
    </div>
  );
};

export default TestPage;