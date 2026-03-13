commit 934e1d091dd84cf759efecd3ff5cf2d42be63d74
Author: Kiera <kiera@secondlookprotect.co.uk>
Date:   Fri Mar 13 13:13:34 2026 +0000

    Fix missing lucide-react Phone import causing blank screen on GetProtectionPage

diff --git a/src/pages/GetProtectionPage.tsx b/src/pages/GetProtectionPage.tsx
index 07b110d..08a38fa 100644
--- a/src/pages/GetProtectionPage.tsx
+++ b/src/pages/GetProtectionPage.tsx
@@ -1,5 +1,5 @@
 import React, { useState, useEffect } from 'react';
-import { Shield, ArrowLeft, CheckCircle, ArrowRight, Building2, Users, FileText, ClipboardCheck, LayoutDashboard } from 'lucide-react';
+import { Shield, ArrowLeft, CheckCircle, ArrowRight, Building2, Users, FileText, ClipboardCheck, LayoutDashboard, Phone } from 'lucide-react';
 import { Button } from '../components/Button';
 import { getSupabase } from '../lib/supabaseClient';
 

commit e28819ec0b503489532ad18a07c993464a72ec1f
Author: Kiera <kiera@secondlookprotect.co.uk>
Date:   Fri Mar 13 13:07:03 2026 +0000

    Redesign GetProtectionPage into Book a Demo sales flow with updated layout and submission handler

diff --git a/src/pages/GetProtectionPage.tsx b/src/pages/GetProtectionPage.tsx
index 0c8e45f..07b110d 100644
--- a/src/pages/GetProtectionPage.tsx
+++ b/src/pages/GetProtectionPage.tsx
@@ -1,151 +1,34 @@
-import React, { useState, useRef, useEffect } from 'react';
-import { Shield, Upload, Link2, Phone, ArrowLeft, CheckCircle, ChevronRight, Image, X, MessageSquare, Mail } from 'lucide-react';
+import React, { useState, useEffect } from 'react';
+import { Shield, ArrowLeft, CheckCircle, ArrowRight, Building2, Users, FileText, ClipboardCheck, LayoutDashboard } from 'lucide-react';
 import { Button } from '../components/Button';
 import { getSupabase } from '../lib/supabaseClient';
 
-/* ÔöÇÔöÇ Mobile-portrait-only overrides for support buttons ÔöÇÔöÇ */
-const SLP_MOBILE_CSS = `
-@media (max-width: 480px) and (orientation: portrait) {
-  .slp-support-btn {
-    padding: 0.65rem 1.25rem !important;
-    font-size: 0.875rem !important;
-  }
-  .slp-email-label {
-    font-size: 0.875rem !important;
-  }
-  .slp-email-addr {
-    font-size: 0.75rem !important;
-  }
-}
-`;
-
-/* ÔöÇÔöÇÔöÇ Types ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
-
-interface NavigationProps {
+interface Props {
     onBack: () => void;
 }
 
-/* ÔöÇÔöÇÔöÇ Option card ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
-
-interface OptionCardProps {
-    icon: React.ReactNode;
-    title: string;
-    description: string;
-    selected: boolean;
-    onClick: () => void;
-}
-
-function OptionCard({ icon, title, description, selected, onClick }: OptionCardProps) {
-    return (
-        <button
-            onClick={onClick}
-            aria-pressed={selected}
-            className={[
-                'w-full text-left rounded-xl border-2 p-6 transition-all duration-200 cursor-pointer group',
-                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2',
-                selected
-                    ? 'border-[#C9A84C] bg-[#C9A84C]/5 shadow-md'
-                    : 'border-slate-200 bg-white hover:border-[#C9A84C]/40 hover:shadow-sm',
-            ].join(' ')}
-        >
-            <div className="flex items-start gap-4">
-                <div className={[
-                    'shrink-0 w-11 h-11 rounded-lg flex items-center justify-center transition-colors duration-200',
-                    selected ? 'bg-[#C9A84C]/15 text-[#A8853C]' : 'bg-slate-100 text-slate-500 group-hover:bg-[#C9A84C]/10 group-hover:text-[#A8853C]',
-                ].join(' ')}>
-                    {icon}
-                </div>
-                <div className="flex-1 min-w-0">
-                    <div className="flex items-center justify-between gap-2">
-                        <p className={['font-semibold text-base', selected ? 'text-[#0B1E36]' : 'text-slate-700'].join(' ')}>
-                            {title}
-                        </p>
-                        {selected && <CheckCircle className="w-5 h-5 text-[#C9A84C] shrink-0" aria-hidden="true" />}
-                    </div>
-                    <p className="text-slate-500 text-sm mt-1 leading-relaxed">{description}</p>
-                </div>
-            </div>
-        </button>
-    );
-}
-
-/* ÔöÇÔöÇÔöÇ Step indicator ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
-
-function StepIndicator({ step, total }: { step: number; total: number }) {
-    return (
-        <div className="flex items-center gap-2" aria-label={`Step ${step} of ${total}`} role="status">
-            {Array.from({ length: total }).map((_, i) => (
-                <div
-                    key={i}
-                    className={[
-                        'h-1 rounded-full transition-all duration-300',
-                        i < step ? 'bg-[#C9A84C] w-8' : 'bg-slate-200 w-4',
-                    ].join(' ')}
-                    aria-hidden="true"
-                />
-            ))}
-        </div>
-    );
-}
-
-/* ÔöÇÔöÇÔöÇ Options config ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
-
-const OPTIONS = [
-    {
-        id: 'screenshot',
-        icon: <Upload className="w-5 h-5" />,
-        title: 'Upload evidence for review',
-        description: 'Securely upload a suspicious message, email, invoice, or document for review.',
-    },
-    {
-        id: 'link',
-        icon: <Link2 className="w-5 h-5" />,
-        title: 'Submit a suspicious link',
-        description: 'Paste a URL your team is unsure about ÔÇö we will assess the risk.',
-    },
-    {
-        id: 'contact',
-        icon: <Phone className="w-5 h-5" />,
-        title: 'Request a platform walkthough',
-        description: 'See structured logging, manager review, and inspection reporting in action.',
-    },
-];
-
-/* ÔöÇÔöÇÔöÇ Main page ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
-
-export function GetProtectionPage({ onBack }: NavigationProps) {
-    const [step, setStep] = useState<1 | 2>(1);
-    const [selectedOption, setSelectedOption] = useState<string | null>(null);
+export function GetProtectionPage({ onBack }: Props) {
     const [submitted, setSubmitted] = useState(false);
+    const [isSubmitting, setIsSubmitting] = useState(false);
+    const [submitError, setSubmitError] = useState<string | null>(null);
 
-    // Step 2 inputs ÔÇö type-specific
-    const [file, setFile] = useState<File | null>(null);
-    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
-    const [linkValue, setLinkValue] = useState('');
-    const [contactValue, setContactValue] = useState('');
-
-    // Step 2 inputs ÔÇö contact details (all types)
+    // Form fields
     const [nameValue, setNameValue] = useState('');
+    const [orgNameValue, setOrgNameValue] = useState('');
+    const [roleValue, setRoleValue] = useState('');
     const [emailValue, setEmailValue] = useState('');
     const [phoneValue, setPhoneValue] = useState('');
+    const [orgTypeValue, setOrgTypeValue] = useState('');
     const [noteValue, setNoteValue] = useState('');
 
-    // UI states
-    const [isSubmitting, setIsSubmitting] = useState(false);
-    const [submitError, setSubmitError] = useState<string | null>(null);
-
     // Consent checkbox
     const [consentChecked, setConsentChecked] = useState(false);
     const [consentError, setConsentError] = useState(false);
 
-    const fileInputRef = useRef<HTMLInputElement>(null);
-
-    /* ÔöÇÔöÇ Scroll to top on every step change (scoped to this page only) ÔöÇÔöÇÔöÇÔöÇ */
     useEffect(() => {
-        window.scrollTo({ top: 0, behavior: 'smooth' });
-    }, [step, submitted]);
+        window.scrollTo({ top: 0, behavior: 'instant' });
+    }, [submitted]);
 
