import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { OnchainProviders } from './OnchainProviders'; // <--- Import Provider Di Sini

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* BUNGKUS APP DI SINI */}
    <OnchainProviders>
      <App />
    </OnchainProviders>
  </React.StrictMode>,
)