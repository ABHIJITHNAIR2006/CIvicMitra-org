import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  CheckCircle2, 
  Upload, 
  FileText, 
  AlertCircle, 
  Loader2, 
  Trophy,
  Search,
  ChevronDown,
  Calendar,
  Building2,
  Users as UsersIcon,
  Phone,
  Mail,
  User as UserIcon,
  Clock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Registration, Submission, useEventData } from '../lib/event-registration-utils';
import { formatDistanceToNow } from 'date-fns';
import { db, auth } from '../firebase';
import { collection, addDoc, updateDoc, doc, increment } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../lib/firestore-guard';

// --- Registration Modal ---

import { updateStats } from "../lib/badge-utils";

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: { id: string; title: string };
  userEmail: string | null;
  onSuccess: (reg: Registration) => void;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({ 
  isOpen, 
  onClose, 
  event, 
  userEmail,
  onSuccess 
}) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: userEmail || '',
    phone: '',
    organization: '',
    teamName: '',
    memberCount: '1',
    agreed: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName) newErrors.fullName = 'Full Name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.phone) newErrors.phone = 'Phone Number is required';
    if (!formData.organization) newErrors.organization = 'College/Organization is required';
    if (!formData.agreed) newErrors.agreed = 'You must agree to the rules';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const registration: Registration = {
        id: Math.random().toString(36).substr(2, 9),
        eventId: event.id,
        eventName: event.title,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        organization: formData.organization,
        teamName: formData.teamName,
        memberCount: formData.memberCount,
        registeredAt: new Date().toISOString(),
        userId: auth.currentUser?.uid
      };

      // 1. Save to private registrations (contains PII)
      await addDoc(collection(db, "event_registrations"), registration)
        .catch(e => handleFirestoreError(e, OperationType.CREATE, "event_registrations"));

      // 2. Save to public participants (NO PII - email and phone removed)
      const { email, phone, ...publicData } = registration;
      await addDoc(collection(db, "event_participants_public"), publicData)
        .catch(e => handleFirestoreError(e, OperationType.CREATE, "event_participants_public"));

      // Update badge stats
      updateStats({
        events_registered: 1
      });

      onSuccess(registration);
      toast.success('Successfully registered for the event!');
      onClose();
    } catch (error) {
      console.error("Error registering for event:", error);
      toast.error('Failed to register. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-card rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
          >
            <div className="p-6 border-b border-primary/10 flex items-center justify-between bg-primary/5">
              <div>
                <h3 className="text-xl font-bold text-primary">Register for Event</h3>
                <p className="text-sm text-text-secondary">{event.title}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-primary/5 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Full Name *</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                    className={cn(
                      "w-full pl-10 pr-4 py-2 rounded-xl border border-primary/10 bg-primary/5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-primary",
                      errors.fullName && "border-red-500 bg-red-500/10"
                    )}
                    placeholder="John Doe"
                  />
                </div>
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Email Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className={cn(
                        "w-full pl-10 pr-4 py-2 rounded-xl border border-primary/10 bg-primary/5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-primary",
                        errors.email && "border-red-500 bg-red-500/10"
                      )}
                      placeholder="john@example.com"
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className={cn(
                        "w-full pl-10 pr-4 py-2 rounded-xl border border-primary/10 bg-primary/5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-primary",
                        errors.phone && "border-red-500 bg-red-500/10"
                      )}
                      placeholder="+91 9876543210"
                    />
                  </div>
                  {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">College / Organization *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={e => setFormData({ ...formData, organization: e.target.value })}
                    className={cn(
                      "w-full pl-10 pr-4 py-2 rounded-xl border border-primary/10 bg-primary/5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-primary",
                      errors.organization && "border-red-500 bg-red-500/10"
                    )}
                    placeholder="University Name"
                  />
                </div>
                {errors.organization && <p className="text-xs text-red-500 mt-1">{errors.organization}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Team Name (Optional)</label>
                  <div className="relative">
                    <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                    <input
                      type="text"
                      value={formData.teamName}
                      onChange={e => setFormData({ ...formData, teamName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-primary/10 bg-primary/5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-primary"
                      placeholder="Team Alpha"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Number of Members</label>
                  <div className="relative">
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={18} />
                    <select
                      value={formData.memberCount}
                      onChange={e => setFormData({ ...formData, memberCount: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-primary/10 bg-primary/5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none text-text-primary"
                    >
                      <option value="1">1 (Solo)</option>
                      <option value="2">2 Members</option>
                      <option value="3">3 Members</option>
                      <option value="4">4 Members</option>
                      <option value="5+">5+ Members</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.agreed}
                    onChange={e => setFormData({ ...formData, agreed: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                    I agree to the event rules and terms of participation.
                  </span>
                </label>
                {errors.agreed && <p className="text-xs text-red-500 mt-1">{errors.agreed}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Registering...
                  </>
                ) : (
                  'Submit Registration'
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// --- Proof Submission Modal ---

interface ProofSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: { id: string; title: string };
  userEmail: string;
  onSuccess: (sub: Submission) => void;
}

const SUBMISSION_TYPES = [
  { label: 'Attendance Proof', points: 10 },
  { label: 'Task Completion', points: 25 },
  { label: 'Certificate Upload', points: 20 },
  { label: 'Workshop Completion', points: 30 },
  { label: 'Volunteer Proof', points: 40 },
];

export const ProofSubmissionModal: React.FC<ProofSubmissionModalProps> = ({
  isOpen,
  onClose,
  event,
  userEmail,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [type, setType] = useState(SUBMISSION_TYPES[0].label);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Only JPG, PNG, and PDF files are accepted');
      return;
    }

    setFile(selectedFile);
    setError(null);

    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please upload a file');
      return;
    }
    if (description.length < 20) {
      setError('Description must be at least 20 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedType = SUBMISSION_TYPES.find(t => t.label === type)!;

      const submission: any = {
        userId: auth.currentUser?.uid,
        eventId: event.id,
        eventName: event.title,
        fileName: file.name,
        description,
        type,
        points: selectedType.points,
        status: 'Verified', // Auto-verified for demo as per prompt
        aiVerificationStatus: 'VERIFIED',
        proofUrl: preview || 'https://picsum.photos/seed/proof/400/300',
        submittedAt: new Date().toISOString()
      };

      // Save to Firestore
      await addDoc(collection(db, "completions"), submission)
        .catch(e => handleFirestoreError(e, OperationType.CREATE, "completions"));

      // Update user points
      if (auth.currentUser) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, {
          points: increment(selectedType.points),
          totalPoints: increment(selectedType.points)
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${auth.currentUser?.uid}`));
      }

      // Update badge stats
      updateStats({
        points: selectedType.points,
        proofs_submitted: 1
      });

      onSuccess(submission as Submission);
      toast.success(`Proof submitted! You earned ${selectedType.points} points.`);
      onClose();
    } catch (error) {
      console.error("Error submitting proof:", error);
      toast.error('Failed to submit proof. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-card rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
          >
            <div className="p-6 border-b border-primary/10 flex items-center justify-between bg-primary/5">
              <div>
                <h3 className="text-xl font-bold text-primary">Submit Proof</h3>
                <p className="text-sm text-text-secondary">{event.title}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-primary/5 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed border-primary/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all",
                  file && "border-primary bg-primary/5"
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".jpg,.jpeg,.png,.pdf"
                />
                {preview ? (
                  <img src={preview} alt="Preview" className="w-24 h-24 object-cover rounded-lg shadow-md" />
                ) : file?.type === 'application/pdf' ? (
                  <div className="w-24 h-24 bg-red-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="text-red-500" size={40} />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center">
                    <Upload className="text-text-secondary" size={32} />
                  </div>
                )}
                <div className="text-center">
                  <p className="font-medium text-text-primary">
                    {file ? file.name : 'Click or drag to upload proof'}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">
                    JPG, PNG, PDF (Max 5MB)
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Submission Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-primary/10 bg-primary/5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-text-primary"
                >
                  {SUBMISSION_TYPES.map(t => (
                    <option key={t.label} value={t.label} className="bg-card">{t.label} (+{t.points} pts)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Describe your submission *</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className={cn(
                    "w-full px-4 py-2 rounded-xl border border-primary/10 bg-primary/5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all h-24 resize-none text-text-primary",
                    error && error.includes('Description') && "border-red-500 bg-red-500/10"
                  )}
                  placeholder="Tell us about what you're submitting..."
                />
                <p className="text-xs text-text-secondary mt-1">Min 20 characters</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-xl">
                  <AlertCircle size={18} />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Verifying your submission...
                  </>
                ) : (
                  'Submit Proof'
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// --- Participants List ---

interface ParticipantsListProps {
  eventId: string;
  registrations: Registration[];
  submissions: Submission[];
}

export const ParticipantsList: React.FC<ParticipantsListProps> = ({
  eventId,
  registrations,
  submissions
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'points' | 'recent' | 'alpha'>('points');

  const eventRegs = registrations.filter(r => r.eventId === eventId);
  
  const participants = eventRegs.map(reg => {
    // Link using userId instead of email to avoid PII issues and handle missing emails in public data
    const regSubmissions = submissions.filter(s => 
      (s.userId && reg.userId && s.userId === reg.userId) || 
      (s.userEmail && reg.email && s.userEmail === reg.email)
    ).filter(s => s.eventId === eventId);
    
    const totalPoints = regSubmissions.reduce((sum, s) => sum + s.points, 0);
    const status = regSubmissions.length > 0 ? 'Verified' : 'Pending';
    
    return {
      ...reg,
      points: totalPoints,
      status
    };
  });

  const filteredParticipants = participants
    .filter(p => 
      p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.organization.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'points') return b.points - a.points;
      if (sortBy === 'recent') return new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime();
      return a.fullName.localeCompare(b.fullName);
    });

  if (eventRegs.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-12 text-center border border-primary/10">
        <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-4">
          <UsersIcon className="text-primary" size={32} />
        </div>
        <h4 className="text-lg font-bold text-text-primary mb-2">No participants yet</h4>
        <p className="text-text-secondary mb-6">Be the first to register for this event!</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-primary/10 overflow-hidden">
      <div className="p-6 border-b border-primary/10 bg-primary/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h4 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <UsersIcon size={20} className="text-primary" />
            Registered Participants
          </h4>
          <p className="text-sm text-text-secondary">{eventRegs.length} people registered for this event</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search participants..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-primary/10 bg-primary/5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm text-text-primary"
            />
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-primary/10 bg-primary/5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm appearance-none text-text-primary"
          >
            <option value="points" className="bg-card">Most Points</option>
            <option value="recent" className="bg-card">Most Recent</option>
            <option value="alpha" className="bg-card">Alphabetical</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-primary/5 text-text-secondary text-xs font-bold uppercase tracking-wider">
              <th className="px-6 py-4">Rank</th>
              <th className="px-6 py-4">Participant</th>
              <th className="px-6 py-4">Organization</th>
              <th className="px-6 py-4">Points</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5">
            {filteredParticipants.map((p, index) => (
              <tr key={p.id} className="hover:bg-primary/5 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm">
                    {index === 0 ? <span className="text-2xl">🥇</span> :
                     index === 1 ? <span className="text-2xl">🥈</span> :
                     index === 2 ? <span className="text-2xl">🥉</span> :
                     <span className="text-text-secondary">#{index + 1}</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs">
                      {p.fullName.charAt(0)}
                    </div>
                    <span className="font-bold text-text-primary">{p.fullName}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-text-secondary">{p.organization}</td>
                <td className="px-6 py-4">
                  <span className="font-bold text-primary">⭐ {p.points}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    p.status === 'Verified' ? "bg-green-500/10 text-green-500" : "bg-primary/5 text-text-secondary"
                  )}>
                    {p.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-text-secondary">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatDistanceToNow(new Date(p.registeredAt), { addSuffix: true })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