-    // Click tracking
     function trackEvent(event: string, data: Record<string, string>) {
         if (typeof window !== 'undefined') {
             window.dispatchEvent(new CustomEvent('slp_track', { detail: { event, ...data } }));
@@ -153,38 +36,9 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
         }
     }
 
-    function handleOptionSelect(id: string) {
-        setSelectedOption(id);
-        setSubmitError(null);
-    }
-
-    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
-        const chosen = e.target.files?.[0] ?? null;
-        setFile(chosen);
-        setSubmitError(null);
-        if (chosen) {
-            const url = URL.createObjectURL(chosen);
-            setPreviewUrl(url);
-        } else {
-            setPreviewUrl(null);
-        }
-    }
+    async function handleSubmit(e: React.FormEvent) {
+        e.preventDefault();
 
-    function clearFile() {
-        setFile(null);
-        setPreviewUrl(null);
-        if (fileInputRef.current) fileInputRef.current.value = '';
-    }
-
-    function handleContinue() {
-        if (!selectedOption) return;
-        trackEvent('get_protection_option_selected', { option: selectedOption });
-        setStep(2);
-    }
-
-    /* ÔöÇÔöÇ Supabase submit handler ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
-
-    async function handleSubmit() {
         if (!consentChecked) {
             setConsentError(true);
             return;
@@ -196,43 +50,14 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
         try {
             const supabase = getSupabase();
 
-            // ÔöÇÔöÇ STEP 1: Upload image to SUBMISSIONS bucket (screenshot only) ÔöÇÔöÇ
-            let publicImageUrl: string | null = null;
-
-            if (selectedOption === 'screenshot' && file) {
-                const storageKey = `submissions/${crypto.randomUUID()}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
-
-                console.log('[SLP] Step 1 ÔÇö Uploading to SUBMISSIONS bucket:', storageKey);
-
-                const { error: uploadError } = await supabase.storage
-                    .from('SUBMISSIONS')
-                    .upload(storageKey, file, { cacheControl: '3600', upsert: false });
-
-                if (uploadError) {
-                    throw new Error(`Image upload failed: ${uploadError.message}`);
-                }
-
-                // ÔöÇÔöÇ STEP 2: Get the public URL for that specific file ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
-                // getPublicUrl returns a direct HTTPS link ending in the original
-                // filename (e.g. ÔÇª/submissions/uuid/1234567890-photo.jpg).
-                // It is always a plain text string ÔÇö no signing, no expiry.
-                const { data: urlData } = supabase.storage
-                    .from('SUBMISSIONS')
-                    .getPublicUrl(storageKey);
-
-                publicImageUrl = String(urlData.publicUrl).trim(); // explicit text string
-                console.log('[SLP] Step 2 ÔÇö Public image URL:', publicImageUrl);
-            }
+            // Structure the message payload safely for backend
+            const payloadParts = [];
+            if (orgNameValue.trim()) payloadParts.push(`Organisation: ${orgNameValue.trim()}`);
+            if (orgTypeValue.trim()) payloadParts.push(`Type: ${orgTypeValue.trim()}`);
+            if (roleValue.trim()) payloadParts.push(`Role: ${roleValue.trim()}`);
+            if (noteValue.trim()) payloadParts.push(`\nMessage:\n${noteValue.trim()}`);
 
-            // Build message: combine type-specific input with user's written message
-            const parts: string[] = [];
-            if (selectedOption === 'link' && linkValue.trim()) parts.push(`URL: ${linkValue.trim()}`);
-            if (selectedOption === 'contact' && contactValue.trim()) parts.push(`Contact: ${contactValue.trim()}`);
-            if (noteValue.trim()) parts.push(noteValue.trim());
-            const messageText: string | null = parts.join('\n\n') || null;
-
-            // ÔöÇÔöÇ STEP 4: Insert ONE row with name + email + phone + message + image_url ÔöÇÔöÇ
-            console.log('[SLP] Step 3 ÔÇö Inserting submission row into Supabase...');
+            const messageText = payloadParts.join('\n') || null;
 
             const { error: insertError } = await supabase
                 .from('submissions')
@@ -241,19 +66,14 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
                     email: emailValue.trim(),
                     phone: phoneValue.trim() || null,
                     message: messageText,
-                    image_url: publicImageUrl,
                     status: 'new',
                 });
 
             if (insertError) {
-                // Surface the exact Supabase error so it's easy to diagnose
                 throw new Error(`Database error: ${insertError.message}`);
             }
 
-            console.log('[SLP] Step 4 ÔÇö Submission saved to database Ô£ô');
-
-            // ÔöÇÔöÇ STEP 5: Only show success after BOTH upload AND insert succeed ÔöÇÔöÇ
-            trackEvent('get_protection_submit', { option: selectedOption ?? 'unknown' });
+            trackEvent('demo_request_submitted', { orgType: orgTypeValue || 'not_provided' });
             setSubmitted(true);
 
         } catch (err: unknown) {
@@ -265,35 +85,26 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
         }
     }
 
-    // Is the submit button ready?
-    const typeSpecificReady = selectedOption === 'screenshot' ? true // image is optional
-        : selectedOption === 'link' ? true // link is optional
-            : selectedOption === 'contact' ? contactValue.trim().length > 0
-                : false;
-    const canSubmit = !isSubmitting
-        && consentChecked
-        && typeSpecificReady
-        && nameValue.trim().length > 0
-        && emailValue.trim().length > 0
-        && phoneValue.trim().length > 0
-        && noteValue.trim().length > 0;
-
-    // Shared input style
-    const inputCls = [
-        'w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-slate-700 text-base',
-        'focus:outline-none focus:border-[#C9A84C] transition-colors duration-200 placeholder:text-slate-400',
-    ].join(' ');
+    const canSubmit = !isSubmitting &&
+        consentChecked &&
+        nameValue.trim().length > 0 &&
+        orgNameValue.trim().length > 0 &&
+        emailValue.trim().length > 0 &&
+        phoneValue.trim().length > 0;
+
+    const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-700 text-sm focus:outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] transition-colors duration-200 placeholder:text-slate-400";
+    const labelCls = "block text-slate-700 font-medium text-sm mb-1.5";
 
     /* ÔöÇÔöÇ Shared nav bar ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
     const Navbar = (
-        <nav className="bg-[#0B1E36] border-b border-white/10 px-6 md:px-10 py-4 flex items-center justify-between">
+        <nav className="bg-[#0B1E36] border-b border-white/10 px-6 md:px-10 py-4 flex items-center justify-between sticky top-0 z-50">
             <button
-                onClick={step === 2 && !submitted ? () => setStep(1) : onBack}
+                onClick={onBack}
                 className="flex items-center gap-2 text-slate-300 hover:text-white text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] rounded"
-                aria-label={step === 2 && !submitted ? 'Go back to option selection' : 'Return to home page'}
+                aria-label="Return to home page"
             >
                 <ArrowLeft className="w-4 h-4" />
-                {step === 2 && !submitted ? 'Back' : 'Back to home'}
+                Back to home
             </button>
             <div className="flex items-center gap-2">
                 <Shield className="w-5 h-5 text-[#C9A84C]" aria-hidden="true" />
@@ -307,44 +118,23 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
     /* ÔöÇÔöÇ Confirmation screen ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
     if (submitted) {
         return (
-            <div className="min-h-screen bg-[#0B1E36] flex flex-col">
-                <nav className="bg-[#0B1E36] border-b border-white/10 px-6 md:px-10 py-4 flex items-center justify-between">
-                    <button
-                        onClick={onBack}
-                        className="flex items-center gap-2 text-slate-300 hover:text-white text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] rounded"
-                        aria-label="Return to home page"
-                    >
-                        <ArrowLeft className="w-4 h-4" />
-                        Back to home
-                    </button>
-                    <div className="flex items-center gap-2">
-                        <Shield className="w-5 h-5 text-[#C9A84C]" aria-hidden="true" />
-                        <span className="text-white text-sm font-semibold tracking-tight" style={{ fontFamily: "'Merriweather', serif" }}>
-                            Second Look <span className="text-[#C9A84C]">Protect</span>
-                        </span>
-                    </div>
-                </nav>
+            <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-[#C9A84C]/30 selection:text-[#0B1E36]">
+                {Navbar}
                 <main className="flex-1 flex items-center justify-center px-6 py-16">
-                    <div className="max-w-md w-full text-center bg-[#FAFAF8] rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.15)] border border-white/10 px-8 py-12">
-                        <div className="w-20 h-20 rounded-full bg-[#C9A84C]/15 flex items-center justify-center mx-auto mb-8">
+                    <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-sm border border-slate-100 px-8 py-12">
+                        <div className="w-20 h-20 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mx-auto mb-8">
                             <CheckCircle className="w-10 h-10 text-[#C9A84C]" />
                         </div>
-                        <h1 className="text-[#0B1E36] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
-                            Request securely received.
+                        <h1 className="text-[#0B1E36] text-2xl mb-3" style={{ fontFamily: "'Merriweather', serif" }}>
+                            Request received.
                         </h1>
-                        <p className="text-slate-400 text-xs mb-4">Your organisation's submission is securely logged.</p>
-                        <p className="text-slate-600 text-lg leading-relaxed mb-4">
-                            A UK-based specialist will review your submission and respond promptly.
-                            <br /><br />
-                            <span className="text-slate-500 text-base">Clear, structured safeguarding support.</span>
-                        </p>
-                        <p className="text-slate-400 text-sm leading-relaxed mb-10">
-                            The incident has been recorded. We will review the details and provide next steps shortly.
+                        <p className="text-slate-500 text-sm leading-relaxed mb-8">
+                            Thank you. Your demo request has been securely logged. A specialist will review your details and reach out shortly to arrange a walkthrough time that suits you.
                         </p>
                         <Button
                             onClick={onBack}
-                            variant="secondary"
-                            className="border-[#0B1E36]"
+                            variant="primary"
+                            className="w-full justify-center"
                             aria-label="Return to the Second Look Protect home page"
                         >
                             Return to home
@@ -355,410 +145,267 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
         );
     }
 
-    /* ÔöÇÔöÇ Step 1: Select option ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
-    if (step === 1) {
-        return (
-            <div className="min-h-screen bg-[#0B1E36] flex flex-col">
-                <style>{SLP_MOBILE_CSS}</style>
-                {Navbar}
-                <main className="flex-1 flex items-start justify-center px-6 py-12 md:py-20">
-                    <div className="w-full max-w-xl bg-[#FAFAF8] rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.15)] border border-white/10 px-6 md:px-10 py-8 md:py-12">
-                        <div className="flex items-center justify-between mb-8">
-                            <StepIndicator step={1} total={2} />
-                            <span className="text-slate-400 text-xs">Step 1 of 2</span>
-                        </div>
-                        <div className="mb-10">
-                            <p className="text-[#A8853C] text-xs font-semibold tracking-widest uppercase mb-3">
-                                Step 1 of 2 ÔÇö Choose submission type
-                            </p>
-                            <h1 className="text-[#0B1E36] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
-                                Submit a concern or request a platform demo
-                            </h1>
-                            <p className="text-slate-400 text-xs mb-3">Secure, confidential handling.</p>
-                            <p className="text-slate-500 text-base leading-relaxed max-w-prose mb-3">
-                                Use this secure form to upload a suspicious incident for review, or to request a practical walkthrough of the Second Look Protect platform to see how it supports manager oversight and inspection readiness.
-                            </p>
-
-                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
-                                Upload incident evidence to test the review process, paste a link, or request a full demo.
-                            </p>
-                        </div>
-                        <div className="space-y-3 mb-10" role="radiogroup" aria-label="Submission type">
-                            {OPTIONS.map((opt) => (
-                                <React.Fragment key={opt.id}>
-                                    <OptionCard
-                                        icon={opt.icon}
-                                        title={opt.title}
-                                        description={opt.description}
-                                        selected={selectedOption === opt.id}
-                                        onClick={() => handleOptionSelect(opt.id)}
-                                    />
-                                    {selectedOption === opt.id && (
-                                        <div
-                                            className="flex flex-col gap-3 pl-2"
-                                            style={{
-                                                animation: 'slpFadeIn 0.3s ease-out',
-                                            }}
-                                        >
-                                            <style>{`@keyframes slpFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
-                                            <p className="text-[#A8853C] text-sm font-medium">
-                                                You chose: {opt.title}
-                                            </p>
-                                            <Button
-                                                onClick={handleContinue}
-                                                size="lg"
-                                                className="slp-continue-btn w-full justify-center font-semibold border-0"
-                                                aria-label="Continue to step 2"
-                                            >
-                                                Continue <ChevronRight className="w-5 h-5" />
-                                            </Button>
-                                        </div>
-                                    )}
-                                </React.Fragment>
-                            ))}
-                        </div>
-                        <div className="flex flex-col gap-3">
-                            <p className="text-center text-slate-400 text-xs">Your submission is treated with full confidentiality.</p>
-                        </div>
-                        <div className="mt-10 pt-8 border-t border-slate-200 flex flex-wrap justify-center gap-6 text-slate-400 text-xs">
-                            <span>Ô£ô UK-Based Specialists</span>
-                            <span>Ô£ô Human-Reviewed</span>
-                        </div>
-
-                        {/* ÔöÇÔöÇ Support section ÔöÇÔöÇ */}
-                        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
-                            <p className="text-slate-400 text-xs font-medium tracking-wide uppercase mb-4">Need help instead?</p>
-                            <div className="flex flex-col gap-3 max-w-md mx-auto">
-                                <a
-                                    href="tel:01604385888"
-                                    className="slp-support-btn inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-[#C9A84C]/40 text-[#0B1E36] text-base font-semibold hover:bg-[#C9A84C]/10 transition-colors duration-200 whitespace-nowrap"
-                                >
-                                    <Phone className="w-5 h-5 text-[#C9A84C]" />
-                                    Call ÔÇö 01604 385888
-                                </a>
-                                <a
-                                    href="sms:07907614821"
-                                    className="slp-support-btn inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-[#C9A84C]/40 text-[#0B1E36] text-base font-semibold hover:bg-[#C9A84C]/10 transition-colors duration-200 whitespace-nowrap"
-                                >
-                                    <MessageSquare className="w-5 h-5 text-[#C9A84C]" />
-                                    Text ÔÇö 07907 614821
-                                </a>
-                                <a
-                                    href="mailto:hello@secondlookprotect.co.uk"
-                                    className="slp-support-btn inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-[#C9A84C]/40 text-[#0B1E36] font-semibold hover:bg-[#C9A84C]/10 transition-colors duration-200 w-full"
-                                >
-                                    <Mail className="w-5 h-5 text-[#C9A84C] shrink-0 self-center" />
-                                    <span className="flex flex-col items-start leading-tight">
-                                        <span className="slp-email-label text-base">Email</span>
-                                        <span className="slp-email-addr text-sm font-normal text-slate-500">hello@secondlookprotect.co.uk</span>
-                                    </span>
-                                </a>
-                            </div>
-                        </div>
-                    </div>
-                </main>
-            </div>
-        );
-    }
-
-    /* ÔöÇÔöÇ Step 2: Submit details ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
+    /* ÔöÇÔöÇ Main Demo Booking Form ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
     return (
-        <div className="min-h-screen bg-[#0B1E36] flex flex-col">
-            <style>{SLP_MOBILE_CSS}</style>
+        <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-[#C9A84C]/30 selection:text-[#0B1E36]">
             {Navbar}
-            <main className="flex-1 flex items-start justify-center px-6 py-12 md:py-20">
-                <div className="w-full max-w-xl bg-[#FAFAF8] rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.15)] border border-white/10 px-6 md:px-10 py-8 md:py-12">
-                    <div className="flex items-center justify-between mb-8">
-                        <StepIndicator step={2} total={2} />
-                        <span className="text-slate-400 text-xs">Step 2 of 2</span>
-                    </div>
 
-                    <div className="mb-10">
-                        <p className="text-[#A8853C] text-xs font-semibold tracking-widest uppercase mb-3">
-                            Step 2 of 2 ÔÇö Provide details
-                        </p>
-                        <h1 className="text-[#0B1E36] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
-                            {selectedOption === 'screenshot' ? 'Upload evidence for review'
-                                : selectedOption === 'link' ? 'Paste the suspicious link'
-                                    : 'Enter contact or demo details'}
+            <main className="flex-1 max-w-6xl mx-auto w-full px-6 md:px-10 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
+
+                {/* ÔöÇÔöÇ Left Column: Value Prop & Messaging ÔöÇÔöÇ */}
+                <div className="lg:col-span-6 flex flex-col gap-10">
+
+                    {/* Hero Text */}
+                    <div>
+                        <div className="flex items-center gap-3 mb-6">
+                            <div className="w-1 h-4 bg-[#C9A84C] rounded-full" aria-hidden="true" />
+                            <span className="text-[#C9A84C] text-[11px] font-semibold tracking-widest uppercase">
+                                PRACTICAL PLATFORM DEMO
+                            </span>
+                        </div>
+                        <h1 className="text-[#0B1E36] text-3xl md:text-4xl leading-tight mb-5" style={{ fontFamily: "'Merriweather', serif" }}>
+                            Book a practical walkthrough for your care organisation
                         </h1>
