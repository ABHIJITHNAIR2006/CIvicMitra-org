import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import DashboardLayout from "../layouts/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, MapPin, Users, ArrowRight, Star, Plus, Edit2, Trash2, CheckCircle2, Camera, Trophy as TrophyIcon, Loader2, Database } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import EventModal from "../components/EventModal";
import { toast } from "react-hot-toast";
import { useEventData, Registration, Submission } from "../lib/event-registration-utils";
import { RegistrationModal, ProofSubmissionModal, ParticipantsList } from "../components/EventFeatures";
import ConfirmModal from "../components/ConfirmModal";

export default function Events() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'leaderboard'>('events');
  const [selectedEventForReg, setSelectedEventForReg] = useState<any>(null);
  const [selectedEventForProof, setSelectedEventForProof] = useState<any>(null);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  
  const { isAdmin, user } = useAuth();
  const { registrations, submissions, loading: eventDataLoading, isUserRegistered } = useEventData();
  const [seeding, setSeeding] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const q = query(collection(db, "events"), orderBy("startDate", "asc"));
      const snap = await getDocs(q).catch(e => {
        handleFirestoreError(e, OperationType.LIST, "events");
        return null;
      });
      if (snap) {
        setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (error: any) {
      console.error("Error fetching events:", error?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const eventsData = [
        {
          eventId: "city-forest-walk",
          title: "City Forest Walk",
          description: "Join a guided nature walk through an urban forest with a trained naturalist who will explain local flora, fauna, and the importance of urban green lungs.",
          shortDescription: "Guided nature walk through an urban forest with a naturalist.",
          eventType: "WALK",
          type: "WALK",
          category: "NATURE",
          bonusPoints: 30,
          points: 30,
          iconEmoji: "🌳",
          bannerImageUrl: "https://picsum.photos/seed/forestwalk/800/400",
          location: { venueName: "City Forest / Nearest Urban Park", address: "" },
          startDate: "2025-05-10T07:00:00Z",
          date: "2025-05-10",
          endDate: "2025-05-10T09:30:00Z",
          maxParticipants: 40,
          registrationDeadline: "2025-05-08",
          isActive: true,
          isFeatured: true,
          proofInstructions: "Upload a photo of yourself at the forest walk.",
          status: "UPCOMING"
        },
        {
          eventId: "beach-cleanup-drive",
          title: "Beach / Lake Cleanup Drive",
          description: "Join the community for an organized shoreline cleanup. Participants will collect, segregate into dry and wet waste, and log the total waste collected.",
          shortDescription: "Community shoreline cleanup — collect, segregate, and log waste.",
          eventType: "CLEANUP",
          type: "CLEANUP",
          category: "NATURE",
          bonusPoints: 40,
          points: 40,
          iconEmoji: "🏖️",
          bannerImageUrl: "https://picsum.photos/seed/beachclean/800/400",
          location: { venueName: "Nearest Beach / Lake Front", address: "" },
          startDate: "2025-05-17T06:30:00Z",
          date: "2025-05-17",
          endDate: "2025-05-17T09:00:00Z",
          maxParticipants: 100,
          registrationDeadline: "2025-05-15",
          isActive: true,
          isFeatured: true,
          proofInstructions: "Upload a photo of the waste bags you filled.",
          status: "UPCOMING"
        },
        {
          eventId: "tree-plantation-marathon",
          title: "Tree Plantation Marathon",
          description: "Be part of a city-wide tree planting initiative where teams plant 100+ native trees across multiple locations.",
          shortDescription: "Plant 100+ trees across the city in teams.",
          eventType: "PLANTATION",
          type: "PLANTATION",
          category: "NATURE",
          bonusPoints: 50,
          points: 50,
          iconEmoji: "🌱",
          bannerImageUrl: "https://picsum.photos/seed/plantation/800/400",
          location: { venueName: "Multiple City Locations", address: "" },
          startDate: "2025-06-05T08:00:00Z",
          date: "2025-06-05",
          endDate: "2025-06-05T12:00:00Z",
          maxParticipants: 200,
          registrationDeadline: "2025-06-02",
          isActive: true,
          isFeatured: true,
          proofInstructions: "Upload a photo of you planting your sapling.",
          status: "UPCOMING"
        },
        {
          eventId: "butterfly-garden-visit",
          title: "Butterfly Garden Visit",
          description: "Visit a local butterfly garden or botanical garden with fellow eco-citizens. A guide will help you identify native butterfly species and host plants.",
          shortDescription: "Visit a butterfly garden and document species spotted.",
          eventType: "VISIT",
          type: "VISIT",
          category: "NATURE",
          bonusPoints: 25,
          points: 25,
          iconEmoji: "🦋",
          bannerImageUrl: "https://picsum.photos/seed/butterfly/800/400",
          location: { venueName: "Local Botanical Garden", address: "" },
          startDate: "2025-05-24T09:00:00Z",
          date: "2025-05-24",
          endDate: "2025-05-24T11:00:00Z",
          maxParticipants: 30,
          registrationDeadline: "2025-05-22",
          isActive: true,
          isFeatured: false,
          proofInstructions: "Upload a photo of a butterfly or plant you spotted and documented.",
          status: "UPCOMING"
        },
        {
          eventId: "river-rejuvenation-walk",
          title: "River Rejuvenation Walk",
          description: "Walk along a local river stretch with volunteers. Document pollution points such as sewage outfalls and illegal dumping.",
          shortDescription: "Walk a river stretch, document pollution, and file a report.",
          eventType: "WALK",
          type: "WALK",
          category: "NATURE",
          bonusPoints: 35,
          points: 35,
          iconEmoji: "🌊",
          bannerImageUrl: "https://picsum.photos/seed/riverwalk/800/400",
          location: { venueName: "Local River Stretch", address: "" },
          startDate: "2025-06-14T07:00:00Z",
          date: "2025-06-14",
          endDate: "2025-06-14T10:00:00Z",
          maxParticipants: 50,
          registrationDeadline: "2025-06-12",
          isActive: true,
          isFeatured: false,
          proofInstructions: "Upload a screenshot of your report or photo of documentation.",
          status: "UPCOMING"
        },
        {
          eventId: "seed-ball-workshop",
          title: "Seed Ball Workshop",
          description: "Learn the ancient technique of making seed balls using native seeds. Scatter seed balls in barren land around the city.",
          shortDescription: "Make seed balls and scatter them in barren city areas.",
          eventType: "WORKSHOP",
          type: "WORKSHOP",
          category: "NATURE",
          bonusPoints: 30,
          points: 30,
          iconEmoji: "🌼",
          bannerImageUrl: "https://picsum.photos/seed/seedball/800/400",
          location: { venueName: "Community Centre", address: "" },
          startDate: "2025-05-31T10:00:00Z",
          date: "2025-05-31",
          endDate: "2025-05-31T13:00:00Z",
          maxParticipants: 35,
          registrationDeadline: "2025-05-29",
          isActive: true,
          isFeatured: false,
          proofInstructions: "Upload a photo of the seed balls you made.",
          status: "UPCOMING"
        },
      ];

      const { writeBatch } = await import("firebase/firestore");
      const batch = writeBatch(db);
      eventsData.forEach(e => {
        const ref = doc(db, "events", e.eventId);
        batch.set(ref, {
          ...e,
          createdAt: new Date().toISOString()
        });
      });
      await batch.commit();
      toast.success("Events updated successfully!");
      fetchEvents();
    } catch (error: any) {
      console.error("Error seeding events:", error?.message || "Unknown error");
      toast.error("Failed to update events");
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleEdit = (event: any) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const handleDelete = async (eventId: string) => {
    try {
      await deleteDoc(doc(db, "events", eventId)).catch(e => {
        handleFirestoreError(e, OperationType.DELETE, `events/${eventId}`);
        return null;
      });
      toast.success("Event deleted successfully!");
      fetchEvents();
    } catch (error: any) {
      console.error("Error deleting event:", error?.message || "Unknown error");
      toast.error("Failed to delete event");
    } finally {
      setEventToDelete(null);
    }
  };

  const handleCreate = () => {
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const handleRegistrationSuccess = (reg: Registration) => {
    setSelectedEventForReg(null);
    toast.success(`✅ You have successfully registered for ${reg.eventName}!`);
  };

  const handleSubmissionSuccess = (sub: Submission) => {
    setSelectedEventForProof(null);
    toast.success(`🎉 Proof submitted! You earned +${sub.points} points!`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl mb-2">Community Events</h1>
            <p className="text-text-secondary">Join local eco-initiatives and earn bonus points.</p>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <button 
                onClick={handleSeedData}
                disabled={seeding}
                className="px-6 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-all flex items-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-50"
              >
                <Database size={20} />
                {seeding ? "Updating..." : "Update Database"}
              </button>
            )}
            <div className="bg-card p-1 rounded-xl border border-primary/10 flex shadow-sm">
              <button
                onClick={() => setActiveTab('events')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === 'events' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-text-secondary hover:text-primary"
                )}
              >
                <Calendar size={18} />
                Events
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === 'leaderboard' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-text-secondary hover:text-primary"
                )}
              >
                <TrophyIcon size={18} />
                Participants
              </button>
            </div>
            {isAdmin && (
              <button 
                onClick={handleCreate}
                className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                <Plus size={20} />
                Create Event
              </button>
            )}
          </div>
        </div>

        {loading || eventDataLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-text-secondary animate-pulse">Loading events and participants...</p>
          </div>
        ) : activeTab === 'events' ? (
          <>
            {/* Featured Event */}
            {events.filter(e => e.isFeatured)[0] && (
              <div 
                className="relative h-96 rounded-3xl overflow-hidden card-shadow group cursor-pointer"
                onClick={() => setSelectedEventForReg(events.filter(e => e.isFeatured)[0])}
              >
                <img 
                  src={events.filter(e => e.isFeatured)[0].bannerImageUrl || "https://picsum.photos/seed/featured/1200/600"} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 md:p-12">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-accent text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Featured</span>
                    <span className="bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                      {events.filter(e => e.isFeatured)[0].eventType}
                    </span>
                  </div>
                  <h2 className="text-4xl md:text-5xl text-white mb-4 max-w-2xl">{events.filter(e => e.isFeatured)[0].title}</h2>
                  <div className="flex flex-wrap gap-6 text-white/80 mb-8">
                    <div className="flex items-center gap-2">
                      <Calendar size={20} />
                      <span>{new Date(events.filter(e => e.isFeatured)[0].startDate).toLocaleDateString()} • {new Date(events.filter(e => e.isFeatured)[0].startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={20} />
                      <span>{events.filter(e => e.isFeatured)[0].location?.venueName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={20} />
                      <span>{registrations.filter(r => r.eventId === events.filter(e => e.isFeatured)[0].id).length} Joined</span>
                    </div>
                  </div>
                  {!isUserRegistered(events.filter(e => e.isFeatured)[0].id) && (
                    <button className="w-fit px-8 py-4 bg-white text-primary rounded-xl font-bold hover:bg-gray-100 transition-colors flex items-center gap-2">
                      Register Now <ArrowRight size={20} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Events Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {loading ? (
                [1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-gray-200 rounded-3xl animate-pulse" />)
              ) : events.length > 0 ? (
                events.map(event => (
                  <EventCard 
                    key={event.id} 
                    event={event} 
                    isAdmin={isAdmin}
                    userEmail={user?.email || null}
                    isRegistered={isUserRegistered(event.id)}
                    onEdit={() => handleEdit(event)}
                    onDelete={() => setEventToDelete(event.id)}
                    onRegister={() => setSelectedEventForReg(event)}
                    onSubmitProof={() => setSelectedEventForProof(event)}
                  />
                ))
              ) : (
                <div className="col-span-full py-20 text-center bg-card rounded-3xl card-shadow">
                  <p className="text-text-secondary">No upcoming events found. Check back later!</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-12">
            {events.map(event => (
              <div key={event.id} className="space-y-4">
                <div className="flex items-center gap-4 px-2">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-text-primary">{event.title}</h3>
                    <p className="text-text-secondary text-sm">{new Date(event.startDate).toLocaleDateString()} • {event.location?.venueName || 'Online'}</p>
                  </div>
                </div>
                <ParticipantsList 
                  eventId={event.id}
                  registrations={registrations}
                  submissions={submissions}
                />
              </div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {isModalOpen && (
            <EventModal 
              event={editingEvent} 
              onClose={() => setIsModalOpen(false)} 
              onSuccess={fetchEvents}
            />
          )}
        </AnimatePresence>

        <RegistrationModal
          isOpen={!!selectedEventForReg}
          onClose={() => setSelectedEventForReg(null)}
          event={selectedEventForReg || { id: '', title: '' }}
          userEmail={user?.email || null}
          onSuccess={handleRegistrationSuccess}
        />

        <ProofSubmissionModal
          isOpen={!!selectedEventForProof}
          onClose={() => setSelectedEventForProof(null)}
          event={selectedEventForProof || { id: '', title: '' }}
          userEmail={user?.email || ''}
          onSuccess={handleSubmissionSuccess}
        />

        <ConfirmModal
          isOpen={!!eventToDelete}
          onClose={() => setEventToDelete(null)}
          onConfirm={() => eventToDelete && handleDelete(eventToDelete)}
          title="Delete Event"
          message="Are you sure you want to delete this event? This action cannot be undone."
          confirmText="Delete"
          variant="danger"
        />
      </div>
    </DashboardLayout>
  );
}

function EventCard({ 
  event, 
  isAdmin, 
  userEmail,
  isRegistered,
  onEdit, 
  onDelete,
  onRegister,
  onSubmitProof
}: { 
  event: any, 
  isAdmin: boolean, 
  userEmail: string | null,
  isRegistered: boolean,
  onEdit: () => void, 
  onDelete: () => void,
  onRegister: () => void,
  onSubmitProof: () => void
}) {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-card rounded-3xl card-shadow overflow-hidden flex flex-col group"
    >
      <div className="h-48 relative">
        <img src={event.bannerImageUrl || `https://picsum.photos/seed/${event.id}/800/400`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-primary">
          {event.eventType}
        </div>
        <div className="absolute top-4 right-4 bg-primary text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
          <Star size={12} /> +{event.bonusPoints} pts
        </div>
        
        {isAdmin && (
          <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-2 bg-card text-primary rounded-lg shadow-lg hover:bg-primary hover:text-white transition-all"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-2 bg-card text-red-600 rounded-lg shadow-lg hover:bg-red-600 hover:text-white transition-all"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <h3 className="text-2xl mb-2 text-text-primary">{event.title}</h3>
        <p className="text-text-secondary text-sm line-clamp-2 mb-6 flex-1">{event.description}</p>
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Calendar size={16} className="text-primary" />
            <span>{new Date(event.startDate).toLocaleDateString()} at {new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <MapPin size={16} className="text-primary" />
            <span>{event.location?.venueName || 'Online'}</span>
          </div>
        </div>
        
        <div className="space-y-3">
          {isRegistered ? (
            <div className="space-y-3">
              <button 
                disabled
                className="w-full py-3 bg-green-50 text-green-600 rounded-xl font-bold flex items-center justify-center gap-2 border border-green-100"
              >
                <CheckCircle2 size={18} />
                Registered
              </button>
              <button 
                onClick={onSubmitProof}
                className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                <Camera size={18} />
                Submit Proof to Earn Points
              </button>
            </div>
          ) : (
            <button 
              onClick={onRegister}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              Register for Event
            </button>
          )}
          <button className="w-full py-2 text-text-secondary text-sm font-medium hover:text-primary transition-colors">
            View Details
          </button>
        </div>
      </div>
    </motion.div>
  );
}
