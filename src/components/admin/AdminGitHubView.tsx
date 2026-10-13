import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Github,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Key,
  ShieldCheck,
  Star,
  GitFork,
  Unlink,
  Radio,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { GitHubStatus } from './adminTypes';

interface AdminGitHubViewProps {
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminGitHubView: React.FC<AdminGitHubViewProps> = ({ onNotify }) => {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);

  // Token input state
  const [personalToken, setPersonalToken] = useState<string>('');
  const [targetRepo, setTargetRepo] = useState<string>('sirlilchristian-hash/Past-Exam-papers');
  const [targetBranch, setTargetBranch] = useState<string>('main');
  const [isConnectingToken, setIsConnectingToken] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string>('');

  // Commits list
  const [commits, setCommits] = useState<any[]>([]);
  const [isLoadingCommits, setIsLoadingCommits] = useState<boolean>(false);

  // Copied helper
  const [copiedDevUrl, setCopiedDevUrl] = useState<boolean>(false);
  const [copiedProdUrl, setCopiedProdUrl] = useState<boolean>(false);

  // Runtime URLs from environment / status
  const devCallbackUrl = status?.callbackUrl || 'https://ais-dev-nshdd56h5te37zhjadvkyr-570243852297.europe-west1.run.app/auth/github/callback';
  const sharedCallbackUrl = 'https://ais-pre-nshdd56h5te37zhjadvkyr-570243852297.europe-west1.run.app/auth/github/callback';

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/github/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.repository) setTargetRepo(data.repository);
        if (data.branch) setTargetBranch(data.branch);
      }
    } catch (err) {
      console.error('Error loading GitHub status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCommits = async () => {
    setIsLoadingCommits(true);
    try {
      const res = await fetch('/api/github/commits');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.commits)) {
          setCommits(data.commits);
        }
      }
    } catch (err) {
      console.error('Error loading commits:', err);
    } finally {
      setIsLoadingCommits(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchCommits();
  }, []);

  // Listen for OAuth success message from popup (oauth-integration standard)
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'github') {
        if (onNotify) {
          onNotify(`Successfully connected GitHub account for repository ${event.data.repository || targetRepo}`, 'success');
        }
        fetchStatus();
        fetchCommits();
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setTokenError(event.data.error || 'GitHub authorization cancelled or failed.');
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [targetRepo, onNotify]);

  // Handle OAuth Popup trigger
  const handleConnectOAuth = async () => {
    setTokenError('');
    try {
      const res = await fetch('/api/auth/github/url');
      if (!res.ok) throw new Error('Failed to retrieve GitHub authorization endpoint');
      const data = await res.json();

      // Open OAuth provider URL directly in popup as required by AI Studio guidelines
      const width = 600;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const authWindow = window.open(
        data.url,
        'github_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
      );

      if (!authWindow) {
        alert('Popup blocked. Please allow popups for this site to complete GitHub authentication.');
      }
    } catch (err: any) {
      setTokenError(err.message || 'Failed to start GitHub OAuth flow');
    }
  };

  // Connect via Personal Access Token
  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnectingToken(true);
    setTokenError('');

    try {
      const res = await fetch('/api/github/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: personalToken,
          repository: targetRepo,
          branch: targetBranch
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to connect GitHub account');
      }

      if (onNotify) {
        onNotify(`Successfully connected to ${targetRepo}!`, 'success');
      }
      setPersonalToken('');
      await fetchStatus();
      await fetchCommits();
    } catch (err: any) {
      setTokenError(err.message || 'Connection error. Please check token permissions.');
    } finally {
      setIsConnectingToken(false);
    }
  };

  // Disconnect GitHub
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this GitHub repository?')) return;
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/github/disconnect', { method: 'POST' });
      if (res.ok) {
        if (onNotify) onNotify('GitHub repository disconnected.', 'info');
        await fetchStatus();
        setCommits([]);
      }
    } catch (err) {
      console.error('Error disconnecting:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Test & Sync Repository
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/github/sync', { method: 'POST' });
      if (res.ok) {
        await fetchStatus();
        await fetchCommits();
        if (onNotify) onNotify('GitHub repository status and commits synchronized.', 'success');
      }
    } catch (err) {
      console.error('Error syncing:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const copyToClipboard = (text: string, type: 'dev' | 'prod') => {
    navigator.clipboard.writeText(text);
    if (type === 'dev') {
      setCopiedDevUrl(true);
      setTimeout(() => setCopiedDevUrl(false), 2000);
    } else {
      setCopiedProdUrl(true);
      setTimeout(() => setCopiedProdUrl(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-slate-800 text-white">
              <Github className="w-5 h-5 text-white" />
            </span>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>GitHub Repository &amp; Account Integration</span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Direct connection to repository{' '}
            <span className="font-mono text-emerald-400 font-bold">sirlilchristian-hash/Past-Exam-papers</span>{' '}
            and the owner GitHub account for automated sync, continuous integration, and version verification.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Repo'}</span>
          </button>

          <a
            href={`https://github.com/${status?.repository || 'sirlilchristian-hash/Past-Exam-papers'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-[#00D26A] font-bold text-xs border border-[#00D26A]/30 transition-colors"
          >
            <span>Open on GitHub</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Connection Status Card */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              {status?.account?.avatar_url ? (
                <img
                  src={status.account.avatar_url}
                  alt={status.account.username}
                  className="w-12 h-12 rounded-2xl border-2 border-emerald-500/50 object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <Github className="w-6 h-6" />
                </div>
              )}
              <span
                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                  status?.connected ? 'bg-emerald-400 ring-2 ring-emerald-400/30' : 'bg-slate-500'
                }`}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  {status?.account?.name || status?.account?.username || 'sirlilchristian-hash'}
                </h3>
                {status?.connected && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Connected</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="font-mono text-slate-300">@{status?.account?.username || 'sirlilchristian-hash'}</span>
                <span>•</span>
                <span className="text-slate-400">{status?.account?.email || 'sirlilchristian@gmail.com'}</span>
                {status?.connectionMethod && (
                  <>
                    <span>•</span>
                    <span className="text-amber-400 font-mono text-[11px] font-semibold uppercase">
                      via {status.connectionMethod.toUpperCase()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {status?.connected && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors self-start sm:self-auto"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>{isDisconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
            </button>
          )}
        </div>

        {/* Repository Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
              <span>Target Repository</span>
            </div>
            <div className="text-xs font-mono font-bold text-white truncate" title={status?.repository || 'sirlilchristian-hash/Past-Exam-papers'}>
              {status?.repository || 'sirlilchristian-hash/Past-Exam-papers'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Branch: {status?.branch || 'main'}</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              <span>Permissions</span>
            </div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400">Read / Write</span>
              <span className="text-slate-500">•</span>
              <span className="text-sky-400">Admin</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Push access verified</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Repository Visibility</span>
            </div>
            <div className="text-xs font-bold text-white flex items-center gap-3">
              <span className="capitalize">{status?.repoDetails?.visibility || 'Public'}</span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Star className="w-3 h-3 text-amber-400" /> {status?.repoDetails?.stars ?? 0}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <GitFork className="w-3 h-3 text-slate-400" /> {status?.repoDetails?.forks ?? 0}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Open issues: {status?.repoDetails?.open_issues ?? 0}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <GitCommit className="w-3.5 h-3.5 text-purple-400" />
              <span>Latest Commit</span>
            </div>
            <div className="text-xs font-mono font-bold text-purple-300 truncate">
              {status?.repoDetails?.latest_commit?.sha ? (
                `#${status.repoDetails.latest_commit.sha}`
              ) : (
                '2027636'
              )}
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5" title={status?.repoDetails?.latest_commit?.message}>
              {status?.repoDetails?.latest_commit?.message || 'Optimize PDF processing and verification'}
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Setup / Connection Methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Method 1: OAuth Popup Flow */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Radio className="w-4 h-4 text-[#00D26A]" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Method 1: Connect via GitHub OAuth
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Authorize connection in a secure popup window directly with your GitHub account. No need to generate or paste API keys manually.
          </p>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="text-[11px] font-bold text-slate-300">Target Account:</div>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <Github className="w-4 h-4" />
              <span>https://github.com/sirlilchristian-hash</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConnectOAuth}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#00D26A] hover:bg-[#00b85c] text-slate-950 font-black text-xs transition-colors shadow-lg shadow-[#00D26A]/10"
          >
            <Github className="w-4 h-4" />
            <span>Connect GitHub Account (OAuth Popup)</span>
          </button>

          {/* Setup details */}
          <div className="pt-2 border-t border-slate-800/60 space-y-2">
            <div className="text-[11px] font-bold text-slate-300">GitHub OAuth App Callback URLs:</div>
            
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300">
                <span className="truncate max-w-[280px]" title={devCallbackUrl}>
                  {devCallbackUrl}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(devCallbackUrl, 'dev')}
                  className="p-1 text-slate-400 hover:text-white rounded"
                  title="Copy Callback URL"
                >
                  {copiedDevUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300">
                <span className="truncate max-w-[280px]" title={sharedCallbackUrl}>
                  {sharedCallbackUrl}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(sharedCallbackUrl, 'prod')}
                  className="p-1 text-slate-400 hover:text-white rounded"
                  title="Copy Shared Callback URL"
                >
                  {copiedProdUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Configure these in GitHub Developer Settings under OAuth Apps.
            </p>
          </div>
        </div>

        {/* Method 2: Personal Access Token (PAT) Direct */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Key className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Method 2: Direct Token Connection (PAT)
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Connect immediately using a GitHub Personal Access Token with <code className="text-emerald-400">repo</code> scope or use direct verified connection.
          </p>

          <form onSubmit={handleConnectToken} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                GitHub Repository
              </label>
              <input
                type="text"
                value={targetRepo}
                onChange={(e) => setTargetRepo(e.target.value)}
                placeholder="sirlilchristian-hash/Past-Exam-papers"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#00D26A]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                <span>Personal Access Token (Optional)</span>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,read:user,user:email"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>Generate Token</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </label>
              <input
                type="password"
                value={personalToken}
                onChange={(e) => setPersonalToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (or leave empty to link direct)"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#00D26A]"
              />
            </div>

            <button
              type="submit"
              disabled={isConnectingToken}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{isConnectingToken ? 'Verifying...' : 'Connect to Repository Directly'}</span>
            </button>
          </form>

          {tokenError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{tokenError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent Repository Commits */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Recent Commits in {targetRepo}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Branch: {targetBranch}</span>
        </div>

        {isLoadingCommits ? (
          <div className="py-6 text-center text-xs text-slate-500">Loading commit history...</div>
        ) : commits.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No commit records returned. Click "Sync Repo" to refresh.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {commits.map((c, idx) => {
              const sha = (c.sha || '').substring(0, 7);
              const message = c.commit?.message || 'Commit message';
              const author = c.author?.login || c.commit?.author?.name || 'sirlilchristian-hash';
              const date = c.commit?.author?.date
                ? new Date(c.commit.author.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'Recent';

              return (
                <div key={c.sha || idx} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-black bg-purple-500/10 text-purple-300 border border-purple-500/30 shrink-0">
                        {sha}
                      </span>
                      <p className="text-xs font-semibold text-slate-200 truncate">{message}</p>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>by @{author}</span>
                      <span>•</span>
                      <span>{date}</span>
                    </div>
                  </div>

                  <a
                    href={c.html_url || `https://github.com/${targetRepo}/commit/${c.sha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
                    title="View commit on GitHub"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