-                        <p className="text-slate-400 text-xs mb-3">Secure, confidential handling.</p>
-                        <p className="text-slate-500 text-base leading-relaxed max-w-prose">
-                            {selectedOption === 'screenshot'
-                                ? 'Attach a screenshot of the suspicious communication. Your concern will be securely reviewed in our safeguarding environment.'
-                                : selectedOption === 'link'
-                                    ? 'Paste the full URL (starting with https://) that you would like us to check for your organisation.'
-                                    : 'Enter the phone number, email address, or contact name you want us to verify, or leave a note requesting a demo.'}
+                        <p className="text-slate-600 text-lg leading-relaxed mb-4">
+                            See how Second Look Protect helps care homes and care groups log scam related safeguarding concerns, review cases clearly, track developing trends, and strengthen inspection ready oversight through one clear platform.
+                        </p>
+                        <p className="text-slate-500 text-sm font-medium italic bg-white inline-block px-4 py-2 rounded-lg border border-slate-100 shadow-sm">
+                            A calm, structured walkthrough for care providers. No pressure. No technical jargon.
                         </p>
                     </div>
 
-                    {/* ÔöÇÔöÇ Screenshot upload ÔöÇÔöÇ */}
-                    {selectedOption === 'screenshot' && (
-                        <div className="mb-8">
-                            {!file ? (
-                                <button
-                                    onClick={() => fileInputRef.current?.click()}
-                                    className={[
-                                        'w-full border-2 border-dashed border-slate-300 rounded-xl p-10',
-                                        'flex flex-col items-center justify-center gap-3 cursor-pointer',
-                                        'hover:border-[#C9A84C]/50 hover:bg-[#C9A84C]/3 transition-all duration-200',
-                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]',
-                                    ].join(' ')}
-                                    aria-label="Click to select an image file"
-                                >
-                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
-                                        <Image className="w-6 h-6 text-slate-400" />
-                                    </div>
-                                    <div className="text-center">
-                                        <p className="text-slate-600 font-medium text-sm">Click to upload a file</p>
-                                        <p className="text-slate-400 text-xs mt-1">Optional ┬À JPG, PNG, WEBP, PDF</p>
-                                    </div>
-                                </button>
-                            ) : (
-                                <div className="relative rounded-xl overflow-hidden border-2 border-[#C9A84C]/30 bg-white">
-                                    <img
-                                        src={previewUrl ?? ''}
-                                        alt="Preview of uploaded screenshot"
-                                        className="w-full max-h-64 object-contain"
-                                    />
-                                    <button
-                                        onClick={clearFile}
-                                        className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
-                                        aria-label="Remove selected image"
-                                    >
-                                        <X className="w-4 h-4 text-slate-600" />
-                                    </button>
-                                    <div className="px-4 py-3 border-t border-slate-100">
-                                        <p className="text-slate-600 text-sm font-medium truncate">{file.name}</p>
-                                        <p className="text-slate-400 text-xs">{(file.size / 1024).toFixed(0)} KB</p>
-                                    </div>
-                                </div>
-                            )}
-                            <input
-                                ref={fileInputRef}
-                                type="file"
-                                accept="image/*"
-                                onChange={handleFileChange}
-                                className="sr-only"
-                                aria-label="Image file input"
-                            />
-                        </div>
-                    )}
+                    {/* Image */}
+                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white p-2">
+                        <img
+                            src="/images/demo-page.png"
+                            alt="Second Look Protect platform overview"
+                            className="w-full rounded-xl"
+                        />
+                    </div>
 
