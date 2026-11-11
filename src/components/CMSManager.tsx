import React, { useState, useRef } from 'react';
import { useContent, AppContent } from '../context/ContentContext';
import { Save, Image as ImageIcon, Link as LinkIcon, Upload as UploadIcon, Check, Globe, Lock } from 'lucide-react';
import { useToast } from './Toast';
import { usePermissions } from '../admin/usePermissions';
import { describeWriteError } from '../admin/platformStore';
import { recordAuditLog } from '../utils/auditLogger';

/** Firestore documents max out at 1 MiB; leave headroom. */
const MAX_CONTENT_BYTES = 900_000;
const MAX_IMAGE_BYTES = 250_000;

export default function CMSManager() {
  const { content, publishContent, publishedMeta } = useContent();
  const { can, actorEmail, actorName } = usePermissions();
  const { showToast } = useToast();
  const canEdit = can('cms.edit');
  const [activePage, setActivePage] = useState<keyof AppContent>('gateway');
  const [savedStatus, setSavedStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state to manage form fields before they are strictly saved
  const [formData, setFormData] = useState(content[activePage]);

  // When switching pages, load the current global content for that page
  const handlePageSwitch = (page: keyof AppContent) => {
    setActivePage(page);
    setFormData(content[page]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = async () => {
    if (!canEdit) return;
    const next = { ...content, [activePage]: formData } as AppContent;
    const size = new Blob([JSON.stringify(next)]).size;
    if (size > MAX_CONTENT_BYTES) {
      showToast('error', 'Content too large', 'Use image URLs instead of uploaded images to stay under the 900 KB limit.');
      return;
    }
    setSaving(true);
    try {
      await publishContent(next, actorEmail);
      const changed = Object.keys(formData).filter(
        (k) => (formData as Record<string, string>)[k] !== (content[activePage] as Record<string, string>)[k],
      );
      recordAuditLog({
        actorName,
        actorEmail,
        action: 'PUBLISH_SITE_CONTENT',
        module: 'Content',
        severity: 'INFO',
        afterState: { page: activePage, changedFields: changed },
      });
      setSavedStatus(true);
      showToast('success', 'Published', 'Changes are now live for all visitors.');
      setTimeout(() => setSavedStatus(false), 3000);
    } catch (err) {
      showToast('error', 'Not published', describeWriteError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_IMAGE_BYTES) {
        showToast('warning', 'Image too large', 'Uploaded images must be under 250 KB. Host larger images and paste the URL instead.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData({
          ...formData,
          [fieldName]: base64String
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper for rendering form fields
  const renderField = (key: string, value: string) => {
    const isImage = key.toLowerCase().includes('image') || key.toLowerCase().includes('logo');
    
    if (isImage) {
      return (
        <div key={key} className="space-y-2 p-4 bg-surface-container-low border border-outline-variant rounded-xl">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </label>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Image Preview */}
            <div className="w-32 h-32 bg-surface-container border border-outline-variant/60 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              {value ? (
                <img src={value} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-8 h-8 text-on-surface-variant/40" />
              )}
            </div>
            
            <div className="flex-grow space-y-4">
              {/* URL Input Option */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-on-surface-variant flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" /> Option 1: Provide Image URL
                </span>
                <input
                  type="text"
                  name={key}
                  value={value}
                  onChange={handleInputChange}
                  placeholder="https://example.com/image.png"
                  className="w-full h-10 px-3 bg-background border border-outline rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary-container"
                />
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="h-px bg-outline-variant flex-grow"></div>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">OR</span>
                <div className="h-px bg-outline-variant flex-grow"></div>
              </div>

              {/* Upload Input Option */}
              <div>
                <span className="text-[10px] font-semibold text-on-surface-variant flex items-center gap-1 mb-1">
                  <UploadIcon className="w-3 h-3" /> Option 2: Upload Image
                </span>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="h-10 px-4 bg-surface-container border border-outline-variant text-on-surface-variant text-xs font-bold rounded-lg hover:bg-surface-container-high transition-colors w-full sm:w-auto"
                >
                  Choose File...
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => handleFileUpload(e, key)}
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Textarea for longer text
    if (value.length > 80 || key.toLowerCase().includes('desc') || key.toLowerCase().includes('text')) {
      return (
        <div key={key} className="space-y-1">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </label>
          <textarea
            name={key}
            value={value}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-4 py-2 bg-background border border-outline rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary-container resize-y"
          />
        </div>
      );
    }

    // Standard text input
    return (
      <div key={key} className="space-y-1">
        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
          {key.replace(/([A-Z])/g, ' $1').trim()}
        </label>
        <input
          type="text"
          name={key}
          value={value}
          onChange={handleInputChange}
          className="w-full h-12 px-4 bg-background border border-outline rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary-container font-semibold"
        />
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left pb-12">
      <div>
        <h2 className="text-2xl font-black text-primary-container tracking-tight">Content Management System</h2>
        <p className="text-sm text-on-surface-variant mt-1">Manage public facing texts and dynamic images across the platform.</p>
        <p className="text-[11px] text-on-surface-variant mt-2 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" />
          {publishedMeta?.updatedAt
            ? <>Live copy last published {publishedMeta.updatedAt.slice(0, 16).replace('T', ' ')} by {publishedMeta.updatedBy}</>
            : <>Showing built-in defaults — nothing has been published yet.</>}
        </p>
        {!canEdit && (
          <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Read-only: your role lacks the “Edit & publish site content” permission.</p>
        )}
      </div>

      {/* Horizontal Page Navigator */}
      <div className="flex items-center space-x-2 bg-surface-container p-1 rounded-xl border border-outline-variant overflow-x-auto hide-scrollbar">
        {(Object.keys(content) as Array<keyof AppContent>).map(page => (
          <button
            key={page}
            onClick={() => handlePageSwitch(page)}
            className={`px-6 py-2.5 text-xs font-bold rounded-lg transition-all capitalize whitespace-nowrap ${
              activePage === page 
                ? 'bg-white text-primary-container shadow-sm border border-outline-variant/40' 
                : 'text-on-surface-variant hover:text-primary-container hover:bg-white/50'
            }`}
          >
            {page} Page
          </button>
        ))}
      </div>

      {/* Editor Form */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
        <div className="flex justify-between items-center border-b border-outline-variant/40 pb-4">
          <h3 className="text-lg font-bold text-on-surface capitalize">Editing {activePage}</h3>
          <button
            onClick={handleSave}
            disabled={!canEdit || saving}
            className="h-10 px-5 bg-[#013220] text-white text-xs font-bold rounded-lg hover:opacity-95 active:scale-[0.98] transition-all flex items-center space-x-2 shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {savedStatus ? <Check className="w-4 h-4 text-accent-green" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Publishing…' : savedStatus ? 'Published!' : 'Publish Changes'}</span>
          </button>
        </div>

        <div className="space-y-5">
          {Object.entries(formData).map(([key, value]) => renderField(key, value as string))}
        </div>
      </div>
    </div>
  );
}
