import React, { useState, useEffect } from 'react';
import {
  Database,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Check,
  Info,
  Server,
  Lock,
  ExternalLink,
  X
} from 'lucide-react';

interface SupabaseStatus {
  isConfigured: boolean;
  isLive: boolean;
  url: string;
  hasServiceKey: boolean;
  hasAnonKey: boolean;
  source: string;
}

interface TestQueryResult {
  success: boolean;
  isLive: boolean;
  message: string;
  records?: Array<{
    id: string;
    unit_code: string;
    paper_title: string;
    price: string | number;
  }>;
  count?: number;
  source?: string;
  error?: string;
}

interface AdminSupabaseSettingsViewProps {
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onConfigSaved?: () => void;
  onClose?: () => void;
}

export const AdminSupabaseSettingsView: React.FC<AdminSupabaseSettingsViewProps> = ({
  onNotify,
  onConfigSaved,
  onClose,
}) => {
  const [status, setStatus] = useState<SupabaseStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);

  // Form Fields
  const [projectUrl, setProjectUrl] = useState<string>('');
  const [anonKey, setAnonKey] = useState<string>('');
  const [serviceKey, setServiceKey] = useState<string>('');

  // Visibility toggles
  const [showAnonKey, setShowAnonKey] = useState<boolean>(false);
  const [showServiceKey, setShowServiceKey] = useState<boolean>(false);

  // Action states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<TestQueryResult | null>(null);

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/admin/supabase/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.url && !projectUrl) {
          setProjectUrl(data.url);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch Supabase status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Save Configuration Handler
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    setTestResult(null);

    if (!projectUrl.trim()) {
      setSaveMessage({ text: 'Please enter a valid Supabase Project URL.', isError: true });
      return;
    }
    if (!serviceKey.trim() && !status?.hasServiceKey) {
      setSaveMessage({ text: 'Supabase Service Role Key is required for server database access.', isError: true });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/supabase/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: projectUrl.trim(),
          anonKey: anonKey.trim(),
          serviceKey: serviceKey.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save and verify Supabase configuration.');
      }

      setSaveMessage({
        text: 'Credentials verified and saved successfully! Connected to live Supabase project.',
        isError: false
      });
      if (onNotify) {
        onNotify('Supabase database configuration saved and verified!', 'success');
      }

      // Clear cleartext secrets from state for hygiene
      setServiceKey('');
      setAnonKey('');
      await fetchStatus();

      // Automatically populate test query with sample results returned
      if (data.sampleRecords) {
        setTestResult({
          success: true,
          isLive: true,
          message: data.message,
          records: data.sampleRecords,
          count: data.sampleCount,
          source: 'Live Supabase Database (Production)'
        });
      }

      if (onConfigSaved) {
        onConfigSaved();
      }
    } catch (err: any) {
      setSaveMessage({
        text: err.message || 'Error configuring Supabase database.',
        isError: true
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Test Database Connection Handler (Read-only query to Papers)
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/admin/supabase/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();
      setTestResult(data);
      if (onNotify) {
        if (data.isLive) {
          onNotify(`Live database query successful (${data.count} records retrieved)!`, 'success');
        } else {
          onNotify(data.message, 'info');
        }
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        isLive: false,
        message: 'Connection test failed. Network or server error.',
        error: err.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-500/10 text-[#00D26A] border border-[#00D26A]/30">
              <Database className="w-5 h-5" />
            </span>
            <h2 className="text-base font-extrabold text-white">
              Connect to Existing Supabase Database
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Configure secure, server-authoritative read and write access to your existing Supabase project. Read queries verify live examination papers without schema alterations.
          </p>
        </div>

        {/* Live Status Indicator Badge & Close Button */}
        <div className="shrink-0 flex items-center gap-3">
          {status?.isLive ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-black">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE DATABASE CONNECTED</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>FALLBACK MOCK ACTIVE</span>
            </div>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Panel"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Connection Settings Form Card */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Database Credentials
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Source: <strong className="text-slate-200">{status?.source || 'Detecting...'}</strong>
          </span>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-4">
          {/* Field 1: Supabase Project URL */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1">
              Supabase Project URL <span className="text-rose-400">*</span>
              <span className="text-[10px] font-mono font-normal text-slate-400 ml-2">
                (VITE_SUPABASE_URL or SUPABASE_URL)
              </span>
            </label>
            <input
              type="text"
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
              placeholder="https://your-project-id.supabase.co"
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-[#00D26A] transition-colors"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Example: <code className="text-slate-400">https://xyzcompany.supabase.co</code> (do not append /rest/v1).
            </p>
          </div>

          {/* Field 2: Publishable Anon Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-200">
                Supabase Publishable/Anon Key
                <span className="text-[10px] font-mono font-normal text-slate-400 ml-2">
                  (VITE_SUPABASE_ANON_KEY)
                </span>
              </label>
              {status?.hasAnonKey && !anonKey && (
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Configured in Environment
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showAnonKey ? 'text' : 'password'}
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder={status?.hasAnonKey ? '••••••••••••••••••••••••••••••••' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'}
                className="w-full px-3.5 py-2.5 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-[#00D26A] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowAnonKey(!showAnonKey)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                title={showAnonKey ? 'Hide key' : 'Show key'}
              >
                {showAnonKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Client-side anon public key for frontend queries.
            </p>
          </div>

          {/* Field 3: Service Role Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Supabase Service Role Key (Server-Side Only)</span>
                <span className="text-rose-400">*</span>
                <span className="text-[10px] font-mono font-normal text-slate-400 ml-2">
                  (SUPABASE_SERVICE_ROLE_KEY)
                </span>
              </label>
              {status?.hasServiceKey && !serviceKey && (
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Configured in Environment
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showServiceKey ? 'text' : 'password'}
                value={serviceKey}
                onChange={(e) => setServiceKey(e.target.value)}
                placeholder={status?.hasServiceKey ? '••••••••••••••••••••••••••••••••' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'}
                required={!status?.hasServiceKey}
                className="w-full px-3.5 py-2.5 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-[#00D26A] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowServiceKey(!showServiceKey)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                title={showServiceKey ? 'Hide key' : 'Show key'}
              >
                {showServiceKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-amber-400/90 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Strictly server-side secret. Never bundled into browser JavaScript or exposed in console logs.</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00D26A] hover:bg-[#00b85c] text-slate-950 font-black text-xs transition-colors shadow-lg shadow-[#00D26A]/10 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying &amp; Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isTesting ? 'Querying Papers Table...' : 'Test Database Connection'}</span>
            </button>
          </div>
        </form>

        {/* Save Result Notification */}
        {saveMessage && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
              saveMessage.isError
                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {saveMessage.isError ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            )}
            <span>{saveMessage.text}</span>
          </div>
        )}
      </div>

      {/* Query Results Card (Read-only sample from Papers) */}
      {testResult && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Read-Only Query Results: <code className="text-emerald-400 font-mono">public.Papers</code>
              </h3>
            </div>

            {/* Distinguish Live vs Mock */}
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  testResult.isLive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {testResult.isLive ? '✓ LIVE DATABASE RESULT' : '⚠ LOCAL DEMO / MOCK DATA'}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300">
            {testResult.message}
          </p>

          {testResult.records && testResult.records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                    <th className="py-2 px-3">Unit Code</th>
                    <th className="py-2 px-3">Paper Title</th>
                    <th className="py-2 px-3">Price</th>
                    <th className="py-2 px-3">ID / Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {testResult.records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-emerald-400">
                        {rec.unit_code}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-200">
                        {rec.paper_title}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-semibold">
                        {typeof rec.price === 'number' ? `KSh ${rec.price}` : rec.price}
                      </td>
                      <td className="py-2.5 px-3 text-[10px] text-slate-500 truncate max-w-[120px]" title={rec.id}>
                        {rec.id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] text-slate-500 mt-2 text-right">
                Showing {testResult.records.length} record(s) from {testResult.source}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-500">
              No paper records were returned by the query.
            </div>
          )}
        </div>
      )}

      {/* Manual Instructions Card for Permanent Secrets Storage */}
      <div className="p-5 rounded-3xl bg-slate-950/80 border border-slate-800/80 space-y-3">
        <div className="flex items-center gap-2 text-slate-300 text-xs font-extrabold uppercase tracking-wider">
          <Info className="w-4 h-4 text-sky-400" />
          <span>Permanent Environment Variables Guide</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          When configuring via this panel, credentials are saved to your local workspace environment so you can test live database reads immediately. For production Cloud Run deployment, verify that these exact variable names exist in your Cloud Run service (or Google Secret Manager):
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400">Project URL</div>
            <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">VITE_SUPABASE_URL</div>
            <div className="text-[10px] text-slate-500 mt-1">or SUPABASE_URL</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400">Public Key</div>
            <div className="text-xs font-mono font-bold text-sky-400 mt-0.5">VITE_SUPABASE_ANON_KEY</div>
            <div className="text-[10px] text-slate-500 mt-1">Anon public key</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400">Service Secret</div>
            <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">SUPABASE_SERVICE_ROLE_KEY</div>
            <div className="text-[10px] text-slate-500 mt-1">Server-side only</div>
          </div>
        </div>
      </div>
    </div>
  );
};