-                    {/* ÔöÇÔöÇ Link input ÔöÇÔöÇ */}
-                    {selectedOption === 'link' && (
-                        <div className="mb-8">
-                            <label htmlFor="link-input" className="block text-slate-700 font-medium text-sm mb-2">
-                                Suspicious URL
-                            </label>
-                            <input
-                                id="link-input"
-                                type="url"
-                                placeholder="https://example.com/suspicious-page"
-                                value={linkValue}
-                                onChange={(e) => { setLinkValue(e.target.value); setSubmitError(null); }}
-                                className={[
-                                    'w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-slate-700 text-base',
-                                    'focus:outline-none focus:border-[#C9A84C] transition-colors duration-200',
-                                    'placeholder:text-slate-400',
-                                ].join(' ')}
-                                autoComplete="off"
-                                spellCheck={false}
-                            />
-                        </div>
-                    )}
+                    {/* What the demo covers */}
+                    <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
+                        <h2 className="text-[#0B1E36] font-semibold text-lg mb-5" style={{ fontFamily: "'Merriweather', serif" }}>
+                            What the demo covers
+                        </h2>
+                        <ul className="space-y-4">
+                            {[
+                                { icon: FileText, text: 'How staff can log safeguarding concerns clearly' },
+                                { icon: ClipboardCheck, text: 'How managers can review and oversee cases' },
+                                { icon: LayoutDashboard, text: 'How trend reporting helps teams stay aware of scam patterns' },
+                                { icon: Shield, text: 'How the platform supports governance and inspection readiness' },
+                                { icon: Building2, text: 'How the system could fit your organisationÔÇÖs workflow' },
+                            ].map((item, i) => (
+                                <li key={i} className="flex items-start gap-3">
+                                    <div className="w-6 h-6 rounded bg-[#C9A84C]/10 flex items-center justify-center shrink-0 mt-0.5">
+                                        <item.icon className="w-3.5 h-3.5 text-[#C9A84C]" />
+                                    </div>
+                                    <span className="text-slate-600 text-sm leading-relaxed">{item.text}</span>
+                                </li>
+                            ))}
+                        </ul>
+                    </div>
 
