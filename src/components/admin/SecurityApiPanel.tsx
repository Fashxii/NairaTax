import { useState } from 'react';
import { motion } from 'motion/react';
import { Key, ShieldAlert, Copy, RefreshCw, Plus, Check, Trash2, Globe } from 'lucide-react';
import { useToast } from '../Toast';

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  fullSecret?: string;
  environment: 'production' | 'sandbox';
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsed: string;
}

const INITIAL_API_KEYS: ApiKeyRecord[] = [
  {
    id: 'key_1',
    name: 'Mono Open Banking Webhook Key',
    keyPrefix: 'mono_live_sec_9082...',
    environment: 'production',
    status: 'active',
    createdAt: '2026-01-15',
    lastUsed: '2 mins ago',
  },
  {
    id: 'key_2',
    name: 'Paystack Payment Gateway Secret',
    keyPrefix: 'sk_live_891230...',
    environment: 'production',
    status: 'active',
    createdAt: '2026-02-10',
    lastUsed: '1 hour ago',
  },
  {
    id: 'key_3',
    name: 'Sandbox Developer Partner Key',
    keyPrefix: 'sb_test_00192...',
    environment: 'sandbox',
    status: 'revoked',
    createdAt: '2025-11-20',
    lastUsed: '30 days ago',
  },
];

const INITIAL_IP_WHITELIST = ['102.89.23.0/24 (Lagos HQ)', '197.210.64.0/24 (Abuja Regional)', '41.190.3.11 (Single IP Admin)'];

export default function SecurityApiPanel() {
  const { showToast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>(INITIAL_API_KEYS);
  const [ipWhitelist, setIpWhitelist] = useState<string[]>(INITIAL_IP_WHITELIST);
  const [newIpInput, setNewIpInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleGenerateKey = () => {
    const newId = `key_${Date.now()}`;
    const newRecord: ApiKeyRecord = {
      id: newId,
      name: `Partner Integration Key #${apiKeys.length + 1}`,
      keyPrefix: `live_sk_${Math.random().toString(36).slice(2, 10)}...`,
      environment: 'production',
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
    };

    setApiKeys([newRecord, ...apiKeys]);
    showToast('success', 'API Key Provisioned', 'New API secret key generated. Ensure it is stored securely.');
  };

  const handleRevokeKey = (id: string) => {
    setApiKeys((prev) =>
      prev.map((k) => {
        if (k.id === id) {
          showToast('warning', 'API Key Revoked', `Key ${k.name} has been revoked.`);
          return { ...k, status: 'revoked' };
        }
        return k;
      })
    );
  };

  const handleCopyKey = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('info', 'Copied', 'API Key prefix copied to clipboard.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddIp = () => {
    if (!newIpInput.trim()) return;
    setIpWhitelist([...ipWhitelist, newIpInput.trim()]);
    setNewIpInput('');
    showToast('success', 'IP Whitelisted', 'Added IP block to Admin Firewall.');
  };

  const handleRemoveIp = (index: number) => {
    setIpWhitelist(ipWhitelist.filter((_, i) => i !== index));
    showToast('info', 'IP Removed', 'Removed IP CIDR block from Whitelist.');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-left">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 border border-outline-variant rounded-2xl shadow-xs">
        <div>
          <h3 className="text-lg font-black text-primary-container tracking-tight">Security Policies &amp; API Key Management</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Provision API integration credentials, rotate secrets, and configure IP Whitelist firewalls.
          </p>
        </div>

        <button
          onClick={handleGenerateKey}
          className="px-4 py-2 bg-primary-container hover:bg-primary-container/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-accent-green" />
          <span>Provision New API Key</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* API Key Table */}
        <div className="lg:col-span-2 bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-primary-container" />
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-primary-container">API Integration Keys</h4>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant/60 text-on-surface-variant uppercase text-[10px] font-extrabold tracking-wider">
                  <th className="py-2.5 px-3">Key Name</th>
                  <th className="py-2.5 px-3">Prefix</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Last Used</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-surface-container-low/50">
                    <td className="py-3 px-3">
                      <p className="font-bold text-on-surface">{key.name}</p>
                      <p className="text-[9px] text-on-surface-variant">Created: {key.createdAt}</p>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-on-surface-variant">
                      {key.keyPrefix}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                          key.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {key.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-on-surface-variant font-medium">{key.lastUsed}</td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleCopyKey(key.id, key.keyPrefix)}
                          title="Copy Key Prefix"
                          className="p-1 hover:bg-surface-container rounded text-on-surface-variant cursor-pointer"
                        >
                          {copiedId === key.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        {key.status === 'active' && (
                          <button
                            onClick={() => handleRevokeKey(key.id)}
                            className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-[10px] font-bold rounded cursor-pointer"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* IP Whitelist & Security Alerts */}
        <div className="space-y-6">
          {/* IP Whitelist Firewall */}
          <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-outline-variant/40">
              <Globe className="w-4 h-4 text-primary-container" />
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-primary-container">IP Whitelist Firewall</h4>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newIpInput}
                onChange={(e) => setNewIpInput(e.target.value)}
                placeholder="CIDR e.g. 197.210.64.0/24"
                className="flex-grow bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary-container font-mono"
              />
              <button
                onClick={handleAddIp}
                className="bg-primary-container text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:opacity-90"
              >
                Add IP
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {ipWhitelist.map((ip, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-surface-container-low rounded-lg font-mono">
                  <span className="text-[11px] text-on-surface">{ip}</span>
                  <button onClick={() => handleRemoveIp(idx)} className="text-red-600 hover:text-red-800 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Threat Monitor */}
          <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/40">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-amber-800">Security Threat Feed</h4>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                <p className="font-bold text-[11px]">Multiple Failed OTP Attempts</p>
                <p className="text-[10px] text-amber-700">Blocked IP 102.89.11.02 after 5 failed verification calls.</p>
              </div>
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                <p className="font-bold text-[11px]">Mono Webhook Secret Validated</p>
                <p className="text-[10px] text-blue-700">HMAC signature passed for account update event.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
