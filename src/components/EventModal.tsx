import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { X, Calendar, MapPin, Star, Info, Image as ImageIcon } from "lucide-react";
import { db } from "../firebase";
import { doc, setDoc, addDoc, collection } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";

import { useAuth } from "../contexts/AuthContext";
import { Role } from "../types";

interface EventModalProps {
  event?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EventModal({ event, onClose, onSuccess }: EventModalProps) {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    location: {
      venueName: "",
      address: ""
    },
    bonusPoints: 50,
    eventType: "CLEANUP",
    bannerImageUrl: "",
    status: "UPCOMING"
  });

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || "",
        description: event.description || "",
        startDate: event.startDate || "",
        endDate: event.endDate || "",
        location: {
          venueName: event.location?.venueName || "",
          address: event.location?.address || ""
        },
        bonusPoints: event.bonusPoints || 50,
        eventType: event.eventType || "In-Person",
        bannerImageUrl: event.bannerImageUrl || "",
        status: event.status || "UPCOMING"
      });
    }
  }, [event]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error("Only admins can host events");
      onClose();
      return;
    }

    if (!formData.title || !formData.description || !formData.startDate || !formData.location.venueName) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const dataToSave = { ...formData };
      if (!dataToSave.endDate) delete (dataToSave as any).endDate;
      if (!dataToSave.bannerImageUrl) delete (dataToSave as any).bannerImageUrl;

      if (event?.id) {
        // Update
        await setDoc(doc(db, "events", event.id), {
          ...dataToSave,
          updatedAt: new Date().toISOString()
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `events/${event.id}`));
        toast.success("Event updated successfully!");
      } else {
        // Create
        await addDoc(collection(db, "events"), {
          ...dataToSave,
          createdAt: new Date().toISOString(),
          eventId: Math.random().toString(36).substring(7)
        }).catch(e => handleFirestoreError(e, OperationType.CREATE, "events"));
        toast.success("Event created successfully!");
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error("Failed to save event");
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-card p-8 rounded-3xl text-center space-y-4">
          <h2 className="text-2xl font-bold text-red-500">Unauthorized</h2>
          <p className="text-text-secondary">Only administrators can create or edit events.</p>
          <button onClick={onClose} className="px-6 py-2 bg-primary text-white rounded-xl font-bold">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-card w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-primary/10 flex items-center justify-between bg-card sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-text-primary">{event ? "Edit Event" : "Create New Event"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-primary/5 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Event Title *</label>
            <div className="relative">
              <Info className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full pl-12 pr-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-text-primary"
                placeholder="e.g. Beach Clean-up Drive"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Description *</label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all resize-none text-text-primary"
              placeholder="Describe the event and its impact..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Start Date & Time *</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                <input
                  type="datetime-local"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-text-primary"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">End Date & Time</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                <input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-text-primary"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Event Type *</label>
              <select
                required
                value={formData.eventType}
                onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                className="w-full px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-text-primary"
              >
                <option value="CLEANUP">Cleanup Drive</option>
                <option value="WORKSHOP">Workshop</option>
                <option value="WALK">Nature Walk</option>
                <option value="PLANTATION">Tree Plantation</option>
                <option value="VISIT">Eco Visit</option>
                <option value="MEETING">Community Meeting</option>
                <option value="CAMPAIGN">Awareness Campaign</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Status *</label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-text-primary"
              >
                <option value="UPCOMING">Upcoming</option>
                <option value="ONGOING">Ongoing</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Venue Name *</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                <input
                  type="text"
                  required
                  value={formData.location.venueName}
                  onChange={(e) => setFormData({ ...formData, location: { ...formData.location, venueName: e.target.value } })}
                  className="w-full pl-12 pr-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-text-primary"
                  placeholder="e.g. Juhu Beach"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Bonus Points *</label>
              <div className="relative">
                <Star className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                <input
                  type="number"
                  required
                  value={formData.bonusPoints}
                  onChange={(e) => setFormData({ ...formData, bonusPoints: parseInt(e.target.value) })}
                  className="w-full pl-12 pr-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-text-primary"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Banner Image URL</label>
            <div className="relative">
              <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
              <input
                type="url"
                value={formData.bannerImageUrl}
                onChange={(e) => setFormData({ ...formData, bannerImageUrl: e.target.value })}
                className="w-full pl-12 pr-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-text-primary"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4 sticky bottom-0 bg-card pb-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-primary/5 text-text-primary rounded-xl font-bold hover:bg-primary/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-colors shadow-lg disabled:opacity-50"
            >
              {loading ? "Saving..." : event ? "Update Event" : "Create Event"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