-                    {/* ÔöÇÔöÇ Contact input ÔöÇÔöÇ */}
-                    {selectedOption === 'contact' && (
-                        <div className="mb-8">
-                            <label htmlFor="contact-input" className="block text-slate-700 font-medium text-sm mb-2">
-                                Phone number, email, or contact name
-                            </label>
-                            <input
-                                id="contact-input"
-                                type="text"
-                                placeholder="+44 7700 000000 or name@example.com"
-                                value={contactValue}
-                                onChange={(e) => { setContactValue(e.target.value); setSubmitError(null); }}
-                                className={[
-                                    'w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-slate-700 text-base',
-                                    'focus:outline-none focus:border-[#C9A84C] transition-colors duration-200',
-                                    'placeholder:text-slate-400',
-                                ].join(' ')}
-                            />
+                    {/* Who this is for */}
+                    <div>
+                        <p className="text-slate-500 text-sm font-medium uppercase tracking-wide mb-4">Designed for:</p>
+                        <div className="flex flex-wrap gap-2">
+                            {['Care home managers', 'Safeguarding leads', 'Compliance managers', 'Operations leaders', 'Care groups supporting vulnerable residents'].map((tag) => (
+                                <span key={tag} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-600 font-medium shadow-sm">
+                                    <Users className="w-3 h-3 text-[#C9A84C]" />
+                                    {tag}
+                                </span>
+                            ))}
                         </div>
-                    )}
+                    </div>
+                </div>
 
-                    {/* ÔöÇÔöÇ Contact details ÔöÇÔöÇ */}
-                    <div className="mb-8 space-y-4 border-t border-slate-200 pt-8">
-                        <p className="text-slate-700 font-semibold text-sm">Your contact details</p>
+                {/* ÔöÇÔöÇ Right Column: Form ÔöÇÔöÇ */}
+                <div className="lg:col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-10 lg:sticky lg:top-28">
+                    <div className="mb-8">
+                        <h2 className="text-[#0B1E36] font-semibold text-[22px] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
+                            Request a demo
+                        </h2>
+                        <p className="text-slate-500 text-sm">
+                            Tell us a little about your organisation or what you would like to see in the demo.
+                        </p>
+                    </div>
 
-                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
-                            {/* Name */}
+                    <form onSubmit={handleSubmit} className="space-y-5">
+                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                             <div>
-                                <label htmlFor="name-input" className="block text-slate-600 text-sm mb-1">
-                                    Name <span className="text-red-500" aria-label="required">*</span>
-                                </label>
+                                <label htmlFor="name" className={labelCls}>Full name <span className="text-red-500">*</span></label>
                                 <input
-                                    id="name-input"
+                                    id="name"
                                     type="text"
-                                    placeholder="Your full name"
-                                    value={nameValue}
-                                    onChange={(e) => { setNameValue(e.target.value); setSubmitError(null); }}
                                     required
                                     className={inputCls}
+                                    placeholder="Jane Doe"
+                                    value={nameValue}
+                                    onChange={(e) => { setNameValue(e.target.value); setSubmitError(null); }}
                                 />
                             </div>
-
-                            {/* Email */}
                             <div>
-                                <label htmlFor="email-input" className="block text-slate-600 text-sm mb-1">
-                                    Email <span className="text-red-500" aria-label="required">*</span>
-                                </label>
+                                <label htmlFor="email" className={labelCls}>Work email <span className="text-red-500">*</span></label>
                                 <input
-                                    id="email-input"
+                                    id="email"
                                     type="email"
-                                    placeholder="your@email.com"
-                                    value={emailValue}
-                                    onChange={(e) => { setEmailValue(e.target.value); setSubmitError(null); }}
                                     required
                                     className={inputCls}
+                                    placeholder="jane@caregroup.co.uk"
+                                    value={emailValue}
+                                    onChange={(e) => { setEmailValue(e.target.value); setSubmitError(null); }}
                                 />
                             </div>
                         </div>
 
-                        {/* Phone */}
                         <div>
-                            <label htmlFor="phone-input" className="block text-slate-600 text-sm mb-1">
-                                Phone Number <span className="text-red-500" aria-label="required">*</span>
-                            </label>
+                            <label htmlFor="phone" className={labelCls}>Phone number <span className="text-red-500">*</span></label>
                             <input
-                                id="phone-input"
+                                id="phone"
                                 type="tel"
-                                placeholder="+44 7700 000000"
+                                required
+                                className={inputCls}
+                                placeholder="07700 900000"
                                 value={phoneValue}
                                 onChange={(e) => { setPhoneValue(e.target.value); setSubmitError(null); }}
