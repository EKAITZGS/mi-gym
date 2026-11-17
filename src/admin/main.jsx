import React from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import './admin.css'
import ErrorBoundary from '../ErrorBoundary'
import AdminApp from './AdminApp'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AdminApp />
    </ErrorBoundary>
  </React.StrictMode>
)
