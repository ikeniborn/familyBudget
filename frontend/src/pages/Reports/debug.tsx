import React, { useEffect, useState } from 'react';

const DebugReportsPage: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addLog = (message: string) => {
    console.log(`[DEBUG] ${message}`);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    addLog('DebugReportsPage mounted');
    
    try {
      addLog('Testing imports...');
      
      // Test basic React functionality
      addLog('React is working');
      
      // Test localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        addLog('localStorage is available');
        try {
          localStorage.setItem('test', 'value');
          localStorage.removeItem('test');
          addLog('localStorage read/write works');
        } catch (e) {
          addLog(`localStorage error: ${e}`);
        }
      } else {
        addLog('localStorage not available');
      }
      
      addLog('Component initialization complete');
      
    } catch (e) {
      const errorMsg = `Error during initialization: ${e}`;
      addLog(errorMsg);
      setError(errorMsg);
    }
  }, []);

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'monospace',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: '#333', marginBottom: '20px' }}>
        Debug Reports Page
      </h1>
      
      {error && (
        <div style={{ 
          backgroundColor: '#fee', 
          border: '1px solid #fcc', 
          padding: '10px', 
          marginBottom: '20px',
          borderRadius: '4px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #ddd', 
        padding: '15px',
        borderRadius: '4px'
      }}>
        <h2 style={{ marginTop: 0 }}>Debug Logs:</h2>
        {logs.length === 0 ? (
          <p>No logs yet...</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {logs.map((log, index) => (
              <li key={index} style={{ marginBottom: '5px' }}>
                {log}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div style={{ 
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#e8f5e8',
        border: '1px solid #4caf50',
        borderRadius: '4px'
      }}>
        <h3 style={{ marginTop: 0, color: '#2e7d32' }}>
          ✅ React Component Rendered Successfully!
        </h3>
        <p style={{ margin: 0 }}>
          The reports page is loading and React is working correctly.
        </p>
      </div>
    </div>
  );
};

export default DebugReportsPage;