-                                required
+                            />
+                        </div>
+
+                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5 mt-5">
+                            <div>
+                                <label htmlFor="orgName" className={labelCls}>Organisation name <span className="text-red-500">*</span></label>
+                                <input
+                                    id="orgName"
+                                    type="text"
+                                    required
+                                    className={inputCls}
+                                    placeholder="Organisation Name"
+                                    value={orgNameValue}
+                                    onChange={(e) => { setOrgNameValue(e.target.value); setSubmitError(null); }}
+                                />
+                            </div>
+                            <div>
+                                <label htmlFor="orgType" className={labelCls}>Organisation type</label>
+                                <select
+                                    id="orgType"
+                                    className={inputCls}
+                                    value={orgTypeValue}
+                                    onChange={(e) => { setOrgTypeValue(e.target.value); setSubmitError(null); }}
+                                >
+                                    <option value="" disabled>Select type...</option>
+                                    <option value="Care home">Care home</option>
+                                    <option value="Care group">Care group</option>
+                                    <option value="Assisted living">Assisted living</option>
+                                    <option value="Supported living">Supported living</option>
+                                    <option value="Other care provider">Other care provider</option>
+                                </select>
+                            </div>
+                        </div>
+
+                        <div>
+                            <label htmlFor="role" className={labelCls}>Your role</label>
+                            <input
+                                id="role"
+                                type="text"
                                 className={inputCls}
+                                placeholder="e.g. Care Home Manager, Compliance Lead"
+                                value={roleValue}
+                                onChange={(e) => { setRoleValue(e.target.value); setSubmitError(null); }}
                             />
                         </div>
 
-                        {/* Message ÔÇö required for all types */}
                         <div>
-                            <label htmlFor="note-input" className="block text-slate-600 text-sm mb-1">
-                                Message <span className="text-red-500" aria-label="required">*</span>
-                            </label>
+                            <label htmlFor="note" className={labelCls}>Optional message</label>
                             <textarea
-                                id="note-input"
-                                placeholder="Please provide more info on the link or email you are reporting..."
+                                id="note"
+                                className={inputCls + " resize-none"}
+                                rows={3}
+                                placeholder="Any specific challenges you're facing or features you'd like to focus on?"
                                 value={noteValue}
                                 onChange={(e) => { setNoteValue(e.target.value); setSubmitError(null); }}
-                                required
-                                rows={4}
-                                className={inputCls + ' resize-none'}
                             />
                         </div>
-                    </div>
 
-                    {/* ÔöÇÔöÇ Privacy consent checkbox ÔöÇÔöÇ */}
-                    <div className="mb-4">
-                        <label className="flex items-start gap-3 cursor-pointer group">
-                            <input
-                                id="consent-checkbox"
-                                type="checkbox"
-                                checked={consentChecked}
-                                onChange={(e) => { setConsentChecked(e.target.checked); if (e.target.checked) setConsentError(false); }}
-                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-slate-300 accent-[#C9A84C] cursor-pointer"
-                                aria-required="true"
-                                aria-describedby={consentError ? 'consent-error' : undefined}
-                            />
-                            <span className="text-slate-600 text-sm leading-relaxed">
-                                I understand my information will be handled securely in line with the{' '}
-                                <a
-                                    href="/privacy-policy"
-                                    className="text-[#A8853C] underline underline-offset-2 hover:text-[#C9A84C] transition-colors"
-                                    target="_blank"
-                                    rel="noopener noreferrer"
-                                >
-                                    Privacy Policy
-                                </a>
-                                , and that this service provides organisational safeguarding guidance, not financial or legal advice.
-                            </span>
-                        </label>
-                        {consentError && (
-                            <p id="consent-error" role="alert" className="mt-2 ml-7 text-red-600 text-xs">
-                                Please confirm you understand how your information will be used.
-                            </p>
-                        )}
-                    </div>
-
-                    {/* ÔöÇÔöÇ Error message ÔöÇÔöÇ */}
-                    {submitError && (
-                        <div
-                            role="alert"
-                            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm"
-                        >
-                            {submitError}
+                        {/* Privacy consent checkbox */}
+                        <div className="pt-2">
+                            <label className="flex items-start gap-3 cursor-pointer group">
+                                <input
+                                    type="checkbox"
+                                    checked={consentChecked}
+                                    onChange={(e) => { setConsentChecked(e.target.checked); if (e.target.checked) setConsentError(false); }}
+                                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#C9A84C] cursor-pointer"
+                                />
+                                <span className="text-slate-500 text-xs leading-relaxed">
+                                    I agree to the <a href="/privacy-policy" onClick={(e) => { e.preventDefault(); window.open('/privacy-policy', '_blank'); }} className="text-[#A8853C] hover:underline">Privacy Policy</a> and consent to being contacted regarding this request.
+                                </span>
+                            </label>
+                            {consentError && (
+                                <p className="mt-1 ml-7 text-red-600 text-[11px]">Please accept the privacy policy to continue.</p>
+                            )}
                         </div>
-                    )}
 
-                    {/* ÔöÇÔöÇ Submit ÔöÇÔöÇ */}
-                    <div className="flex flex-col gap-3">
-                        <Button
-                            onClick={handleSubmit}
-                            disabled={!canSubmit}
-                            size="lg"
-                            className={[
-                                'w-full justify-center font-semibold transition-all duration-200 border-0',
-                                canSubmit
-                                    ? 'bg-[#0B1E36] text-white hover:bg-[#1C3256] active:scale-[0.98] transition-colors duration-200'
-                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed',
-                            ].join(' ')}
-                            aria-label="Submit your check for review"
-                            aria-busy={isSubmitting}
-                        >
-                            {isSubmitting ? 'SubmittingÔÇª' : 'Submit for Review'}
-                        </Button>
-                        <p className="text-center text-slate-400 text-xs">Your submission is treated with full confidentiality.</p>
-                    </div>
+                        {submitError && (
+                            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
+                                {submitError}
+                            </div>
+                        )}
 
-                    <div className="mt-10 pt-8 border-t border-slate-200 flex flex-wrap justify-center gap-6 text-slate-400 text-xs">
-                        <span>Ô£ô UK-Based Specialists</span>
-                        <span>Ô£ô Human-Reviewed</span>
-                    </div>
+                        <div className="pt-4 flex flex-col gap-3">
+                            <Button
+                                type="submit"
+                                disabled={!canSubmit}
+                                size="lg"
+                                className="w-full justify-center transition-all duration-200"
+                            >
+                                {isSubmitting ? 'Submitting...' : 'Request a demo'}
+                            </Button>
+
+                            <div className="text-center">
+                                <span className="text-slate-400 text-xs">ÔÇö or ÔÇö</span>
+                            </div>
 
-                    {/* ÔöÇÔöÇ Support section ÔöÇÔöÇ */}
-                    <div className="mt-8 pt-6 border-t border-slate-200 text-center">
-                        <p className="text-slate-400 text-xs font-medium tracking-wide uppercase mb-4">Need help instead?</p>
-                        <div className="flex flex-col gap-3 max-w-md mx-auto">
                             <a
                                 href="tel:01604385888"
-                                className="slp-support-btn inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-[#C9A84C]/40 text-[#0B1E36] text-base font-semibold hover:bg-[#C9A84C]/10 transition-colors duration-200 whitespace-nowrap"
-                            >
-                                <Phone className="w-5 h-5 text-[#C9A84C]" />
-                                Call ÔÇö 01604 385888
-                            </a>
-                            <a
-                                href="sms:07907614821"
-                                className="slp-support-btn inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-[#C9A84C]/40 text-[#0B1E36] text-base font-semibold hover:bg-[#C9A84C]/10 transition-colors duration-200 whitespace-nowrap"
-                            >
-                                <MessageSquare className="w-5 h-5 text-[#C9A84C]" />
-                                Text ÔÇö 07907 614821
-                            </a>
-                            <a
-                                href="mailto:hello@secondlookprotect.co.uk"
-                                className="slp-support-btn inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-[#C9A84C]/40 text-[#0B1E36] font-semibold hover:bg-[#C9A84C]/10 transition-colors duration-200 w-full"
+                                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-sm font-medium hover:bg-slate-100 hover:text-slate-900 transition-colors"
                             >
-                                <Mail className="w-5 h-5 text-[#C9A84C] shrink-0 self-center" />
-                                <span className="flex flex-col items-start leading-tight">
-                                    <span className="slp-email-label text-base">Email</span>
-                                    <span className="slp-email-addr text-sm font-normal text-slate-500">hello@secondlookprotect.co.uk</span>
-                                </span>
+                                <Phone className="w-4 h-4 text-slate-400" />
+                                Call to discuss first
                             </a>
                         </div>
+                    </form>
+
+                    {/* Contact Reassurance */}
+                    <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4 text-center">
+                        <div>
+                            <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Office Line</p>
+                            <p className="text-slate-700 text-sm font-medium">01604 385888</p>
+                        </div>
+                        <div>
+                            <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Mobile / WhatsApp</p>
+                            <p className="text-slate-700 text-sm font-medium">07907 614821</p>
+                        </div>
+                        <div className="col-span-2 mt-2">
+                            <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Email Enquiries</p>
+                            <p className="text-slate-700 text-sm font-medium">hello@secondlookprotect.co.uk</p>
+                        </div>
                     </div>
                 </div>
+
             </main>
+
+            {/* Closing Reassurance Block */}
+            <section className="bg-white border-t border-slate-200 py-16">
+                <div className="max-w-3xl mx-auto px-6 text-center">
+                    <Shield className="w-8 h-8 text-[#C9A84C] mx-auto mb-6" />
+                    <p className="text-[#0B1E36] text-lg md:text-xl leading-relaxed font-medium mb-3" style={{ fontFamily: "'Merriweather', serif" }}>
+                        Second Look Protect is built to help care providers handle scam related safeguarding concerns with clearer oversight, stronger reporting, and a more confident response process.
+                    </p>
+                    <p className="text-slate-500 text-sm">
+                        Useful for teams who want a clearer safeguarding workflow without adding complexity.
+                    </p>
+                </div>
+            </section>
         </div>
     );
 }

