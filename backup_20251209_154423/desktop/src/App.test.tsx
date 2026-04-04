// Temporary test file to verify React is working
import React from 'react';

export default function TestApp() {
  return (
    <div style={{ padding: '40px', fontFamily: 'Arial' }}>
      <h1 style={{ color: '#1976d2' }}>🚀 GST Billing Software</h1>
      <p>If you see this, React is working!</p>
      <div style={{ 
        background: '#e3f2fd', 
        padding: '20px', 
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h2>Status Check:</h2>
        <ul>
          <li>✅ HTML loaded</li>
          <li>✅ React rendering</li>
          <li>✅ JavaScript working</li>
        </ul>
        <p style={{ marginTop: '20px' }}>
          <strong>Next:</strong> Check browser console (F12) for any errors
        </p>
      </div>
    </div>
  );
}