commit e47f9b3e7de05aa2ea4e9874c4d0cc701a5b79a0
Author: Kiera <kiera@secondlookprotect.co.uk>
Date:   Fri Mar 13 12:41:23 2026 +0000

    Update visual proof framing on public pages

diff --git a/src/pages/GetProtectionPage.tsx b/src/pages/GetProtectionPage.tsx
index 6a494d3..0c8e45f 100644
--- a/src/pages/GetProtectionPage.tsx
+++ b/src/pages/GetProtectionPage.tsx
@@ -94,7 +94,7 @@ const OPTIONS = [
     {
         id: 'screenshot',
         icon: <Upload className="w-5 h-5" />,
-        title: 'Upload a screenshot or file',
+        title: 'Upload evidence for review',
         description: 'Securely upload a suspicious message, email, invoice, or document for review.',
     },
     {
@@ -380,7 +380,7 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
                             </p>
 
                             <p className="text-slate-500 text-sm leading-relaxed mb-6">
-                                Upload a screenshot to test the review process, paste a link, or request a full demo.
+                                Upload incident evidence to test the review process, paste a link, or request a full demo.
                             </p>
                         </div>
                         <div className="space-y-3 mb-10" role="radiogroup" aria-label="Submission type">
@@ -478,14 +478,14 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
                             Step 2 of 2 ÔÇö Provide details
                         </p>
                         <h1 className="text-[#0B1E36] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
-                            {selectedOption === 'screenshot' ? 'Upload your file'
+                            {selectedOption === 'screenshot' ? 'Upload evidence for review'
                                 : selectedOption === 'link' ? 'Paste the suspicious link'
                                     : 'Enter contact or demo details'}
                         </h1>
                         <p className="text-slate-400 text-xs mb-3">Secure, confidential handling.</p>
                         <p className="text-slate-500 text-base leading-relaxed max-w-prose">
                             {selectedOption === 'screenshot'
-                                ? 'Attach a screenshot or document for review. Fill in your details below and our team will securely assess it.'
+                                ? 'Attach a screenshot of the suspicious communication. Your concern will be securely reviewed in our safeguarding environment.'
                                 : selectedOption === 'link'
                                     ? 'Paste the full URL (starting with https://) that you would like us to check for your organisation.'
                                     : 'Enter the phone number, email address, or contact name you want us to verify, or leave a note requesting a demo.'}

commit 08961b3ac1bd71457d2b3007fdd65f274dff54aa
Author: Kiera <kiera@secondlookprotect.co.uk>
Date:   Fri Mar 13 12:28:35 2026 +0000

    feat(web): strengthen founder demo flow and commercial journey across public site

diff --git a/src/pages/GetProtectionPage.tsx b/src/pages/GetProtectionPage.tsx
index 002cf40..6a494d3 100644
--- a/src/pages/GetProtectionPage.tsx
+++ b/src/pages/GetProtectionPage.tsx
@@ -106,8 +106,8 @@ const OPTIONS = [
     {
         id: 'contact',
         icon: <Phone className="w-5 h-5" />,
-        title: 'Verify a contact or request a demo',
-        description: 'Verify if a caller is legitimate, or request a call back to discuss the platform.',
+        title: 'Request a platform walkthough',
+        description: 'See structured logging, manager review, and inspection reporting in action.',
     },
 ];
 
@@ -376,11 +376,11 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
                             </h1>
                             <p className="text-slate-400 text-xs mb-3">Secure, confidential handling.</p>
                             <p className="text-slate-500 text-base leading-relaxed max-w-prose mb-3">
-                                Use this secure form to upload a suspicious incident for review, or to request a practical walkthrough of the Second Look Protect platform for your organisation.
+                                Use this secure form to upload a suspicious incident for review, or to request a practical walkthrough of the Second Look Protect platform to see how it supports manager oversight and inspection readiness.
                             </p>
 
                             <p className="text-slate-500 text-sm leading-relaxed mb-6">
-                                You can upload a screenshot, paste a link, or securely provide contact details to verify.
+                                Upload a screenshot to test the review process, paste a link, or request a full demo.
                             </p>
                         </div>
                         <div className="space-y-3 mb-10" role="radiogroup" aria-label="Submission type">

commit ce790795b0705619246621ae56753fc3de017a6c
Author: Kiera <kiera@secondlookprotect.co.uk>
Date:   Fri Mar 13 12:18:14 2026 +0000

    feat(web): finalize b2b care sector copy consistency across site

diff --git a/src/pages/GetProtectionPage.tsx b/src/pages/GetProtectionPage.tsx
index f01ae5e..002cf40 100644
--- a/src/pages/GetProtectionPage.tsx
+++ b/src/pages/GetProtectionPage.tsx
@@ -94,20 +94,20 @@ const OPTIONS = [
     {
         id: 'screenshot',
         icon: <Upload className="w-5 h-5" />,
-        title: 'Upload a screenshot',
-        description: 'Send a screenshot of a suspicious message, email, or website.',
+        title: 'Upload a screenshot or file',
+        description: 'Securely upload a suspicious message, email, invoice, or document for review.',
     },
     {
         id: 'link',
         icon: <Link2 className="w-5 h-5" />,
         title: 'Submit a suspicious link',
-        description: 'Paste a URL you are unsure about ÔÇö we will check what is behind it.',
+        description: 'Paste a URL your team is unsure about ÔÇö we will assess the risk.',
     },
     {
         id: 'contact',
         icon: <Phone className="w-5 h-5" />,
-        title: 'Request contact verification',
-        description: 'Verify if a phone number, email address, or caller is legitimate.',
+        title: 'Verify a contact or request a demo',
+        description: 'Verify if a caller is legitimate, or request a call back to discuss the platform.',
     },
 ];
 
@@ -330,16 +330,16 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
                             <CheckCircle className="w-10 h-10 text-[#C9A84C]" />
                         </div>
                         <h1 className="text-[#0B1E36] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
-                            Request received.
+                            Request securely received.
                         </h1>
-                        <p className="text-slate-400 text-xs mb-4">You are taking a second look.</p>
+                        <p className="text-slate-400 text-xs mb-4">Your organisation's submission is securely logged.</p>
                         <p className="text-slate-600 text-lg leading-relaxed mb-4">
                             A UK-based specialist will review your submission and respond promptly.
                             <br /><br />
-                            <span className="text-slate-500 text-base">No judgement. No pressure. Just clarity.</span>
+                            <span className="text-slate-500 text-base">Clear, structured safeguarding support.</span>
                         </p>
                         <p className="text-slate-400 text-sm leading-relaxed mb-10">
-                            You've done the right thing. There's no need to rush. We will review this for you.
+                            The incident has been recorded. We will review the details and provide next steps shortly.
                         </p>
                         <Button
                             onClick={onBack}
@@ -369,18 +369,18 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
                         </div>
                         <div className="mb-10">
                             <p className="text-[#A8853C] text-xs font-semibold tracking-widest uppercase mb-3">
-                                Step 1 of 2 ÔÇö Choose your check type
+                                Step 1 of 2 ÔÇö Choose submission type
                             </p>
                             <h1 className="text-[#0B1E36] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
-                                Not sure if something is safe? Let's take a second look.
+                                Submit a concern or request a platform demo
                             </h1>
-                            <p className="text-slate-400 text-xs mb-3">You are taking a second look.</p>
+                            <p className="text-slate-400 text-xs mb-3">Secure, confidential handling.</p>
                             <p className="text-slate-500 text-base leading-relaxed max-w-prose mb-3">
-                                If something doesn't feel right, simply upload it below ÔÇö we'll review it and send you a clear, easy-to-understand risk report explaining what's safe, what's risky, and what to do next.
+                                Use this secure form to upload a suspicious incident for review, or to request a practical walkthrough of the Second Look Protect platform for your organisation.
                             </p>
 
                             <p className="text-slate-500 text-sm leading-relaxed mb-6">
-                                You can upload a screenshot, paste a link, or copy the message ÔÇö whichever is easiest for you.
+                                You can upload a screenshot, paste a link, or securely provide contact details to verify.
                             </p>
                         </div>
                         <div className="space-y-3 mb-10" role="radiogroup" aria-label="Submission type">
@@ -478,17 +478,17 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
                             Step 2 of 2 ÔÇö Provide details
                         </p>
                         <h1 className="text-[#0B1E36] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
-                            {selectedOption === 'screenshot' ? 'Upload your screenshot'
+                            {selectedOption === 'screenshot' ? 'Upload your file'
                                 : selectedOption === 'link' ? 'Paste the suspicious link'
-                                    : 'Enter the contact to verify'}
+                                    : 'Enter contact or demo details'}
                         </h1>
-                        <p className="text-slate-400 text-xs mb-3">You are taking a second look.</p>
+                        <p className="text-slate-400 text-xs mb-3">Secure, confidential handling.</p>
                         <p className="text-slate-500 text-base leading-relaxed max-w-prose">
                             {selectedOption === 'screenshot'
-                                ? 'Attach a screenshot if you have one ÔÇö this is optional. Fill in your details below and we will still get back to you.'
+                                ? 'Attach a screenshot or document for review. Fill in your details below and our team will securely assess it.'
                                 : selectedOption === 'link'
-                                    ? 'Paste the full URL (starting with https://) that you would like us to check.'
-                                    : 'Enter the phone number, email address, or contact name you want us to verify.'}
+                                    ? 'Paste the full URL (starting with https://) that you would like us to check for your organisation.'
+                                    : 'Enter the phone number, email address, or contact name you want us to verify, or leave a note requesting a demo.'}
                         </p>
                     </div>
 
@@ -510,8 +510,8 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
                                         <Image className="w-6 h-6 text-slate-400" />
                                     </div>
                                     <div className="text-center">
-                                        <p className="text-slate-600 font-medium text-sm">Click to upload a screenshot</p>
-                                        <p className="text-slate-400 text-xs mt-1">Optional ┬À JPG, PNG, WEBP, GIF</p>
+                                        <p className="text-slate-600 font-medium text-sm">Click to upload a file</p>
+                                        <p className="text-slate-400 text-xs mt-1">Optional ┬À JPG, PNG, WEBP, PDF</p>
                                     </div>
                                 </button>
                             ) : (
@@ -673,7 +673,7 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
                                 aria-describedby={consentError ? 'consent-error' : undefined}
                             />
                             <span className="text-slate-600 text-sm leading-relaxed">
-                                I understand my information will be used to review my enquiry in line with the{' '}
+                                I understand my information will be handled securely in line with the{' '}
                                 <a
                                     href="/privacy-policy"
                                     className="text-[#A8853C] underline underline-offset-2 hover:text-[#C9A84C] transition-colors"
@@ -682,7 +682,7 @@ export function GetProtectionPage({ onBack }: NavigationProps) {
                                 >
                                     Privacy Policy
                                 </a>
-                                , and that this service provides guidance to help me decide what to do next and does not provide financial advice.
+                                , and that this service provides organisational safeguarding guidance, not financial or legal advice.
                             </span>
                         </label>
                         {consentError && (
